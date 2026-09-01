// utils/convert.js — small, dependency-free converter from the editor's
// HTML to Markdown, used by the export stretch feature. Intentionally
// narrow: covers exactly the tags Tiptap's StarterKit produces (h1-h3,
// p, strong, em, u, ul/ol/li), not a general HTML parser - consistent
// in spirit with the existing Markdown -> HTML converter in
// routes/upload.js, just running the other direction.
//
// parseBlocks() is shared by both the Markdown and PDF exporters (see
// routes/documents.js), so the two export formats walk the exact same
// structured representation of the document and can't drift out of
// sync with each other.
//
// Known simplification: bold/italic within a block are rendered as
// literal **/* markers by stripInline() below. For Markdown export
// that's correct output. For PDF export it means emphasis shows as
// literal asterisks rather than actual bold/italic glyphs - true
// per-character rich-text layout in a PDF is a meaningfully bigger
// problem than the rest of this feature, so it's called out here and
// in ARCHITECTURE.md rather than silently glossed over.

function stripInline(html) {
  return html
    .replace(/<strong>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<em>(.*?)<\/em>/gis, "*$1*")
    .replace(/<u>(.*?)<\/u>/gis, "$1") // Markdown has no native underline; drop the tag, keep the text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Splits editor HTML into an ordered list of blocks:
// { type: 'h1'|'h2'|'h3'|'p'|'li'|'oli', text, index? }
function parseBlocks(html) {
  const blocks = [];
  const blockRegex = /<(h1|h2|h3|p)>(.*?)<\/\1>|<ul>(.*?)<\/ul>|<ol>(.*?)<\/ol>/gis;
  let match;
  while ((match = blockRegex.exec(html || "")) !== null) {
    if (match[1]) {
      const text = stripInline(match[2]);
      if (text) blocks.push({ type: match[1], text });
    } else if (match[3] !== undefined) {
      for (const li of match[3].matchAll(/<li>(.*?)<\/li>/gis)) {
        blocks.push({ type: "li", text: stripInline(li[1]) });
      }
    } else if (match[4] !== undefined) {
      let i = 0;
      for (const li of match[4].matchAll(/<li>(.*?)<\/li>/gis)) {
        i += 1;
        blocks.push({ type: "oli", text: stripInline(li[1]), index: i });
      }
    }
  }
  return blocks;
}

function htmlToMarkdown(html) {
  const blocks = parseBlocks(html);
  return blocks
    .map((b) => {
      if (b.type === "h1") return `# ${b.text}`;
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "h3") return `### ${b.text}`;
      if (b.type === "li") return `- ${b.text}`;
      if (b.type === "oli") return `${b.index}. ${b.text}`;
      return b.text;
    })
    .join("\n\n");
}

module.exports = { parseBlocks, htmlToMarkdown };
