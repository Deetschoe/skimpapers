const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All collection routes require authentication
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function formatPaperListItem(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    authors: safeJsonParse(row.authors, []),
    abstract: row.abstract,
    url: row.url,
    pdfUrl: row.pdf_url,
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

// ─── Routes ───────────────────────────────────────────────────────

// GET /api/collections - List all collections for the authenticated user (with paper count)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const collections = db
      .prepare(`
        SELECT c.*, COUNT(cp.paper_id) as paper_count
        FROM collections c
        LEFT JOIN collection_papers cp ON c.id = cp.collection_id
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `)
      .all(req.user.id);

    res.json(
      collections.map((c) => ({
        id: c.id,
        userId: c.user_id,
        name: c.name,
        icon: c.icon,
        colorName: c.color_name,
        paperCount: c.paper_count,
        createdAt: c.created_at,
      }))
    );
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// POST /api/collections - Create a new collection
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { name, icon, colorName } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO collections (id, user_id, name, icon, color_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, icon || 'folder.fill', colorName || 'accent', createdAt);

    res.status(201).json({
      id,
      userId,
      name,
      icon: icon || 'folder.fill',
      colorName: colorName || 'accent',
      paperCount: 0,
      createdAt,
    });
  } catch (err) {
    console.error('Error creating collection:', err);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// PUT /api/collections/:id - Update a collection
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const collectionId = req.params.id;
    const { name, icon, colorName } = req.body;

    const existing = db
      .prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?')
      .get(collectionId, userId);

    if (!existing) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const updatedName = name !== undefined ? name : existing.name;
    const updatedIcon = icon !== undefined ? icon : existing.icon;
    const updatedColorName = colorName !== undefined ? colorName : existing.color_name;

    db.prepare(`
      UPDATE collections SET name = ?, icon = ?, color_name = ? WHERE id = ? AND user_id = ?
    `).run(updatedName, updatedIcon, updatedColorName, collectionId, userId);

    const paperCount = db
      .prepare('SELECT COUNT(*) as count FROM collection_papers WHERE collection_id = ?')
      .get(collectionId);

    res.json({
      id: collectionId,
      userId,
      name: updatedName,
      icon: updatedIcon,
      colorName: updatedColorName,
      paperCount: paperCount.count,
      createdAt: existing.created_at,
    });
  } catch (err) {
    console.error('Error updating collection:', err);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// DELETE /api/collections/:id - Delete a collection
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM collections WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting collection:', err);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// GET /api/collections/:id/papers - List papers in a collection
router.get('/:id/papers', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const collectionId = req.params.id;

    // Verify collection belongs to user
    const collection = db
      .prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?')
      .get(collectionId, userId);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const papers = db
      .prepare(`
        SELECT p.*, cp.added_at as collection_added_at
        FROM papers p
        INNER JOIN collection_papers cp ON p.id = cp.paper_id
        WHERE cp.collection_id = ?
        ORDER BY cp.added_at DESC
      `)
      .all(collectionId);

    res.json(papers.map(formatPaperListItem));
  } catch (err) {
    console.error('Error fetching collection papers:', err);
    res.status(500).json({ error: 'Failed to fetch collection papers' });
  }
});

// POST /api/collections/:id/papers - Add a paper to a collection
router.post('/:id/papers', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const collectionId = req.params.id;
    const { paperId } = req.body;

    if (!paperId) {
      return res.status(400).json({ error: 'paperId is required' });
    }

    // Verify collection belongs to user
    const collection = db
      .prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?')
      .get(collectionId, userId);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Verify paper belongs to user
    const paper = db
      .prepare('SELECT id FROM papers WHERE id = ? AND user_id = ?')
      .get(paperId, userId);

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Check if already in collection
    const existing = db
      .prepare('SELECT collection_id FROM collection_papers WHERE collection_id = ? AND paper_id = ?')
      .get(collectionId, paperId);

    if (existing) {
      return res.status(409).json({ error: 'Paper already in collection' });
    }

    const addedAt = new Date().toISOString();
    db.prepare('INSERT INTO collection_papers (collection_id, paper_id, added_at) VALUES (?, ?, ?)').run(
      collectionId,
      paperId,
      addedAt
    );

    res.status(201).json({ success: true, collectionId, paperId, addedAt });
  } catch (err) {
    console.error('Error adding paper to collection:', err);
    res.status(500).json({ error: 'Failed to add paper to collection' });
  }
});

// DELETE /api/collections/:id/papers/:paperId - Remove a paper from a collection
router.delete('/:id/papers/:paperId', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const collectionId = req.params.id;
    const paperId = req.params.paperId;

    // Verify collection belongs to user
    const collection = db
      .prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?')
      .get(collectionId, userId);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const result = db
      .prepare('DELETE FROM collection_papers WHERE collection_id = ? AND paper_id = ?')
      .run(collectionId, paperId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Paper not found in collection' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing paper from collection:', err);
    res.status(500).json({ error: 'Failed to remove paper from collection' });
  }
});

module.exports = router;
