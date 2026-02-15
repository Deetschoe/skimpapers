const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 12;

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = new Date().toISOString();

    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      email.toLowerCase(),
      passwordHash,
      createdAt
    );

    const token = generateToken(id);

    res.status(201).json({
      user: { id, email: email.toLowerCase(), createdAt },
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// GET /api/auth/validate
router.get('/validate', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
