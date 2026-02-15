require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { getDb, close } = require('./db');
const authRoutes = require('./routes/auth');
const papersRoutes = require('./routes/papers');
const collectionsRoutes = require('./routes/collections');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:5173'],
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
