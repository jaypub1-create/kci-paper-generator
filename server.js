#!/usr/bin/env node
/**
 * KCI Paper Generator - Backend Server
 * Express + Claude API + docx 생성
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const crypto = require("crypto");

// ── Anthropic SDK 로드 (여러 import 패턴 대응) ──
let AnthropicClass;
try {
  const sdk = require("@anthropic-ai/sdk");
  AnthropicClass = sdk.default || sdk.Anthropic || sdk;
  console.log("[OK] @anthropic-ai/sdk 로드 성공");
} catch (err) {
  console.error("[ERROR] @anthropic-ai/sdk 를 찾을 수 없습니다.");
  console.error("  npm install @anthropic-ai/sdk 를 실행해주세요.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, "output");
const APP_PASSWORD = process.env.APP_PASSWORD || "kci2024!";

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── 인증 토큰 저장소 (실제 배포에서는 Redis 등 사용) ──
const authTokens = new Set();

// ── 헬퍼: 랜덤 토큰 생성 ──
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ── 인증 미들웨어 ──
function authMiddleware(req, res, next) {
  // 인증이 필요하지 않은 경로들
  const publicPaths = ["/api/login", "/api/auth-check", "/api/health"];
  const isPublicPath = publicPaths.some((p) => req.path === p);
  const isStaticAsset = req.path.startsWith("/") && /\.(js|css|json|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot)$/i.test(req.path);

  if (isPublicPath || isStaticAsset) {
    return next();
  }

  // 기타 경로는 인증 필욘
  const token = req.cookies?.auth_token;
  if (!token || !authTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// ── 쿠키 파서 (간단한 구현) ──
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  req.cookies = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      req.cookies[name] = decodeURIComponent(value);
    }
  });
  next();
});

// ── 로그인 API ──
app.post("/api/login", express.json(), (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password !== APP_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = generateToken();
  authTokens.add(token);

  // Set secure cookie (HttpOnly, SameSite)
  res.setHeader("Set-Cookie", `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);

  res.json({ success: true });
});

// ── 인증 체크 API ──
app.get("/api/auth-check", (req, res) => {
  const token = req.cookies?.auth_token;
  const isAuthenticated = token && authTokens.has(token);

  res.json({ authenticated: isAuthenticated });
});

// ── 인증 미들웨어 적용 ──
app.use(authMiddleware);

// ── 헬스체크 ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", sdk: !!AnthropicClass });
});

// ── 프롬프트 빌더 ──
function buildPrompt(params) {
  const { topic, details, method, pages, theories } = params;
  const methodMap = {
    slr_meta: "체계적 문헌고찰(SLR) + 메타분석",
    empirical: "설문조사 기반 실증연구",
    case: "사례연구",
    experiment: "실험연구",
  };

  return `당신은 한국 학술논문 전문 작섰자입니다. 아래 주제에 대한 KCI 듰재지 수준의 한글 학술 논문을 JSON 형식으로 작성해주세요.

## 논문 주제
${topic}

## 세부 요구사항
${details || "(없음)"}

## 연구 방법론
${methodMap[method] || "체계적 문헌고찰 + 메타분석"}

## 논문 분량
A4 ${pages || "15-20"} 페이지

## 이론적 프레임워크
${theories || "주제에 적합한 이론 2개를 선택하여 적용"}

---

## 작성 지침

### 1. 연구 설계 (반드시 선행)
- **연구 질문(RQ)** 4개: 변수 간 관계를 명시적으로 묻는 형태
- **변수 체계**: 독립변수(IV) 2~3개, 매개변수(MV) 1~2개, 종속변수(DV) 1~2개 — 각각 조작적 정의 포함
- **이론적 프레임워크**: 검증된 이론 1~2개
- **연구가설(H1~H5)**: 방향성 포함

### 2. 섹션 구조
- **I. 서론** (4개 절): 연구 배경(research gap 3개), 연구 목적/RQ, 연구 모형/가설, 연구 범위
- **II. 이론적 배경** (4개 절): 핵심 개념, 종속변수 측정, 이론적 프레임워크, 선행연구 검토
- **III. 연구 방법** (6~7개 절): 연구 설계, 문헌 탐색, PRISMA, 품질 평가, 데이터 추출, 메타분석 절차
- **IV. 연구 결과** (5~6개 절): 기술통계, 가설 검증(k/N/r/CI/p/I²), 추판 편향, 조절효과, 결과 종합
- **V. 결론 및 논의** (4개 절): 요약, 학술적 시사점, 실무적 시사점, 한계 및 향후 연구

### 3. 참고문헌
- 30편 이상 (국내:해외 = 3:7)
- 국내: "홍길동 (2023). 제목. 학술지명, 29(3), 1-25."
- 해외: APA 7th "Smith, J. (2023). Title. Journal, 45(2), 112-135."

## 출력: 아래 JSON 구조로만 출력하세요. JSON 외 다른 텍스트 없이.

\`\`\`json
{
  "metadata": {
    "title_kr": "국문 제목",
    "title_en": "English Title",
    "authors": "저자명",
    "affiliation": "소속",
    "keywords_kr": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
    "keywords_en": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
  },
  "abstract_kr": "국문 초록 (200-300자)...",
  "abstract_en": "English abstract (200-300 words)...",
  "sections": [
    {
      "number": "I",
      "title": "서론",
      "subsections": [
        { "number": "1", "title": "연구 배경 및 필요성", "content": "단락구분은 비줄 두개(\\n\\n)로..." }
      ]
    }
  ],
  "references": [
    { "type": "journal_kr", "formatted": "홍길동 (2023). 제목. 학술지명, 29(3), 1-25." },
    { "type": "journal_en", "formatted": "Smith, J. (2023). Title. Journal, 45(2), 112-135." }
  ]
}
\`\`\`

## 매우 중요한 JSON 규칙
1. 문자열 값 안에 큰따옴표(")를 쓰지 마세요. 작은따옴표(')나 홐땨툴표로 대체하세요.
2. 문자열 값 안에 실제 줄바꿈을 넣지 마세요. 단락 구분은 반드시 \\n\\n 텍스트로 넣으세요.
3. 참고문헌의 formatted 필드에 논문 제목을 따옴표로 감슸지 마세요.
4. 반드시 유효한 JSON만 출력하세요. JSON 외 다른 텍스트 없이.`;
}

// ── 강화된 JSON 복구 ──
function repairJSON(str) {
  console.log("[REPAIR] 원본 길이:", str.length);

  // 0) 문자열 내부의 실제 줄바꿈(LF)을 \\n으로 치환
  //    JSON string 안에 literal newline이 있으면 파싱 에러 발생
  let s = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc) { s += c; esc = false; continue; }
    if (c === "\\") { s += c; esc = true; continue; }
    if (c === '"') { inStr = !inStr; s += c; continue; }
    if (inStr && c === "\n") { s += "\\n"; continue; }
    if (inStr && c === "\r") { continue; } // CR 무시
    if (inStr && c === "\t") { s += "\\t"; continue; }
    s += c;
  }

  // 1) 문자열 내부 이스케이프 안 된 따옴표 수정 시도
  //    "formatted": "Smith (2023). "Title". Journal" 같은 케이스
  //    전략: key-value 구조를 유지하면서 value 안의 따옴표를 찾아 이스케이프
  s = s.replace(/":\s*"((?:[^"\\]|\\.)*)"/g, function(match) {
    // 이미 유효한 경우 그대로 반환
    return match;
  });

  // 2) trailing comma 제거
  s = s.replace(/,\s*([}\]])/g, "$1");

  // 3) 잘린 마지막 항목 정리
  s = s.replace(/,\s*\{[^}]*$/g, "");
  s = s.replace(/,\s*"[^"]*$/g, "");

  // 4) 열린 문자열 닫기 & 관호 세기
  let braces = 0, brackets = 0;
  inStr = false; esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === "[") brackets++;
    else if (c === "]") brackets--;
  }
  if (inStr) s += '"';

  // 5) 닫는 괄호 추가
  s = s.replace(/,\s*$/g, ""); // 끝 trailing comma
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }
  s = s.replace(/,\s*([}\]])/g, "$1");

  console.log("[REPAIR] 복구 후 길이:", s.length);

  // 6) 파싱 시도
  try {
    return JSON.parse(s);
  } catch (e) {
    console.error("[REPAIR] 1차 복구 실패:", e.message);

    // 7) 최후의 수단: 에러 위치 근처 문제 문자 제거 후 재시도
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      console.log("[REPAIR] 에러 위치:", pos, "주변:", JSON.stringify(s.substring(pos - 30, pos + 30)));

      // 에러 위치 근처에서 잘라내고 나머지 닫기
      let truncated = s.substring(0, pos);
      // 마지막 완전한 항목까지 자르기
      const lastComplete = truncated.lastIndexOf("}");
      if (lastComplete > pos - 500) {
        truncated = truncated.substring(0, lastComplete + 1);
      }
      // trailing comma 정리
      truncated = truncated.replace(/,\s*$/g, "");
      // 괄호 닫기
      braces = 0; brackets = 0; inStr = false; esc = false;
      for (let i = 0; i < truncated.length; i++) {
        const c = truncated[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") braces++;
        else if (c === "}") braces--;
        else if (c === "[") brackets++;
        else if (c === "]") brackets--;
      }
      if (inStr) truncated += '"';
      while (brackets > 0) { truncated += "]"; brackets--; }
      while (braces > 0) { truncated += "}"; braces--; }
      truncated = truncated.replace(/,\s*([}\]])/g, "$1");

      console.log("[REPAIR] 2차 복구 시도, 길이:", truncated.length);
      return JSON.parse(truncated);
    }
    throw e;
  }
}

// ── 논문 생성 API ──
app.post("/api/generate", async (req, res) => {
  console.log("\n[API] POST /api/generate 요청 수신");

  const { topic, details, method, pages, theories, apiKey } = req.body;

  if (!topic) {
    console.log("[API] 오류: topic 없음");
    return res.status(400).json({ error: "논문 주제를 입력해주세요." });
  }
  if (!apiKey) {
    console.log("[API] 오류: apiKey 없음");
    return res.status(400).json({ error: "API 키를 입력해주세요." });
  }

  // Streaming: newline-delimited JSON
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function send(obj) {
    try {
      res.write(JSON.stringify(obj) + "\n");
    } catch (e) {
      console.error("[SEND] write error:", e.message);
    }
  }

  try {
    send({ type: "step", step: 0, message: "프롬프트 구성 중..." });
    send({ type: "log", message: "주제: " + topic });
    send({ type: "log", message: "방법론: " + (method || "slr_meta") });

    // Claude API 호출
    send({ type: "step", step: 1, message: "Claude API 연결 중..." });

    let client;
    try {
      client = new AnthropicClass({ apiKey: apiKey });
      console.log("[API] Anthropic client 생성 완료");
    } catch (sdkErr) {
      console.error("[API] SDK 초기화 오류:", sdkErr.message);
      send({ type: "error", message: "API 클라이언트 초기화 실패: " + sdkErr.message });
      return res.end();
    }

    send({ type: "step", step: 2, message: "논문 내용 생성 중... (2~5분 소요)" });

    const prompt = buildPrompt({ topic, details, method, pages, theories });

    // 모델 목록: 순서대로 시도
    const MODELS = [
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-sonnet-20240229",
    ];

    let response;
    let usedModel = "";
    for (const modelName of MODELS) {
      try {
        console.log("[API] 모델 시도:", modelName);
        send({ type: "log", message: "모델: " + modelName });
        response = await client.messages.create({
          model: modelName,
          max_tokens: 16384,
          messages: [{ role: "user", content: prompt }],
        });
        usedModel = modelName;
        console.log("[API] Claude 응답 수신 완료 (모델: " + modelName + ")");
        break;
      } catch (apiErr) {
        console.error("[API] 모델 " + modelName + " 실패:", apiErr.message);
        if (apiErr.message.includes("401") || apiErr.status === 401) {
          send({ type: "error", message: "API 키가 유효하지 않습니다. 윬바른 Anthropic API 키를 입력해주세요." });
          return res.end();
        }
        if (apiErr.message.includes("429") || apiErr.status === 429) {
          send({ type: "error", message: "API 요청 한도 초과. 잠시 후 다시 시도해주세요." });
          return res.end();
        }
        if (apiErr.message.includes("credit") || apiErr.message.includes("insufficient") || apiErr.message.includes("billing")) {
          send({ type: "error", message: "API 크레랧이 부족합니다. console.anthropic.com에서 확인해주세요." });
          return res.end();
        }
        // 모델을 못찾은 경우 다음 모델 시도
        send({ type: "log", message: modelName + " 사용 불가, 다음 모델 시도..." });
        continue;
      }
    }

    if (!response) {
      send({ type: "error", message: "사용 가능한 Claude 모델을 찾을 수 없습니다. API 키와 크레딧을 확인해주세요." });
      return res.end();
    }

    const rawText = response.content[0].text;
    send({ type: "log", message: "응답 크기: " + rawText.length + " chars" });
    send({ type: "step", step: 3, message: "JSON 파싱 중..." });

    // JSON 추출
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const braceStart = rawText.indexOf("{");
      const braceEnd = rawText.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd !== -1) {
        jsonStr = rawText.substring(braceStart, braceEnd + 1);
      }
    }

    let config;
    try {
      config = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.log("[API] 1차 JSON 파싱 실패, 복구 시도 중...");
      send({ type: "log", message: "JSON 복구 시도 중..." });

      // 잘린 JSON 복구 시도
      try {
        config = repairJSON(jsonStr);
        console.log("[API] JSON 복구 성공");
        send({ type: "log", message: "JSON 복구 성공" });
      } catch (repairErr) {
        console.error("[API] JSON 복구 실패:", repairErr.message);
        // 응답의 stop_reason 확인
        const stopReason = response.stop_reason || "unknown";
        console.log("[API] stop_reason:", stopReason);
        send({ type: "error", message: "JSON 파싱 실패 (stop_reason: " + stopReason + "). 다시 시도해주세요." });
        return res.end();
      }
    }

    send({ type: "step", step: 4, message: "이론적 배경 처리 완료" });
    send({ type: "step", step: 5, message: "연구 방법 처리 완료" });
    send({ type: "step", step: 6, message: "연구 결과 및 결론 처리 완료" });

    // Word 생성
    send({ type: "step", step: 7, message: "Word 문서(.docx) 생성 중..." });

    const timestamp = Date.now();
    const safeTitle = (topic || "paper").replace(/[^가-힣a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 40);
    const filename = safeTitle + "_" + timestamp + ".docx";
    const outputPath = path.join(OUTPUT_DIR, filename);
    const configPath = path.join(OUTPUT_DIR, "config_" + timestamp + ".json");

    config.outputPath = outputPath;
    if (!config.metadata) config.metadata = {};
    if (!config.metadata.authors) config.metadata.authors = "연구자";
    if (!config.metadata.affiliation) config.metadata.affiliation = "소속기관";

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    const buildScript = path.join(__dirname, "scripts", "build-paper.js");
    try {
      execSync('node "' + buildScript + '" "' + configPath + '"', {
        env: Object.assign({}, process.env, { NODE_PATH: path.join(__dirname, "node_modules") }),
        timeout: 30000,
      });
    } catch (buildErr) {
      console.error("[API] build-paper.js 오류:", buildErr.message);
      send({ type: "error", message: "Word 문서 생성 실패: " + buildErr.message });
      return res.end();
    }

    // cleanup
    try { fs.unlinkSync(configPath); } catch (e) {}

    const stats = fs.statSync(outputPath);
    send({ type: "log", message: "파일: " + filename + " (" + (stats.size / 1024).toFixed(1) + "KB)" });

    send({
      type: "done",
      result: {
        filename: filename,
        size: stats.size,
        sections: config.sections ? config.sections.length : 0,
        references: config.references ? config.references.length : 0,
        hypotheses: 5,
        title: config.metadata.title_kr,
      },
    });
  } catch (err) {
    console.error("[API] 예상치 못한 오류:", err);
    send({ type: "error", message: "서버 오류: " + err.message });
  }

  res.end();
});

// 파일 다운로드
app.get("/api/download/:filename", (req, res) => {
  const filepath = path.join(OUTPUT_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).send("File not found");
  res.download(filepath);
});

// ── PWA 지원: manifest.json과 service-worker.js 제공 ──
app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});

app.get("/service-worker.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "service-worker.js"));
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 글로벌 오류 핸들러
app.use((err, req, res, next) => {
  console.error("[GLOBAL ERROR]", err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  ┌──────────────────────────────────┐");
  console.log("  │  KCI Paper Generator Server       │");
  console.log("  │  http://localhost:" + PORT + "             │");
  console.log("  └──────────────────────────────────┘");
  console.log("");
  console.log("  브라우저에서 위 주소로 접속하세요.");
  console.log("  종료: Ctrl+C");
  console.log("");
});
