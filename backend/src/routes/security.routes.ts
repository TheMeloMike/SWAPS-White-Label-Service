import { Router } from 'express';
import { SecurityInitializer } from '../utils/security/SecurityInitializer';
import { StructuredFileLogger } from '../utils/logging/StructuredFileLogger';
import { PersistentRateLimit } from '../middleware/PersistentRateLimit';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

/**
 * Security health check endpoint
 * Requires admin authentication
 */
router.get('/health', adminAuth, async (req, res) => {
  try {
    const securityInit = SecurityInitializer.getInstance();
    const healthCheck = await securityInit.performHealthCheck();
    
    // Log the security health check
    const structuredLogger = StructuredFileLogger.getInstance();
    structuredLogger.security('security_health_check', 'Security health check performed', {
      requestedBy: 'admin',
      securityScore: healthCheck.securityScore,
      overall: healthCheck.overall,
      ip: req.ip
    });

    res.json({
      ...healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Security health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get security metrics
 */
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const structuredLogger = StructuredFileLogger.getInstance();
    const rateLimiter = PersistentRateLimit.getInstance();
    
    const metrics = {
      logging: structuredLogger.getMetrics(),
      rateLimiting: rateLimiter.getStats(),
      components: SecurityInitializer.getInstance().getComponentStatus(),
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset rate limits for a specific key (emergency use)
 */
router.post('/rate-limit/reset', adminAuth, async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({
        error: 'Missing key parameter'
      });
    }

    const rateLimiter = PersistentRateLimit.getInstance();
    const existed = rateLimiter.resetKey(key);
    
    // Log the reset action
    const structuredLogger = StructuredFileLogger.getInstance();
    structuredLogger.security('rate_limit_reset', 'Rate limit manually reset', {
      key,
      existed,
      adminIp: req.ip,
      resetBy: 'admin'
    });

    res.json({
      success: true,
      key,
      existed,
      message: existed ? 'Rate limit reset successfully' : 'Key not found'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset rate limit',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get rate limit status for a key
 */
router.get('/rate-limit/status/:key', adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { window = '900000' } = req.query; // Default 15 minutes
    
    const rateLimiter = PersistentRateLimit.getInstance();
    const status = rateLimiter.getKeyStatus(key, parseInt(window as string));
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get rate limit status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate new encryption key (for setup)
 */
router.post('/encryption/generate-key', adminAuth, async (req, res) => {
  try {
    const securityInit = SecurityInitializer.getInstance();
    const newKey = securityInit.generateMasterKey();
    
    // Log key generation (without the actual key)
    const structuredLogger = StructuredFileLogger.getInstance();
    structuredLogger.security('encryption_key_generated', 'New encryption key generated', {
      generatedBy: 'admin',
      ip: req.ip,
      keyLength: newKey.length
    });

    res.json({
      key: newKey,
      message: 'New encryption key generated. Store this securely as ENCRYPTION_MASTER_KEY environment variable.',
      instructions: [
        '1. Add this key to your environment variables as ENCRYPTION_MASTER_KEY',
        '2. Restart the application to enable encryption',
        '3. Existing data will remain unencrypted until migrated'
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate encryption key',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search security logs
 */
router.post('/logs/search', adminAuth, async (req, res) => {
  try {
    const criteria = req.body;
    const structuredLogger = StructuredFileLogger.getInstance();
    
    // Limit search criteria for security
    const searchCriteria = {
      ...criteria,
      limit: Math.min(criteria.limit || 50, 100) // Max 100 results
    };
    
    const logs = await structuredLogger.searchLogs(searchCriteria);
    
    // Log the search
    structuredLogger.security('log_search', 'Security logs searched', {
      criteria: searchCriteria,
      resultsCount: logs.length,
      searchedBy: 'admin',
      ip: req.ip
    });

    res.json({
      results: logs,
      count: logs.length,
      criteria: searchCriteria
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to search logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;