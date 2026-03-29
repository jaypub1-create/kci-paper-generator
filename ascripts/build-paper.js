#!/usr/bin/env node
/**
 * build-paper.js — KCI 스타일 학술 논문 Word(.docx) 생성기
 *
 * 입력: config.json (논문 메타데이터 + 본문 + 참고문헌)
 * 출력: .docx 파일
 *
 * 사용법: node build-paper.js config.json
 */

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  PageNumber,
  PageBreak,
} = require("docx");

// ── 설정 로드 ──────────────────────────────────────────────
const configPath = process.argv[2];
if (!configPath) {
  console.error("사용법: node build-paper.js <config.json>");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const meta = config.metadata;
const outputPath = config.outputPath || "paper.docx";

// ── 스타일 상수 ──────────────────────────────────────────────
const FONT_KR = "Batang";        // 바탕체
const FONT_EN = "Times New Roman";
const FONT_SIZE_BODY = 20;       // 10pt in half-points
const FONT_SIZE_TITLE = 32;      // 16pt
const FONT_SIZE_CHAPTER = 26;    // 13pt
const FONT_SIZE_SECTION = 22;    // 11pt
const FONT_SIZE_ABSTRACT = 18;   // 9pt
const FONT_SIZE_REF = 18;        // 9pt

const LINE_SPACING = 384;        // 1.6배 줄간격 (240 * 1.6)
const PARA_SPACING_BEFORE = 120; // 6pt
const PARA_SPACING_AFTER = 120;  // 6pt

// A4 크기 (DXA)
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = 1417;             // 2.5cm

// ── 헬퍼 함수 ──────────────────────────────────────────────

function bodyParagraph(text, options = {}) {
  const runs = [];

  // 인용 처리: (저자, 연도) 패턴을 이탤릭으로 표시하지 않고 그대로 유지
  runs.push(
    new TextRun({
      text: text,
      font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
      size: options.size || FONT_SIZE_BODY,
      bold: options.bold || false,
      italics: options.italics || false,
    })
  );

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      line: LINE_SPACING,
      before: options.spacingBefore !== undefined ? options.spacingBefore : PARA_SPACING_BEFORE,
      after: options.spacingAfter !== undefined ? options.spacingAfter : PARA_SPACING_AFTER,
    },
    indent: options.indent ? { firstLine: 400 } : undefined,
    ...options.paragraphOptions,
    children: runs,
  });
}

function titleParagraph(text, level, options = {}) {
  const sizeMap = {
    title: FONT_SIZE_TITLE,
    chapter: FONT_SIZE_CHAPTER,
    section: FONT_SIZE_SECTION,
  };

  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: {
      line: LINE_SPACING,
      before: options.spacingBefore !== undefined ? options.spacingBefore : 240,
      after: options.spacingAfter !== undefined ? options.spacingAfter : 240,
    },
    keepNext: true,
    keepLines: true,
    children: [
      new TextRun({
        text: text,
        font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
        size: sizeMap[level] || FONT_SIZE_BODY,
        bold: true,
      }),
    ],
  });
}

function referenceParagraph(text) {
  return new Paragraph({
    spacing: {
      line: 320,
      before: 40,
      after: 40,
    },
    indent: { left: 400, hanging: 400 },
    children: [
      new TextRun({
        text: text,
        font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
        size: FONT_SIZE_REF,
      }),
    ],
  });
}

function emptyParagraph() {
  return new Paragraph({ children: [] });
}

// ── 문서 빌드 ──────────────────────────────────────────────

function buildDocument() {
  const children = [];

  // ── 논문 제목 (국문) ──
  children.push(titleParagraph(meta.title_kr, "title", { center: true, spacingBefore: 600 }));

  // ── 논문 제목 (영문) ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING, before: 120, after: 120 },
      children: [
        new TextRun({
          text: meta.title_en,
          font: { name: FONT_EN },
          size: 24,
          italics: true,
        }),
      ],
    })
  );

  // ── 저자/소속 ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING, before: 200, after: 60 },
      children: [
        new TextRun({
          text: meta.authors,
          font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING, before: 60, after: 300 },
      children: [
        new TextRun({
          text: meta.affiliation,
          font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
          size: 20,
          italics: true,
        }),
      ],
    })
  );

  // ── 구분선 ──
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { after: 200 },
      children: [],
    })
  );

  // ── 국문 초록 ──
  children.push(titleParagraph("국문 초록", "section", { center: true }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 320, before: 80, after: 80 },
      indent: { left: 567, right: 567 },
      children: [
        new TextRun({
          text: config.abstract_kr,
          font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
          size: FONT_SIZE_ABSTRACT,
        }),
      ],
    })
  );

  // ── 핵심 키워드 (국문) ──
  if (meta.keywords_kr && meta.keywords_kr.length > 0) {
    children.push(
      new Paragraph({
        spacing: { line: 320, before: 120, after: 200 },
        indent: { left: 567, right: 567 },
        children: [
          new TextRun({
            text: "핵심 키워드: ",
            font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
            size: FONT_SIZE_ABSTRACT,
            bold: true,
          }),
          new TextRun({
            text: meta.keywords_kr.join(", "),
            font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
            size: FONT_SIZE_ABSTRACT,
          }),
        ],
      })
    );
  }

  // ── 영문 초록 (국문 초록 바로 다음) ──
  if (config.abstract_en) {
    children.push(emptyParagraph());
    children.push(titleParagraph("ABSTRACT", "section", { center: true }));
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 320, before: 80, after: 80 },
        indent: { left: 567, right: 567 },
        children: [
          new TextRun({
            text: config.abstract_en,
            font: { name: FONT_EN },
            size: FONT_SIZE_ABSTRACT,
          }),
        ],
      })
    );
  }

  // ── Keywords (영문) ──
  if (meta.keywords_en && meta.keywords_en.length > 0) {
    children.push(
      new Paragraph({
        spacing: { line: 320, before: 120, after: 200 },
        indent: { left: 567, right: 567 },
        children: [
          new TextRun({
            text: "Keywords: ",
            font: { name: FONT_EN },
            size: FONT_SIZE_ABSTRACT,
            bold: true,
          }),
          new TextRun({
            text: meta.keywords_en.join(", "),
            font: { name: FONT_EN },
            size: FONT_SIZE_ABSTRACT,
          }),
        ],
      })
    );
  }

  // ── 구분선 ──
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { after: 300 },
      children: [],
    })
  );

  // ── 본문 섹션들 ──
  if (config.sections) {
    for (const section of config.sections) {
      // 장 제목 (I. 서론, II. 이론적 배경, ...)
      children.push(titleParagraph(`${section.number}. ${section.title}`, "chapter"));

      if (section.content) {
        // 장에 직접 content가 있는 경우
        const paragraphs = section.content.split(/\n\n+/);
        for (const p of paragraphs) {
          if (p.trim()) {
            children.push(bodyParagraph(p.trim(), { indent: true }));
          }
        }
      }

      if (section.subsections) {
        for (const sub of section.subsections) {
          // 절 제목 (1. 연구 배경, 2. 연구 목적, ...)
          children.push(titleParagraph(`${sub.number}. ${sub.title}`, "section"));

          if (sub.content) {
            const paragraphs = sub.content.split(/\n\n+/);
            for (const p of paragraphs) {
              if (p.trim()) {
                children.push(bodyParagraph(p.trim(), { indent: true }));
              }
            }
          }
        }
      }
    }
  }

  // ── 페이지 나눔: 참고문헌 ──
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── 참고문헌 ──
  children.push(titleParagraph("참고문헌", "chapter", { center: true }));
  children.push(emptyParagraph());

  if (config.references && config.references.length > 0) {
    // 국내 → 해외 분리
    const krRefs = config.references.filter(
      (r) => r.type === "kr" || r.type === "journal_kr" || r.type === "book_kr" || r.type === "thesis_kr"
    );
    const enRefs = config.references.filter(
      (r) => r.type === "en" || r.type === "journal_en" || r.type === "book_en" || r.type === "thesis_en"
    );

    // 국내 문헌
    if (krRefs.length > 0) {
      for (const ref of krRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
      children.push(emptyParagraph());
    }

    // 해외 문헌
    if (enRefs.length > 0) {
      for (const ref of enRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
    }

    // 분류되지 않은 문헌
    const otherRefs = config.references.filter(
      (r) => !r.type || (!r.type.endsWith("_kr") && !r.type.endsWith("_en") && r.type !== "kr" && r.type !== "en")
    );
    if (otherRefs.length > 0) {
      for (const ref of otherRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
    }
  }

  // ── 문서 생성 ──
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
            size: FONT_SIZE_BODY,
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: FONT_SIZE_CHAPTER, bold: true, font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN } },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: FONT_SIZE_SECTION, bold: true, font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN } },
          paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: meta.title_kr,
                    font: { name: FONT_KR, eastAsia: FONT_KR, ascii: FONT_EN },
                    size: 16,
                    italics: true,
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: { name: FONT_EN },
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  return doc;
}

// ── 메인 ──────────────────────────────────────────────
async function main() {
  try {
    const doc = buildDocument();
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    console.log(`논문 생성 완료: ${outputPath}`);
    console.log(`  제목: ${meta.title_kr}`);
    console.log(`  저자: ${meta.authors}`);
    console.log(`  섹션: ${config.sections ? config.sections.length : 0}개`);
    console.log(`  참고문헌: ${config.references ? config.references.length : 0}개`);
  } catch (err) {
    console.error("오류 발생:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
