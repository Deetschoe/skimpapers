const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { sendLoginCode } = require('../services/email');

const router = express.Router();

const CODE_EXPIRY_MINUTES = 15;
const VALID_ACCESS_CODE = process.env.ACCESS_CODE || '';
if (!VALID_ACCESS_CODE) {
  console.warn('WARNING: ACCESS_CODE not set — new user registration will be blocked');
}

// POST /api/auth/check-email
router.post('/check-email', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());

    res.json({ exists: !!user });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// POST /api/auth/request-code
router.post('/request-code', async (req, res) => {
  try {
    const { email, accessCode } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase();
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);

    // New users must provide the valid access code
    if (!existingUser) {
      if (!accessCode || accessCode.toLowerCase() !== VALID_ACCESS_CODE) {
        return res.status(401).json({ error: 'Invalid access code' });
      }
    }

    // Invalidate previous unused codes for this email
    db.prepare('UPDATE login_codes SET is_used = 1 WHERE email = ? AND is_used = 0').run(normalizedEmail);

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)
      .toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    db.prepare('INSERT INTO login_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)').run(
      id, normalizedEmail, code, expiresAt
    );

    // Send code via email
    try {
      await sendLoginCode(normalizedEmail, code);
    } catch (emailErr) {
      console.error('Failed to send login code:', emailErr);
      return res.status(502).json({ error: 'Failed to send login code. Please try again.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Request code error:', err);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase();

    // Find valid login code
    const loginCode = db.prepare(
      "SELECT * FROM login_codes WHERE email = ? AND code = ? AND is_used = 0 AND expires_at > datetime('now')"
    ).get(normalizedEmail, code);

    if (!loginCode) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // Mark code as used
    db.prepare('UPDATE login_codes SET is_used = 1 WHERE id = ?').run(loginCode.id);

    // Find or create user
    let user = db.prepare('SELECT id, email, created_at FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      const userId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').run(
        userId, normalizedEmail, createdAt
      );
      user = { id: userId, email: normalizedEmail, created_at: createdAt };
    }

    // Generate JWT (30 days)
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
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// GET /api/auth/validate
router.get('/validate', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
