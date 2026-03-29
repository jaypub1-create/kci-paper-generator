# KCI Paper Generator

AI 기반 KCI(한국연구재단) 학술 논문 자동 생성 웹 앱

Claude API를 활용하여 논문 주제를 입력하면 KCI 등재지 형식에 맞는 한글 학술 논문을 Word(.docx)로 자동 생성합니다.

## Features

- 연구가설-변수체계-매개모형을 포함한 학술 논문 자동 생성
- KCI 스타일 Word(.docx) 문서 출력 (바탕체, A4, 2.5cm 여백)
- 참고문헌 30편 이상 자동 구성 (국내:해외 = 3:7)
- 반응형 웹 UI (노트북/핸드폰 지원)
- 실시간 생성 진행 상태 표시

## 논문 구조

| 섹션 | 내용 |
|------|------|
| I. 서론 | 연구 배경, 목적, RQ, 가설(H1-H5), 범위 |
| II. 이론적 배경 | 개념 정의, 이론적 프레임워크, 선행연구 |
| III. 연구 방법 | PRISMA, 품질평가, 메타분석 절차 |
| IV. 연구 결과 | 기술통계, 가설검증(k/N/r/CI/p/I²), 민감도분석 |
| V. 결론 | 요약, 시사점, 한계, 향후 연구 |

## Requirements

- Node.js 18+
- Anthropic API Key ([console.anthropic.com](https://console.anthropic.com))

## Quick Start

```bash
git clone https://github.com/jaypub1-create/kci-paper-generator.git
cd kci-paper-generator
npm install
node server.js
```

브라우저에서 `http://localhost:3000` 접속

## Usage

1. 상단 입력란에 Anthropic API Key 입력 (sk-ant-...)
2. 논문 주제 입력
3. 연구 방법론 선택 (SLR+메타분석 / 실증연구 / 사례연구 / 실험연구)
4. 논문 분량, 이론적 프레임워크 설정
5. "논문 생성 시작" 클릭 (2~5분 소요)
6. 완료 후 .docx 다운로드

## Tech Stack

- **Frontend**: React 18 (CDN, no build step)
- **Backend**: Node.js + Express
- **AI**: Claude API (@anthropic-ai/sdk)
- **Document**: docx-js (Word 문서 생성)

## Project Structure

```
kci-paper-generator/
├── server.js              # Express 백엔드 + Claude API 연동
├── package.json
├── public/
│   └── index.html         # React 프론트엔드 (SPA)
└── scripts/
    └── build-paper.js     # KCI 스타일 Word 문서 빌더
```

## License

MIT
