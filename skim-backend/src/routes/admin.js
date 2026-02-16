const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Simple admin auth via shared secret
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(adminAuth);

// GET /api/admin/users — list all users
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

module.exports = router;
