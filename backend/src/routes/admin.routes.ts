import express from 'express';
import { adminLogin, validateAdminToken, requireAdminAuth } from '../middleware/adminAuth';

const router = express.Router();

/**
 * Admin login endpoint
 * POST /api/admin/login
 */
router.post('/login', adminLogin);

/**
 * Admin token validation endpoint
 * GET /api/admin/validate
 */
router.get('/validate', requireAdminAuth, validateAdminToken);

/**
 * Admin logout endpoint (client-side token removal)
 * POST /api/admin/logout
 */
router.post('/logout', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Admin logged out successfully'
  });
});

export default router; 