import express from 'express';

const router = express.Router();

// Main health check endpoint for white label service
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'SWAPS White Label API is healthy',
    timestamp: new Date().toISOString(),
    service: 'SWAPS White Label API',
    version: '1.0.0'
  });
});

export default router; 