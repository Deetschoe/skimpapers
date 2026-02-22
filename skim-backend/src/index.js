require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { getDb, close } = require('./db');
const authRoutes = require('./routes/auth');
const papersRoutes = require('./routes/papers');
const collectionsRoutes = require('./routes/collections');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
].filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Initialize database
getDb();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Skim backend running on port ${PORT}`);
});

module.exports = app;
