const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const xml2js = require('xml2js');
const multer = require('multer');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { processPdf, extractText, textToMarkdown } = require('../services/pdf');
const { analyzePaper, answerAnnotation, chatAboutPaper } = require('../services/claude');

// ─── Multer configuration for PDF uploads ─────────────────────────
const PDF_UPLOAD_DIR = '/data/pdfs';

// Ensure the upload directory exists
fs.mkdirSync(PDF_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PDF_UPLOAD_DIR);
  },
  filename: (_req, _file, cb) => {
    const uniqueName = crypto.randomUUID() + '.pdf';
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const router = express.Router();

// All paper routes require authentication
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Detect paper source from URL.
 */
function detectSource(url) {
  if (url.includes('arxiv.org')) return 'arxiv';
  if (url.includes('pubmed') || url.includes('ncbi.nlm.nih.gov')) return 'pubmed';
  if (url.includes('biorxiv.org')) return 'biorxiv';
  if (url.includes('medrxiv.org')) return 'medrxiv';
  if (url.includes('archive.org')) return 'archive';
  if (url.includes('scholar.google')) return 'scholar';
  return 'other';
}

/**
 * Extract arxiv paper ID from various URL formats.
 * Handles: arxiv.org/abs/2301.12345, arxiv.org/pdf/2301.12345, etc.
 */
function extractArxivId(url) {
  const patterns = [
    /arxiv\.org\/abs\/(\d+\.\d+(?:v\d+)?)/,
    /arxiv\.org\/pdf\/(\d+\.\d+(?:v\d+)?)/,
    /arxiv\.org\/abs\/([a-z-]+\/\d+(?:v\d+)?)/,
    /arxiv\.org\/pdf\/([a-z-]+\/\d+(?:v\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch metadata from the arxiv API.
 */
async function fetchArxivMetadata(arxivId) {
  const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
  const response = await axios.get(apiUrl, { timeout: 15000 });
  const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });

  const entry = parsed.feed.entry;
  if (!entry) {
    throw new Error('Paper not found on arxiv');
  }

  // Extract authors
  let authors = [];
  if (entry.author) {
    const authorList = Array.isArray(entry.author) ? entry.author : [entry.author];
    authors = authorList.map((a) => a.name);
  }

  // Find PDF link
  let pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
  if (entry.link) {
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const pdfLink = links.find((l) => l.$.title === 'pdf');
    if (pdfLink) {
      pdfUrl = pdfLink.$.href;
      if (!pdfUrl.endsWith('.pdf')) pdfUrl += '.pdf';
    }
  }

  // Extract published date
  const published = entry.published || entry.updated || null;

  return {
    title: (entry.title || '').replace(/\s+/g, ' ').trim(),
    authors,
    abstract: (entry.summary || '').replace(/\s+/g, ' ').trim(),
    pdfUrl,
    publishedDate: published ? published.split('T')[0] : null,
  };
}

/**
 * Extract PubMed ID from URL.
 */
function extractPubmedId(url) {
  const patterns = [
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/,
    /ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/,
    /ncbi\.nlm\.nih\.gov\/pmc\/articles\/(PMC\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch metadata from PubMed E-utilities API (free, no key needed).
 */
async function fetchPubmedMetadata(pmid) {
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
  const response = await axios.get(summaryUrl, { timeout: 15000 });
  const data = response.data;

  const doc = data.result && data.result[pmid];
  if (!doc) throw new Error('Paper not found on PubMed');

  const authors = (doc.authors || []).map((a) => a.name);
  const title = (doc.title || '').replace(/<[^>]+>/g, '').trim();
  const publishedDate = doc.pubdate || null;

  // Try to get abstract from efetch
  let abstract = '';
  try {
    const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`;
    const absResponse = await axios.get(abstractUrl, { timeout: 15000 });
    abstract = typeof absResponse.data === 'string' ? absResponse.data.trim() : '';
  } catch {
    // abstract is optional
  }

  // Try PMC for free full-text PDF
  let pdfUrl = null;
  const pmcid = (doc.articleids || []).find((a) => a.idtype === 'pmc');
  if (pmcid) {
    pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid.value}/pdf/`;
  }

  return { title, authors, abstract, pdfUrl, publishedDate };
}

/**
 * Extract bioRxiv/medRxiv DOI from URL.
 */
function extractBiorxivDoi(url) {
  const match = url.match(/(?:bio|med)rxiv\.org\/content\/(10\.\d+\/[\d.]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch metadata from bioRxiv/medRxiv API.
 */
async function fetchBiorxivMetadata(doi, server) {
  const apiUrl = `https://api.biorxiv.org/details/${server}/10.1101/${doi.split('/').pop()}/na/json`;
  const response = await axios.get(apiUrl, { timeout: 15000 });
  const collection = response.data && response.data.collection;

  if (!collection || collection.length === 0) {
    throw new Error(`Paper not found on ${server}`);
  }

  const doc = collection[0];
  const authors = (doc.authors || '').split(';').map((a) => a.trim()).filter(Boolean);
  const pdfUrl = `https://www.${server}.org/content/${doi}v${doc.version || 1}.full.pdf`;

  return {
    title: doc.title || '',
    authors,
    abstract: doc.abstract || '',
    pdfUrl,
    publishedDate: doc.date || null,
  };
}

/**
 * Try to find a PDF URL from a generic web page.
 */
async function findPdfUrl(url) {
  // If URL already points to a PDF, use it directly
  if (url.endsWith('.pdf')) {
    return url;
  }

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Skim-Research-Reader/1.0' },
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/pdf')) {
      return url;
    }

    // Try to find PDF links in HTML
    const html = typeof response.data === 'string' ? response.data : '';
    const pdfPatterns = [
      /href=["']([^"']*\.pdf)["']/gi,
      /href=["']([^"']*\/pdf\/[^"']*)["']/gi,
      /href=["']([^"']*download[^"']*\.pdf)["']/gi,
    ];

    for (const pattern of pdfPatterns) {
      const match = pattern.exec(html);
      if (match) {
        let pdfUrl = match[1];
        // Make absolute URL if relative
        if (pdfUrl.startsWith('/')) {
          const urlObj = new URL(url);
          pdfUrl = `${urlObj.origin}${pdfUrl}`;
        } else if (!pdfUrl.startsWith('http')) {
          const urlObj = new URL(url);
          pdfUrl = `${urlObj.origin}/${pdfUrl}`;
        }
        return pdfUrl;
      }
    }
  } catch (err) {
    console.error('Error fetching page to find PDF:', err.message);
  }

  return null;
}

/**
 * Format a paper row from the database into the API response shape.
 */
function formatPaper(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    authors: safeJsonParse(row.authors, []),
    abstract: row.abstract,
    url: row.url,
    pdfUrl: row.pdf_url,
    markdownContent: row.markdown_content,
    summary: row.summary,
    rating: row.rating,
    category: row.category,
    tags: safeJsonParse(row.tags, []),
    source: row.source,
    publishedDate: row.published_date,
    addedDate: row.added_date,
    isRead: Boolean(row.is_read),
  };
}

/**
 * Format a paper for list responses (omit markdownContent for performance).
 */
function formatPaperListItem(row) {
  const paper = formatPaper(row);
  delete paper.markdownContent;
  return paper;
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ─── Routes ───────────────────────────────────────────────────────

// IMPORTANT: /usage must be defined before /:id to prevent Express
// from matching "usage" as a paper ID parameter.

// GET /api/papers/usage - Get usage statistics for the authenticated user
router.get('/usage', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const paperCount = db
      .prepare('SELECT COUNT(*) as count FROM papers WHERE user_id = ?')
      .get(userId);

    const queryCount = db
      .prepare('SELECT COUNT(*) as count FROM usage WHERE user_id = ?')
      .get(userId);

    const costResult = db
      .prepare('SELECT COALESCE(SUM(cost_estimate), 0) as total FROM usage WHERE user_id = ?')
      .get(userId);

    // Period: current calendar month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const monthlyCost = db
      .prepare(
        'SELECT COALESCE(SUM(cost_estimate), 0) as total FROM usage WHERE user_id = ? AND created_at >= ? AND created_at <= ?'
      )
      .get(userId, periodStart, periodEnd);

    res.json({
      totalPapers: paperCount.count,
      totalQueries: queryCount.count,
      apiCostEstimate: Math.round(costResult.total * 10000) / 10000,
      monthlyCost: Math.round(monthlyCost.total * 10000) / 10000,
      periodStart,
      periodEnd,
    });
  } catch (err) {
    console.error('Error fetching usage:', err);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// GET /api/papers - List all papers for the authenticated user
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const papers = db
      .prepare('SELECT * FROM papers WHERE user_id = ? ORDER BY added_date DESC')
      .all(req.user.id);

    res.json(papers.map(formatPaperListItem));
  } catch (err) {
    console.error('Error fetching papers:', err);
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

// POST /api/papers - Add a new paper by URL (core pipeline)
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const db = getDb();
    const userId = req.user.id;

    // Check for duplicate
    const existing = db
      .prepare('SELECT id FROM papers WHERE user_id = ? AND url = ?')
      .get(userId, url);
    if (existing) {
      return res.status(409).json({
        error: 'Paper already added',
        paperId: existing.id,
      });
    }

    // Step 1: Detect source
    const source = detectSource(url);
    let title = null;
    let authors = [];
    let abstract = null;
    let pdfUrl = null;
    let publishedDate = null;

    // Step 2-4: Fetch metadata based on source
    if (source === 'arxiv') {
      const arxivId = extractArxivId(url);
      if (!arxivId) {
        return res.status(400).json({ error: 'Could not extract arxiv paper ID from URL' });
      }
      const metadata = await fetchArxivMetadata(arxivId);
      title = metadata.title;
      authors = metadata.authors;
      abstract = metadata.abstract;
      pdfUrl = metadata.pdfUrl;
      publishedDate = metadata.publishedDate;
    } else if (source === 'pubmed') {
      const pmid = extractPubmedId(url);
      if (!pmid) {
        return res.status(400).json({ error: 'Could not extract PubMed ID from URL' });
      }
      const metadata = await fetchPubmedMetadata(pmid);
      title = metadata.title;
      authors = metadata.authors;
      abstract = metadata.abstract;
      pdfUrl = metadata.pdfUrl;
      publishedDate = metadata.publishedDate;
      // PubMed papers aren't always open-access, fall back to generic PDF finder
      if (!pdfUrl) {
        pdfUrl = await findPdfUrl(url);
      }
    } else if (source === 'biorxiv' || source === 'medrxiv') {
      const doi = extractBiorxivDoi(url);
      if (doi) {
        try {
          const server = source === 'biorxiv' ? 'biorxiv' : 'medrxiv';
          const metadata = await fetchBiorxivMetadata(doi, server);
          title = metadata.title;
          authors = metadata.authors;
          abstract = metadata.abstract;
          pdfUrl = metadata.pdfUrl;
          publishedDate = metadata.publishedDate;
        } catch {
          // Fall through to generic PDF finder
          pdfUrl = await findPdfUrl(url);
        }
      } else {
        pdfUrl = await findPdfUrl(url);
      }
    } else {
      // For other sources (scholar, archive, generic), try to find a PDF URL
      pdfUrl = await findPdfUrl(url);
    }

    if (!pdfUrl) {
      return res.status(400).json({
        error: 'Could not find a PDF link on this page. Try providing a direct PDF URL.',
      });
    }

    // Step 5-7: Download PDF, extract text, convert to markdown
    let markdown;
    try {
      const result = await processPdf(pdfUrl);
      markdown = result.markdown;

      if (!markdown || markdown.trim().length < 100) {
        return res.status(422).json({
          error: 'Could not extract sufficient text from the PDF. The file may be scanned or image-based.',
        });
      }
    } catch (err) {
      console.error('PDF processing error:', err);
      return res.status(422).json({
        error: `Failed to process PDF: ${err.message}`,
      });
    }

    // Step 8-9: Claude analysis
    let analysis;
    try {
      analysis = await analyzePaper(markdown, userId);
    } catch (err) {
      console.error('Claude analysis error:', err);
      // Save the paper even if Claude fails, with empty analysis
      analysis = {
        summary: null,
        rating: null,
        category: 'Other',
        tags: [],
        keyFindings: [],
        costEstimate: 0,
      };
    }

    // Use Claude's analysis for title if we didn't get one from metadata
    if (!title) {
      // Try to extract title from the first line of markdown
      const firstLine = markdown.split('\n').find((l) => l.trim().length > 0);
      title = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : 'Untitled Paper';
    }

    // Step 10: Save to database
    const paperId = crypto.randomUUID();
    const addedDate = new Date().toISOString();

    // Merge key findings into the summary if available
    let fullSummary = analysis.summary || '';
    if (analysis.keyFindings && analysis.keyFindings.length > 0) {
      fullSummary += '\n\n**Key Findings:**\n' + analysis.keyFindings.map((f) => `- ${f}`).join('\n');
    }

    db.prepare(`
      INSERT INTO papers (id, user_id, title, authors, abstract, url, pdf_url, markdown_content, summary, rating, category, tags, source, published_date, added_date, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paperId,
      userId,
      title,
      JSON.stringify(authors),
      abstract,
      url,
      pdfUrl,
      markdown,
      fullSummary,
      analysis.rating,
      analysis.category,
      JSON.stringify(analysis.tags),
      source,
      publishedDate,
      addedDate,
      0
    );

    // Step 11: Return the paper
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
    res.status(201).json(formatPaper(paper));
  } catch (err) {
    console.error('Error adding paper:', err);
    res.status(500).json({ error: 'Failed to add paper' });
  }
});

// GET /api/papers/search - Search arXiv + PubMed for papers
router.get('/search', async (req, res) => {
  try {
    const { q, start = 0, max = 10, source: sourceFilter } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const maxNum = Math.min(parseInt(max, 10) || 10, 20);

    // Run arXiv and PubMed searches in parallel
    const searches = [];

    if (!sourceFilter || sourceFilter === 'arxiv' || sourceFilter === 'all') {
      searches.push(searchArxiv(q, parseInt(start, 10) || 0, maxNum));
    }
    if (!sourceFilter || sourceFilter === 'pubmed' || sourceFilter === 'all') {
      searches.push(searchPubmed(q, parseInt(start, 10) || 0, maxNum));
    }

    const settled = await Promise.allSettled(searches);
    let allResults = [];
    let totalCount = 0;

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allResults = allResults.concat(result.value.results);
        totalCount += result.value.total;
      }
    }

    // Sort by date (newest first), then deduplicate by title similarity
    allResults.sort((a, b) => {
      if (a.publishedDate && b.publishedDate) return b.publishedDate.localeCompare(a.publishedDate);
      if (a.publishedDate) return -1;
      if (b.publishedDate) return 1;
      return 0;
    });

    res.json({ results: allResults.slice(0, maxNum), total: totalCount });
  } catch (err) {
    console.error('Error searching papers:', err);
    res.status(500).json({ error: 'Failed to search papers' });
  }
});

/**
 * Search arXiv API.
 */
async function searchArxiv(query, start, max) {
  const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=${start}&max_results=${max}&sortBy=relevance&sortOrder=descending`;
  const response = await axios.get(apiUrl, { timeout: 15000 });
  const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });

  const totalResults = parseInt(parsed.feed['opensearch:totalResults']._ || parsed.feed['opensearch:totalResults'], 10) || 0;

  let entries = parsed.feed.entry;
  if (!entries) return { results: [], total: 0 };
  if (!Array.isArray(entries)) entries = [entries];

  const results = entries.map((entry) => {
    let authors = [];
    if (entry.author) {
      const authorList = Array.isArray(entry.author) ? entry.author : [entry.author];
      authors = authorList.map((a) => a.name);
    }

    let pdfUrl = null;
    if (entry.link) {
      const links = Array.isArray(entry.link) ? entry.link : [entry.link];
      const pdfLink = links.find((l) => l.$ && l.$.title === 'pdf');
      if (pdfLink) {
        pdfUrl = pdfLink.$.href;
        if (!pdfUrl.endsWith('.pdf')) pdfUrl += '.pdf';
      }
    }

    return {
      title: (entry.title || '').replace(/\s+/g, ' ').trim(),
      authors,
      abstract: (entry.summary || '').replace(/\s+/g, ' ').trim(),
      url: entry.id || '',
      pdfUrl,
      publishedDate: (entry.published || entry.updated || '').split('T')[0] || null,
      source: 'arxiv',
    };
  });

  return { results, total: totalResults };
}

/**
 * Search PubMed E-utilities API (free, no key needed).
 */
async function searchPubmed(query, start, max) {
  // Step 1: Search for IDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retstart=${start}&retmax=${max}&sort=relevance&retmode=json`;
  const searchRes = await axios.get(searchUrl, { timeout: 15000 });
  const searchData = searchRes.data;

  const idList = searchData.esearchresult && searchData.esearchresult.idlist;
  const totalCount = parseInt(searchData.esearchresult && searchData.esearchresult.count, 10) || 0;

  if (!idList || idList.length === 0) return { results: [], total: 0 };

  // Step 2: Fetch summaries for found IDs
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
  const summaryRes = await axios.get(summaryUrl, { timeout: 15000 });
  const summaryData = summaryRes.data;

  const results = idList.map((pmid) => {
    const doc = summaryData.result && summaryData.result[pmid];
    if (!doc) return null;

    const authors = (doc.authors || []).map((a) => a.name);
    const title = (doc.title || '').replace(/<[^>]+>/g, '').trim();

    return {
      title,
      authors,
      abstract: doc.sorttitle || '',
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      pdfUrl: null,
      publishedDate: doc.pubdate ? doc.pubdate.replace(/\s+/g, '-') : null,
      source: 'pubmed',
    };
  }).filter(Boolean);

  return { results, total: totalCount };
}

// POST /api/papers/upload - Add a new paper by PDF file upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A PDF file is required. Send it as multipart form data with field name "file".' });
    }

    const db = getDb();
    const userId = req.user.id;
    const filePath = req.file.path;

    // Step 1: Read the uploaded PDF and extract text
    let markdown;
    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const rawText = await extractText(pdfBuffer);
      markdown = textToMarkdown(rawText);

      if (!markdown || markdown.trim().length < 100) {
        return res.status(422).json({
          error: 'Could not extract sufficient text from the PDF. The file may be scanned or image-based.',
        });
      }
    } catch (err) {
      console.error('PDF processing error:', err);
      return res.status(422).json({
        error: `Failed to process PDF: ${err.message}`,
      });
    }

    // Step 2: Determine title (no Claude analysis — save tokens)
    let title = req.body.title || null;
    if (!title) {
      const firstLine = markdown.split('\n').find((l) => l.trim().length > 0);
      title = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : 'Untitled Paper';
    }

    // Step 3: Save to database
    const paperId = crypto.randomUUID();
    const addedDate = new Date().toISOString();

    db.prepare(`
      INSERT INTO papers (id, user_id, title, authors, abstract, url, pdf_url, markdown_content, summary, rating, category, tags, source, published_date, added_date, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paperId,
      userId,
      title,
      JSON.stringify([]),
      null,
      '',
      filePath,
      markdown,
      null,
      null,
      'Other',
      JSON.stringify([]),
      'upload',
      null,
      addedDate,
      0
    );

    // Step 5: Return the paper
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
    res.status(201).json(formatPaper(paper));
  } catch (err) {
    // Handle multer errors specifically
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 100 MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error('Error uploading paper:', err);
    res.status(500).json({ error: 'Failed to upload paper' });
  }
});

// GET /api/papers/:id/pdf - Serve the PDF file for a paper
router.get('/:id/pdf', (req, res) => {
  try {
    const db = getDb();
    const paper = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    if (paper.source === 'upload' && paper.pdf_url) {
      // Uploaded PDF — serve from disk
      const pdfPath = path.resolve(paper.pdf_url);
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ error: 'PDF file not found on disk' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.sendFile(pdfPath);
    } else if (paper.pdf_url) {
      // External PDF — redirect
      res.redirect(paper.pdf_url);
    } else {
      res.status(404).json({ error: 'No PDF available for this paper' });
    }
  } catch (err) {
    console.error('Error serving PDF:', err);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

// GET /api/papers/:id - Get a single paper with full content
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const paper = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.json(formatPaper(paper));
  } catch (err) {
    console.error('Error fetching paper:', err);
    res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

// DELETE /api/papers/:id - Delete a paper
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM papers WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting paper:', err);
    res.status(500).json({ error: 'Failed to delete paper' });
  }
});

// POST /api/papers/:id/chat - Multi-turn AI chat about a paper
router.post('/:id/chat', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const paperId = req.params.id;

    const paper = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(paperId, userId);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    if (!paper.markdown_content) {
      return res.status(400).json({ error: 'Paper has no content to chat about' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const result = await chatAboutPaper(paper.markdown_content, messages, userId);
    res.json({ response: result.response });
  } catch (err) {
    console.error('Error in paper chat:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

// GET /api/papers/:id/annotations - Get annotations for a paper
router.get('/:id/annotations', (req, res) => {
  try {
    const db = getDb();

    // Verify paper belongs to user
    const paper = db
      .prepare('SELECT id FROM papers WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const annotations = db
      .prepare('SELECT * FROM annotations WHERE paper_id = ? AND user_id = ? ORDER BY created_at DESC')
      .all(req.params.id, req.user.id);

    res.json(
      annotations.map((a) => ({
        id: a.id,
        paperId: a.paper_id,
        userId: a.user_id,
        selectedText: a.selected_text,
        note: a.note,
        aiResponse: a.ai_response,
        pageNumber: a.page_number,
        createdAt: a.created_at,
      }))
    );
  } catch (err) {
    console.error('Error fetching annotations:', err);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// POST /api/papers/:id/annotations - Create an annotation
router.post('/:id/annotations', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const paperId = req.params.id;

    // Verify paper belongs to user
    const paper = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(paperId, userId);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const { selectedText, note, aiResponse, pageNumber } = req.body;

    if (!selectedText && !note) {
      return res.status(400).json({ error: 'Either selectedText or note is required' });
    }

    // If note is provided and no AI response yet, optionally generate one
    let finalAiResponse = aiResponse || null;
    if (note && !aiResponse && paper.markdown_content) {
      try {
        const result = await answerAnnotation(
          paper.markdown_content,
          selectedText || '',
          note,
          userId
        );
        finalAiResponse = result.aiResponse;
      } catch (err) {
        console.error('AI annotation response error:', err);
        // Continue without AI response
      }
    }

    const annotationId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO annotations (id, paper_id, user_id, selected_text, note, ai_response, page_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(annotationId, paperId, userId, selectedText || null, note || null, finalAiResponse, pageNumber || null, createdAt);

    res.status(201).json({
      id: annotationId,
      paperId,
      userId,
      selectedText: selectedText || null,
      note: note || null,
      aiResponse: finalAiResponse,
      pageNumber: pageNumber || null,
      createdAt,
    });
  } catch (err) {
    console.error('Error creating annotation:', err);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

module.exports = router;
