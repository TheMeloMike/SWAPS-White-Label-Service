import express from 'express';
import { Request, Response } from 'express';
import { SwapsAIOrchestrator } from '../services/ai/SwapsAIOrchestrator';
import { DataContextService } from '../services/ai/DataContextService';
import { MarketDataAggregator } from '../services/ai/MarketDataAggregator';
import { AIContextEnhancer } from '../services/ai/AIContextEnhancer';
import { FeatureFlagService } from '../services/ai/FeatureFlagService';
import { LoggingService } from '../utils/logging/LoggingService';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const router = express.Router();
const logger = LoggingService.getInstance().createLogger('AIRoutes');

/**
 * GET /api/ai/health
 * Health check for AI service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test that services can be instantiated
    const aiOrchestrator = SwapsAIOrchestrator.getInstance();
    const dataContextService = DataContextService.getInstance();
    
    return res.json({
      success: true,
      status: 'AI service is healthy',
      timestamp: new Date().toISOString(),
      services: {
        orchestrator: !!aiOrchestrator,
        dataContext: !!dataContextService
      }
    });
  } catch (error) {
    logger.error('AI health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(503).json({
      success: false,
      status: 'AI service is unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai/query
 * Process an AI query with enhanced market intelligence (feature-flagged)
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, walletAddress, context } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    logger.info('Processing AI query', { 
      query: query.substring(0, 100),
      hasWallet: !!walletAddress 
    });

    // Check feature flags for enhanced intelligence
    const featureFlagService = FeatureFlagService.getInstance();
    const enhancedIntelligenceEnabled = featureFlagService.isEnabled('enhanced_market_intelligence', walletAddress);
    const personalizedInsightsEnabled = featureFlagService.isEnabled('personalized_insights', walletAddress);

    let aiContext: any;

    if (enhancedIntelligenceEnabled) {
      // Use enhanced AI with market intelligence
      logger.info('Using enhanced AI with market intelligence', { 
        walletAddress: walletAddress?.substring(0, 8) + '...',
        personalizedInsights: personalizedInsightsEnabled
      });

      const aiContextEnhancer = AIContextEnhancer.getInstance();
      const enhancedContext = await aiContextEnhancer.generateEnhancedContext(
        personalizedInsightsEnabled && walletAddress ? {
          walletAddress,
          ownedNFTs: context?.userNFTs,
          wantedNFTs: context?.wantedNFTs,
          tradeHistory: context?.tradeHistory
        } : undefined,
        query
      );

      // Merge enhanced context with existing orchestrator context
      const fallbackContext = await SwapsAIOrchestrator.getInstance().processAIQuery({
        query,
        walletAddress,
        context
      });

      aiContext = {
        ...fallbackContext,
        enhanced: enhancedContext,
        featuresEnabled: {
          marketIntelligence: true,
          personalizedInsights: personalizedInsightsEnabled
        }
      };
    } else {
      // Use standard AI orchestrator
      logger.info('Using standard AI orchestrator (enhanced features disabled)');
      const aiOrchestrator = SwapsAIOrchestrator.getInstance();
      aiContext = await aiOrchestrator.processAIQuery({
        query,
        walletAddress,
        context
      });

      aiContext.featuresEnabled = {
        marketIntelligence: false,
        personalizedInsights: false
      };
    }

    return res.json({
      success: true,
      context: aiContext
    });
  } catch (error) {
    logger.error('Error processing AI query', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to process AI query'
    });
  }
});

/**
 * GET /api/ai/context
 * Get current AI context data snapshot
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const dataContextService = DataContextService.getInstance();
    const snapshot = await dataContextService.getDataSnapshot();

    return res.json({
      success: true,
      snapshot
    });
  } catch (error) {
    logger.error('Error getting AI context', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get AI context'
    });
  }
});

/**
 * GET /api/ai/collection-insights/:collectionId
 * Get AI insights for a specific collection
 */
router.get('/collection-insights/:collectionId', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    
    const dataContextService = DataContextService.getInstance();
    const insights = await dataContextService.getCollectionInsights(collectionId);

    if (!insights) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    return res.json({
      success: true,
      insights
    });
  } catch (error) {
    logger.error('Error getting collection insights', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get collection insights'
    });
  }
});

/**
 * GET /api/ai/market-intelligence
 * Get real-time market intelligence data
 */
router.get('/market-intelligence', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query;
    
    // Check feature flag
    const featureFlagService = FeatureFlagService.getInstance();
    if (!featureFlagService.isEnabled('enhanced_market_intelligence', walletAddress as string)) {
      return res.status(403).json({
        success: false,
        error: 'Market intelligence feature not available',
        featureEnabled: false
      });
    }

    const marketDataAggregator = MarketDataAggregator.getInstance();
    const marketData = await marketDataAggregator.getRealTimeMarketData();

    return res.json({
      success: true,
      data: marketData,
      featureEnabled: true
    });
  } catch (error) {
    logger.error('Error getting market intelligence', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get market intelligence'
    });
  }
});

/**
 * GET /api/ai/feature-flags
 * Get feature flag status for a user
 */
router.get('/feature-flags', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query;
    
    const featureFlagService = FeatureFlagService.getInstance();
    const flags = featureFlagService.getAllFlags();
    
    const flagStatus = flags.map(flag => ({
      name: flag.name,
      description: flag.description,
      ...featureFlagService.getFlagStatus(flag.name, walletAddress as string)
    }));

    return res.json({
      success: true,
      flags: flagStatus,
      stats: featureFlagService.getUsageStats()
    });
  } catch (error) {
    logger.error('Error getting feature flags', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get feature flags'
    });
  }
});

/**
 * POST /api/ai/enhanced-context
 * Get enhanced AI context with market intelligence and personalized insights
 */
router.post('/enhanced-context', async (req: Request, res: Response) => {
  try {
    const { walletAddress, userContext, query } = req.body;
    
    // Check feature flags
    const featureFlagService = FeatureFlagService.getInstance();
    const enhancedEnabled = featureFlagService.isEnabled('enhanced_market_intelligence', walletAddress);
    const personalizedEnabled = featureFlagService.isEnabled('personalized_insights', walletAddress);
    
    if (!enhancedEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Enhanced context feature not available',
        featureEnabled: false
      });
    }

    const aiContextEnhancer = AIContextEnhancer.getInstance();
    const enhancedContext = await aiContextEnhancer.generateEnhancedContext(
      personalizedEnabled ? userContext : undefined,
      query
    );

    return res.json({
      success: true,
      context: enhancedContext,
      featuresEnabled: {
        marketIntelligence: enhancedEnabled,
        personalizedInsights: personalizedEnabled
      }
    });
  } catch (error) {
    logger.error('Error getting enhanced context', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get enhanced context'
    });
  }
});

/**
 * GET /api/ai/system-stats
 * Get AI system statistics and health
 */
router.get('/system-stats', async (req: Request, res: Response) => {
  try {
    const marketDataAggregator = MarketDataAggregator.getInstance();
    const aiContextEnhancer = AIContextEnhancer.getInstance();
    const featureFlagService = FeatureFlagService.getInstance();

    const stats = {
      marketData: marketDataAggregator.getStats(),
      aiContext: aiContextEnhancer.getStats(),
      featureFlags: featureFlagService.getUsageStats(),
      timestamp: new Date(),
      systemHealth: 'optimal'
    };

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting system stats', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get system stats',
      stats: {
        systemHealth: 'degraded',
        timestamp: new Date()
      }
    });
  }
});

/**
 * POST /api/ai/feature-flags/toggle
 * Toggle feature flags (admin endpoint)
 */
router.post('/feature-flags/toggle', async (req: Request, res: Response) => {
  try {
    const { flagName, enabled, rolloutPercentage } = req.body;
    
    if (!flagName) {
      return res.status(400).json({
        success: false,
        error: 'Flag name is required'
      });
    }

    const featureFlagService = FeatureFlagService.getInstance();
    
    let result: boolean;
    if (enabled !== undefined) {
      result = enabled 
        ? featureFlagService.enableFlag(flagName, rolloutPercentage || 100)
        : featureFlagService.disableFlag(flagName);
    } else if (rolloutPercentage !== undefined) {
      result = featureFlagService.updateRollout(flagName, rolloutPercentage);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either enabled or rolloutPercentage must be provided'
      });
    }

    return res.json({
      success: result,
      flag: featureFlagService.getFlag(flagName)
    });
  } catch (error) {
    logger.error('Error toggling feature flag', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle feature flag'
    });
  }
});

/**
 * GET /api/ai/url-metadata
 * Fetch URL metadata (Open Graph tags, title, etc.)
 * This bypasses CORS restrictions by running server-side
 */
router.get('/url-metadata', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Security: Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
    }

    logger.info(`Fetching metadata for: ${url}`);

    // Fetch the HTML content
    const response = await (fetch as any)(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SWAPS-Bot/1.0; +https://swaps.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata using Open Graph tags and fallbacks
    const metadata = {
      title: 
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() ||
        validUrl.hostname,
      
      description:
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '',
      
      image:
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('meta[name="twitter:image:src"]').attr('content') ||
        '',
      
      siteName:
        $('meta[property="og:site_name"]').attr('content') ||
        validUrl.hostname.replace('www.', ''),
      
      url: url,
      
      favicon:
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') ||
        `${validUrl.protocol}//${validUrl.hostname}/favicon.ico`
    };

    // Resolve relative URLs to absolute URLs
    if (metadata.image && !metadata.image.startsWith('http')) {
      metadata.image = new URL(metadata.image, url).toString();
    }
    
    if (metadata.favicon && !metadata.favicon.startsWith('http')) {
      metadata.favicon = new URL(metadata.favicon, url).toString();
    }

    // Clean up text content
    metadata.title = metadata.title.trim();
    metadata.description = metadata.description.trim();

    logger.info(`Successfully fetched metadata for: ${url}`, {
      title: metadata.title,
      hasImage: !!metadata.image,
      hasFavicon: !!metadata.favicon
    });

    res.json({ success: true, metadata });

  } catch (error) {
    logger.error('Error fetching URL metadata:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Return a fallback response instead of an error
    const fallbackUrl = req.query.url as string;
    try {
      const domain = new URL(fallbackUrl).hostname;
      
      res.json({
        success: false,
        metadata: {
          title: domain,
          description: `Visit ${domain}`,
          image: '',
          siteName: domain,
          url: fallbackUrl,
          favicon: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (parseError) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch URL metadata'
      });
    }
  }
});

export default router; 