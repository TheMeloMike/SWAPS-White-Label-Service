import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Mock Trade Score Service for tests
 * Calculates synthetic trade scores based on trade properties
 */
export class MockTradeScoreService {
  private logger = LoggingService.getInstance().createLogger('MockTradeScoreService');
  private static instance: MockTradeScoreService;
  
  private constructor() {
    this.logger.info('MockTradeScoreService initialized');
  }
  
  public static getInstance(): MockTradeScoreService {
    if (!MockTradeScoreService.instance) {
      MockTradeScoreService.instance = new MockTradeScoreService();
    }
    return MockTradeScoreService.instance;
  }
  
  /**
   * Calculate a quality score for a trade loop
   */
  public calculateTradeScore(trade: any, demandMetrics?: any): any {
    // Default score starts with the efficiency or 1.0 if not available
    const efficiency = trade.efficiency || trade.rawEfficiency || 1.0;
    
    // Calculate a quality score based on the trade properties
    let score = efficiency;
    
    // Adjust score based on number of steps (favor smaller trades slightly)
    const steps = trade.steps?.length || 0;
    if (steps === 2) {
      // Direct trades get a small bonus
      score *= 1.1;
    } else if (steps > 6) {
      // Larger trades get a small penalty
      score *= 0.9;
    }
    
    // Return score and metrics
    return {
      score,
      metrics: {
        efficiency: efficiency,
        stepBonus: steps === 2 ? 0.1 : (steps > 6 ? -0.1 : 0),
        demandBonus: 0, // No real demand data in test
        valueAdjustment: 0 // No real value data in test
      }
    };
  }
} 