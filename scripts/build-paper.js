#!/usr/bin/env node
/**
 * build-paper.js â KCI ì¤íì¼ íì  ë¼ë¬¸ Word(.docx) ìì±ê¸°
 *
 * ìë ¥: config.json (ë¼ë¬¸ ë©íë°ì´í° + ë³¸ë¬¸ + ì°¸ê³ ë¬¸í)
 * ì¶ë ¥: .docx íì¼
 *
 * ì¬ì©ë²: node build-paper.js config.json
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

// ââ ì¤ì  ë¡ë ââââââââââââââââââââââââââââââââââââââââââââââ
const configPath = process.argv[2];
if (!configPath) {
  console.error("ì¬ì©ë²: node build-paper.js <config.json>");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const meta = config.metadata;
const outputPath = config.outputPath || "paper.docx";

// ââ ì¤íì¼ ìì ââââââââââââââââââââââââââââââââââââââââââââââ
const FONT_KR = "Batang";        // ë°íì²´
const FONT_EN = "Times New Roman";
const FONT_SIZE_BODY = 20;       // 10pt in half-points
const FONT_SIZE_TITLE = 32;      // 16pt
const FONT_SIZE_CHAPTER = 26;    // 13pt
const FONT_SIZE_SECTION = 22;    // 11pt
const FONT_SIZE_ABSTRACT = 18;   // 9pt
const FONT_SIZE_REF = 18;        // 9pt

const LINE_SPACING = 384;        // 1.6ë°° ì¤ê°ê²© (240 * 1.6)
const PARA_SPACING_BEFORE = 120; // 6pt
const PARA_SPACING_AFTER = 120;  // 6pt

// A4 í¬ê¸° (DXA)
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = 1417;             // 2.5cm

// ââ í¬í¼ í¨ì ââââââââââââââââââââââââââââââââââââââââââââââ

function bodyParagraph(text, options = {}) {
  const runs = [];

  // ì¸ì© ì²ë¦¬: (ì ì, ì°ë) í¨í´ì ì´í¤ë¦­ì¼ë¡ íìíì§ ìê³  ê·¸ëë¡ ì ì§
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

// ââ ë¬¸ì ë¹ë ââââââââââââââââââââââââââââââââââââââââââââââ

function buildDocument() {
  const children = [];

  // ââ ë¼ë¬¸ ì ëª© (êµ­ë¬¸) ââ
  children.push(titleParagraph(meta.title_kr, "title", { center: true, spacingBefore: 600 }));

  // ââ ë¼ë¬¸ ì ëª© (ìë¬¸) ââ
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

  // ââ ì ì/ìì ââ
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

  // ââ êµ¬ë¶ì  ââ
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { after: 200 },
      children: [],
    })
  );

  // ââ êµ­ë¬¸ ì´ë¡ ââ
  children.push(titleParagraph("êµ­ë¬¸ ì´ë¡", "section", { center: true }));
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

  // ââ íµì¬ í¤ìë (êµ­ë¬¸) ââ
  if (meta.keywords_kr && meta.keywords_kr.length > 0) {
    children.push(
      new Paragraph({
        spacing: { line: 320, before: 120, after: 200 },
        indent: { left: 567, right: 567 },
        children: [
          new TextRun({
            text: "íµì¬ í¤ìë: ",
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

  // ââ ìë¬¸ ì´ë¡ (êµ­ë¬¸ ì´ë¡ ë°ë¡ ë¤ì) ââ
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

  // ââ Keywords (ìë¬¸) ââ
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

  // ââ êµ¬ë¶ì  ââ
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { after: 300 },
      children: [],
    })
  );

  // ââ ë³¸ë¬¸ ì¹ìë¤ ââ
  if (config.sections) {
    for (const section of config.sections) {
      // ì¥ ì ëª© (I. ìë¡ , II. ì´ë¡ ì  ë°°ê²½, ...)
      children.push(titleParagraph(`${section.number}. ${section.title}`, "chapter"));

      if (section.content) {
        // ì¥ì ì§ì  contentê° ìë ê²½ì°
        const paragraphs = section.content.split(/\n\n+/);
        for (const p of paragraphs) {
          if (p.trim()) {
            children.push(bodyParagraph(p.trim(), { indent: true }));
          }
        }
      }

      if (section.subsections) {
        for (const sub of section.subsections) {
          // ì  ì ëª© (1. ì°êµ¬ ë°°ê²½, 2. ì°êµ¬ ëª©ì , ...)
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

  // ââ íì´ì§ ëë: ì°¸ê³ ë¬¸í ââ
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ââ ì°¸ê³ ë¬¸í ââ
  children.push(titleParagraph("ì°¸ê³ ë¬¸í", "chapter", { center: true }));
  children.push(emptyParagraph());

  if (config.references && config.references.length > 0) {
    // êµ­ë´ â í´ì¸ ë¶ë¦¬
    const krRefs = config.references.filter(
      (r) => r.type === "kr" || r.type === "journal_kr" || r.type === "book_kr" || r.type === "thesis_kr"
    );
    const enRefs = config.references.filter(
      (r) => r.type === "en" || r.type === "journal_en" || r.type === "book_en" || r.type === "thesis_en"
    );

    // êµ­ë´ ë¬¸í
    if (krRefs.length > 0) {
      for (const ref of krRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
      children.push(emptyParagraph());
    }

    // í´ì¸ ë¬¸í
    if (enRefs.length > 0) {
      for (const ref of enRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
    }

    // ë¶ë¥ëì§ ìì ë¬¸í
    const otherRefs = config.references.filter(
      (r) => !r.type || (!r.type.endsWith("_kr") && !r.type.endsWith("_en") && r.type !== "kr" && r.type !== "en")
    );
    if (otherRefs.length > 0) {
      for (const ref of otherRefs) {
        children.push(referenceParagraph(ref.formatted));
      }
    }
  }

  // ââ ë¬¸ì ìì± ââ
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

// ââ ë©ì¸ ââââââââââââââââââââââââââââââââââââââââââââââ
async function main() {
  try {
    const doc = buildDocument();
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    console.log(`ë¼ë¬¸ ìì± ìë£: ${outputPath}`);
    console.log(`  ì ëª©: ${meta.title_kr}`);
    console.log(`  ì ì: ${meta.authors}`);
    console.log(`  ì¹ì: ${config.sections ? config.sections.length : 0}ê°`);
    console.log(`  ì°¸ê³ ë¬¸í: ${config.references ? config.references.length : 0}ê°`);
  } catch (err) {
    console.error("ì¤ë¥ ë°ì:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
