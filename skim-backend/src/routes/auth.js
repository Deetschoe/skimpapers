const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { sendLoginCode } = require('../services/email');

const router = express.Router();

const OTP_EXPIRY_MINUTES = 10;
const SHARED_ACCESS_CODE = 'dieter';

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

    // New users must provide the shared access code
    if (!existingUser) {
      if (!accessCode || accessCode.toLowerCase() !== SHARED_ACCESS_CODE) {
        return res.status(401).json({ error: 'Valid access code required for new accounts' });
      }
    }

    // Invalidate previous unused OTPs for this email
    db.prepare("UPDATE email_otps SET is_used = 1 WHERE email = ? AND is_used = 0").run(normalizedEmail);

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    db.prepare('INSERT INTO email_otps (id, email, code, expires_at) VALUES (?, ?, ?, ?)').run(
      id, normalizedEmail, code, expiresAt
    );

    // Send code via email
    sendLoginCode(normalizedEmail, code).catch(err =>
      console.error('Failed to send login code:', err)
    );

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

    // Find valid OTP
    const otp = db.prepare(
      "SELECT * FROM email_otps WHERE email = ? AND code = ? AND is_used = 0 AND expires_at > datetime('now')"
    ).get(normalizedEmail, code);

    if (!otp) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // Mark OTP as used
    db.prepare('UPDATE email_otps SET is_used = 1 WHERE id = ?').run(otp.id);

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      const userId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, NULL, ?)').run(
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
