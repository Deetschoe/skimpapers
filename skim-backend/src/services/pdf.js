const axios = require('axios');
const pdfParse = require('pdf-parse');

/**
 * Download a PDF from the given URL and return its buffer.
 */
async function downloadPdf(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: 100 * 1024 * 1024, // 100 MB limit
    headers: {
      'User-Agent': 'Skim-Research-Reader/1.0',
      Accept: 'application/pdf',
    },
  });

  return Buffer.from(response.data);
}

/**
 * Extract text content from a PDF buffer using pdf-parse.
 */
async function extractText(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  return data.text;
}

/**
 * Convert raw extracted text into clean markdown.
 * Applies heuristics to detect headings, paragraphs, and lists.
 */
function textToMarkdown(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return '';
  }

  const lines = rawText.split('\n');
  const markdownLines = [];
  let prevLineEmpty = false;

  // Common section heading patterns in research papers
  const sectionPatterns = [
    /^(abstract|introduction|background|methods?|methodology|results?|discussion|conclusion|conclusions|references|acknowledgements?|appendix|supplementary|related work|literature review|future work|limitations)$/i,
    /^(\d+\.?\s+)(abstract|introduction|background|methods?|methodology|results?|discussion|conclusion|conclusions|references|acknowledgements?|appendix|supplementary|related work|literature review|future work|limitations)/i,
    /^([IVXLC]+\.?\s+)/,
  ];

  // Subsection pattern: starts with a number like "2.1" or "3.1.2"
  const subsectionPattern = /^(\d+\.\d+\.?\d*\.?\s+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines but track them
    if (line.length === 0) {
      if (!prevLineEmpty) {
        markdownLines.push('');
      }
      prevLineEmpty = true;
      continue;
    }

    prevLineEmpty = false;

    // Detect section headings
    let isHeading = false;
    for (const pattern of sectionPatterns) {
      if (pattern.test(line)) {
        markdownLines.push('');
        markdownLines.push(`## ${line}`);
        markdownLines.push('');
        isHeading = true;
        break;
      }
    }

    if (isHeading) continue;

    // Detect subsection headings
    if (subsectionPattern.test(line) && line.length < 100) {
      markdownLines.push('');
      markdownLines.push(`### ${line}`);
      markdownLines.push('');
      continue;
    }

    // Detect title (first substantial non-empty line, typically all caps or long)
    if (
      i < 5 &&
      markdownLines.filter((l) => l.trim().length > 0).length === 0 &&
      line.length > 10
    ) {
      markdownLines.push(`# ${line}`);
      markdownLines.push('');
      continue;
    }

    // Detect bullet points
    if (/^[\-\u2022\u2023\u25E6\u2043\u2219]\s/.test(line)) {
      markdownLines.push(`- ${line.replace(/^[\-\u2022\u2023\u25E6\u2043\u2219]\s*/, '')}`);
      continue;
    }

    // Detect numbered lists
    if (/^\(\d+\)\s/.test(line) || /^[a-z]\)\s/.test(line)) {
      markdownLines.push(`- ${line}`);
      continue;
    }

    // Regular paragraph text
    markdownLines.push(line);
  }

  // Clean up excessive blank lines
  let result = markdownLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

/**
 * Full pipeline: download PDF from URL, extract text, convert to markdown.
 */
async function processPdf(pdfUrl) {
  const buffer = await downloadPdf(pdfUrl);
  const rawText = await extractText(buffer);
  const markdown = textToMarkdown(rawText);

  return {
    rawText,
    markdown,
    pageCount: (await pdfParse(buffer)).numpages,
  };
}

module.exports = { downloadPdf, extractText, textToMarkdown, processPdf };
