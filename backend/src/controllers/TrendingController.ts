import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { TrendingService } from '../services/TrendingService';
import { ILoggingService, ILogger } from '../types/services';

@injectable()
export class TrendingController {
  private logger: ILogger;

  constructor(
    @inject(TrendingService) private trendingService: TrendingService, // Direct injection of concrete class
    @inject("ILoggingService") loggingServiceInstance: ILoggingService
  ) {
    console.log('[Init] TrendingController constructor called'); // Diagnostic log
    this.logger = loggingServiceInstance.createLogger('TrendingController');
    this.logger.info('TrendingController initialized');
  }

  public getTrendingData = async (_req: Request, res: Response): Promise<Response> => {
    this.logger.info('Request received for getTrendingData');
    try {
      // Fetch both types of trending data in parallel
      const [topWantedNfts, topLoopItems] = await Promise.all([
        this.trendingService.getTrendingWantedNfts(10),
        this.trendingService.getTrendingLoopItems(50, 10) // Fetch 50 loops, display top 10 items
      ]);

      this.logger.info('Successfully fetched trending data', { 
        wantedCount: topWantedNfts.length,
        loopItemCount: topLoopItems.length 
      });

      return res.json({
        success: true,
        data: {
          topWantedNfts,
          topLoopItems,
        },
      });
    } catch (error: any) {
      this.logger.error('Error fetching trending data', { errorMessage: error.message, stack: error.stack });
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch trending data',
        error: error.message 
      });
    }
  }
} 