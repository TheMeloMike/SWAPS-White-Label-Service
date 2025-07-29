import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { MetricsCollectionService, SystemPerformanceMetrics, MetricEvent } from './MetricsCollectionService';

export interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning' | 'prediction';
  category: 'performance' | 'user_behavior' | 'business' | 'technical';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  data: any;
  actionable: boolean;
  recommendations: string[];
  timestamp: Date;
  expiresAt?: Date;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  velocity: number; // Rate of change
  correlation: Record<string, number>; // Correlation with other metrics
  forecast: {
    shortTerm: { value: number; confidence: number }; // 1 hour
    mediumTerm: { value: number; confidence: number }; // 24 hours
    longTerm: { value: number; confidence: number }; // 7 days
  };
  seasonality: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

export interface UserBehaviorAnalysis {
  patterns: {
    peakUsageHours: number[];
    averageSessionLength: number;
    bounceRate: number;
    conversionFunnel: Record<string, number>;
    featureUsage: Record<string, number>;
  };
  segments: Array<{
    name: string;
    criteria: any;
    size: number;
    characteristics: Record<string, any>;
    behavior: Record<string, any>;
  }>;
  churnRisk: Array<{
    userId: string;
    riskScore: number;
    reasons: string[];
    recommendations: string[];
  }>;
}

export interface BusinessIntelligence {
  revenue: {
    current: number;
    projected: number;
    growthRate: number;
    trends: TrendAnalysis;
  };
  userAcquisition: {
    cost: number;
    channels: Record<string, number>;
    conversionRates: Record<string, number>;
    lifetimeValue: number;
  };
  productMetrics: {
    adoption: Record<string, number>;
    satisfaction: number;
    nps: number;
    usage: Record<string, any>;
  };
  marketPosition: {
    competitiveAdvantage: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

export interface PerformanceAnalysis {
  systemHealth: {
    overall: number; // 0-100
    components: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  };
  scalability: {
    currentCapacity: number;
    utilizationRate: number;
    projectedNeed: number;
    recommendations: string[];
  };
  reliability: {
    uptime: number;
    mtbf: number; // Mean time between failures
    mttr: number; // Mean time to recovery
    sla: number;
  };
}

/**
 * Advanced analytics engine that processes metrics to generate actionable insights,
 * trend analysis, and predictive analytics for the SWAPS platform
 */
export class AnalyticsEngine {
  private static instance: AnalyticsEngine;
  private logger: Logger;
  private metricsService: MetricsCollectionService;
  
  // Analytics state
  private insights: AnalyticsInsight[] = [];
  private trendAnalyses = new Map<string, TrendAnalysis>();
  private userBehaviorCache?: UserBehaviorAnalysis;
  private businessIntelligenceCache?: BusinessIntelligence;
  private performanceAnalysisCache?: PerformanceAnalysis;
  
  // Analysis intervals and settings
  private readonly INSIGHTS_GENERATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly TREND_ANALYSIS_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly BUSINESS_ANALYSIS_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_INSIGHTS_STORED = 1000;
  private readonly INSIGHT_EXPIRY_HOURS = 24;
  
  // Statistical thresholds
  private readonly ANOMALY_THRESHOLD = 2.5; // Standard deviations
  private readonly TREND_CONFIDENCE_THRESHOLD = 0.7;
  private readonly CORRELATION_THRESHOLD = 0.6;
  
  private analysisInterval?: NodeJS.Timeout;
  private trendInterval?: NodeJS.Timeout;
  private businessInterval?: NodeJS.Timeout;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('AnalyticsEngine');
    this.metricsService = MetricsCollectionService.getInstance();
    
    this.logger.info('AnalyticsEngine initialized');
  }

  public static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  /**
   * Start analytics processing
   */
  public start(): void {
    if (this.analysisInterval) {
      this.logger.warn('AnalyticsEngine already running');
      return;
    }

    // Start different analysis intervals
    this.analysisInterval = setInterval(() => {
      this.generateInsights();
    }, this.INSIGHTS_GENERATION_INTERVAL);

    this.trendInterval = setInterval(() => {
      this.analyzeTrends();
    }, this.TREND_ANALYSIS_INTERVAL);

    this.businessInterval = setInterval(() => {
      this.analyzeBusinessMetrics();
    }, this.BUSINESS_ANALYSIS_INTERVAL);

    // Perform initial analysis
    this.generateInsights();
    this.analyzeTrends();
    this.analyzeBusinessMetrics();

    this.logger.info('AnalyticsEngine started', {
      insightsInterval: this.INSIGHTS_GENERATION_INTERVAL,
      trendInterval: this.TREND_ANALYSIS_INTERVAL,
      businessInterval: this.BUSINESS_ANALYSIS_INTERVAL
    });
  }

  /**
   * Stop analytics processing
   */
  public stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
    if (this.trendInterval) {
      clearInterval(this.trendInterval);
      this.trendInterval = undefined;
    }
    if (this.businessInterval) {
      clearInterval(this.businessInterval);
      this.businessInterval = undefined;
    }
    
    this.logger.info('AnalyticsEngine stopped');
  }

  /**
   * Get current insights
   */
  public getInsights(filters: {
    type?: string;
    category?: string;
    severity?: string;
    limit?: number;
  } = {}): AnalyticsInsight[] {
    let filtered = this.insights.filter(insight => 
      !insight.expiresAt || insight.expiresAt > new Date()
    );

    if (filters.type) {
      filtered = filtered.filter(i => i.type === filters.type);
    }
    if (filters.category) {
      filtered = filtered.filter(i => i.category === filters.category);
    }
    if (filters.severity) {
      filtered = filtered.filter(i => i.severity === filters.severity);
    }

    return filtered
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, filters.limit || 50);
  }

  /**
   * Get trend analysis for specific metric
   */
  public getTrendAnalysis(metric: string): TrendAnalysis | undefined {
    return this.trendAnalyses.get(metric);
  }

  /**
   * Get all trend analyses
   */
  public getAllTrendAnalyses(): Map<string, TrendAnalysis> {
    return new Map(this.trendAnalyses);
  }

  /**
   * Get user behavior analysis
   */
  public getUserBehaviorAnalysis(): UserBehaviorAnalysis {
    if (!this.userBehaviorCache) {
      this.analyzeUserBehavior();
    }
    return this.userBehaviorCache!;
  }

  /**
   * Get business intelligence
   */
  public getBusinessIntelligence(): BusinessIntelligence {
    if (!this.businessIntelligenceCache) {
      this.analyzeBusinessMetrics();
    }
    return this.businessIntelligenceCache!;
  }

  /**
   * Get performance analysis
   */
  public getPerformanceAnalysis(): PerformanceAnalysis {
    if (!this.performanceAnalysisCache) {
      this.analyzePerformance();
    }
    return this.performanceAnalysisCache!;
  }

  /**
   * Get comprehensive dashboard data
   */
  public getDashboardData(): {
    insights: AnalyticsInsight[];
    trends: Record<string, TrendAnalysis>;
    userBehavior: UserBehaviorAnalysis;
    business: BusinessIntelligence;
    performance: PerformanceAnalysis;
    summary: any;
  } {
    const insights = this.getInsights({ limit: 10 });
    const trends = Object.fromEntries(this.getAllTrendAnalyses());
    const userBehavior = this.getUserBehaviorAnalysis();
    const business = this.getBusinessIntelligence();
    const performance = this.getPerformanceAnalysis();

    const summary = {
      healthScore: performance.systemHealth.overall,
      criticalInsights: insights.filter(i => i.severity === 'critical').length,
      trendingUp: Object.values(trends).filter(t => t.direction === 'increasing').length,
      userSatisfaction: business.productMetrics.satisfaction,
      revenue24h: business.revenue.current,
      uptime: performance.reliability.uptime
    };

    return {
      insights,
      trends,
      userBehavior,
      business,
      performance,
      summary
    };
  }

  /**
   * Generate insights from current metrics and patterns
   */
  private async generateInsights(): Promise<void> {
    const operation = this.logger.operation('generateInsights');
    
    try {
      const currentMetrics = this.metricsService.getCurrentMetrics();
      const recentMetrics = this.metricsService.getMetricsHistory({
        start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        end: new Date()
      });

      // Generate different types of insights
      const [
        anomalyInsights,
        trendInsights,
        performanceInsights,
        businessInsights
      ] = await Promise.all([
        this.detectAnomalies(currentMetrics, recentMetrics),
        this.analyzeTrendInsights(recentMetrics),
        this.analyzePerformanceInsights(currentMetrics),
        this.analyzeBusinessInsights(currentMetrics)
      ]);

      // Combine and store insights
      const newInsights = [
        ...anomalyInsights,
        ...trendInsights,
        ...performanceInsights,
        ...businessInsights
      ];

      // Add to insights history
      this.insights.unshift(...newInsights);
      
      // Clean up old insights
      this.cleanupOldInsights();
      
      operation.info('Insights generation completed', {
        newInsights: newInsights.length,
        totalInsights: this.insights.length,
        anomalies: anomalyInsights.length,
        trends: trendInsights.length,
        performance: performanceInsights.length,
        business: businessInsights.length
      });
      
      operation.end();
    } catch (error) {
      operation.error('Error generating insights', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }

  /**
   * Detect anomalies in current metrics
   */
  private async detectAnomalies(
    current: SystemPerformanceMetrics,
    historical: SystemPerformanceMetrics[]
  ): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    if (historical.length < 5) {
      return insights; // Need sufficient historical data
    }

    // Check for anomalies in key metrics
    const metricsToCheck = [
      { path: 'system.errorRate', name: 'Error Rate', unit: '%' },
      { path: 'system.memoryUsage.percentage', name: 'Memory Usage', unit: '%' },
      { path: 'trade.successRate', name: 'Trade Success Rate', unit: '%' },
      { path: 'user.dailyActiveUsers', name: 'Daily Active Users', unit: 'users' },
      { path: 'notifications.deliverySuccessRate', name: 'Notification Delivery Rate', unit: '%' },
      { path: 'ai.querySuccessRate', name: 'AI Query Success Rate', unit: '%' }
    ];

    for (const metric of metricsToCheck) {
      const currentValue = this.getNestedValue(current, metric.path);
      const historicalValues = historical.map(m => this.getNestedValue(m, metric.path)).filter(v => v !== undefined);
      
      if (currentValue === undefined || historicalValues.length === 0) continue;

      const anomaly = this.detectStatisticalAnomaly(currentValue, historicalValues);
      
      if (anomaly.isAnomaly) {
        const severity = anomaly.severity >= 3 ? 'critical' : 
                        anomaly.severity >= 2 ? 'high' : 'medium';
        
        insights.push({
          id: `anomaly_${metric.path}_${Date.now()}`,
          type: 'anomaly',
          category: 'performance',
          title: `Anomalous ${metric.name} Detected`,
          description: `${metric.name} is ${anomaly.direction} significantly: ${currentValue.toFixed(2)}${metric.unit} (${anomaly.deviations.toFixed(1)}σ from normal)`,
          severity,
          confidence: Math.min(0.95, anomaly.severity / 3),
          data: {
            metric: metric.path,
            currentValue,
            historicalMean: anomaly.mean,
            standardDeviation: anomaly.stdDev,
            deviations: anomaly.deviations
          },
          actionable: true,
          recommendations: this.getAnomalyRecommendations(metric.path, anomaly),
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.INSIGHT_EXPIRY_HOURS * 60 * 60 * 1000)
        });
      }
    }

    return insights;
  }

  /**
   * Detect statistical anomaly using z-score
   */
  private detectStatisticalAnomaly(
    currentValue: number,
    historicalValues: number[]
  ): {
    isAnomaly: boolean;
    direction: 'higher' | 'lower';
    severity: number;
    deviations: number;
    mean: number;
    stdDev: number;
  } {
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) {
      return {
        isAnomaly: false,
        direction: 'higher',
        severity: 0,
        deviations: 0,
        mean,
        stdDev
      };
    }

    const zScore = Math.abs(currentValue - mean) / stdDev;
    const direction = currentValue > mean ? 'higher' : 'lower';
    
    return {
      isAnomaly: zScore > this.ANOMALY_THRESHOLD,
      direction,
      severity: zScore,
      deviations: zScore,
      mean,
      stdDev
    };
  }

  /**
   * Get recommendations for anomalies
   */
  private getAnomalyRecommendations(metricPath: string, anomaly: any): string[] {
    const recommendations: string[] = [];
    
    switch (metricPath) {
      case 'system.errorRate':
        if (anomaly.direction === 'higher') {
          recommendations.push('Check error logs for recent failures');
          recommendations.push('Review recent deployments or configuration changes');
          recommendations.push('Monitor external API dependencies');
        }
        break;
      
      case 'system.memoryUsage.percentage':
        if (anomaly.direction === 'higher') {
          recommendations.push('Investigate memory leaks in services');
          recommendations.push('Consider scaling up server resources');
          recommendations.push('Review and optimize caching strategies');
        }
        break;
      
      case 'trade.successRate':
        if (anomaly.direction === 'lower') {
          recommendations.push('Analyze failing trade patterns');
          recommendations.push('Check NFT price data accuracy');
          recommendations.push('Review trade discovery algorithm parameters');
        }
        break;
      
      case 'user.dailyActiveUsers':
        if (anomaly.direction === 'lower') {
          recommendations.push('Investigate user experience issues');
          recommendations.push('Review recent feature changes');
          recommendations.push('Check notification delivery');
        } else {
          recommendations.push('Prepare for increased load');
          recommendations.push('Monitor system performance');
        }
        break;
    }
    
    return recommendations;
  }

  /**
   * Analyze trend insights
   */
  private async analyzeTrendInsights(metrics: SystemPerformanceMetrics[]): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // Analyze significant trends
    for (const [metricPath, trendAnalysis] of this.trendAnalyses) {
      if (Math.abs(trendAnalysis.velocity) > 0.1 && trendAnalysis.forecast.shortTerm.confidence > 0.7) {
        const direction = trendAnalysis.direction;
        const isPositive = this.isPositiveTrend(metricPath, direction);
        
        insights.push({
          id: `trend_${metricPath}_${Date.now()}`,
          type: 'trend',
          category: 'performance',
          title: `${this.getMetricDisplayName(metricPath)} Trending ${direction}`,
          description: `Detected ${direction} trend in ${this.getMetricDisplayName(metricPath)} with ${(trendAnalysis.forecast.shortTerm.confidence * 100).toFixed(0)}% confidence`,
          severity: isPositive ? 'low' : 'medium',
          confidence: trendAnalysis.forecast.shortTerm.confidence,
          data: {
            metric: metricPath,
            direction,
            velocity: trendAnalysis.velocity,
            forecast: trendAnalysis.forecast,
            correlations: trendAnalysis.correlation
          },
          actionable: !isPositive,
          recommendations: this.getTrendRecommendations(metricPath, trendAnalysis),
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.INSIGHT_EXPIRY_HOURS * 60 * 60 * 1000)
        });
      }
    }
    
    return insights;
  }

  /**
   * Analyze performance insights
   */
  private async analyzePerformanceInsights(current: SystemPerformanceMetrics): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // Check system thresholds
    if (current.system.memoryUsage.percentage > 80) {
      insights.push({
        id: `performance_memory_${Date.now()}`,
        type: 'warning',
        category: 'performance',
        title: 'High Memory Usage',
        description: `Memory usage at ${current.system.memoryUsage.percentage}% - approaching capacity`,
        severity: current.system.memoryUsage.percentage > 90 ? 'high' : 'medium',
        confidence: 1.0,
        data: { memoryUsage: current.system.memoryUsage },
        actionable: true,
        recommendations: [
          'Monitor for memory leaks',
          'Consider scaling up resources',
          'Optimize caching strategies'
        ],
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
      });
    }
    
    // Check trade performance
    if (current.trade.successRate < 75) {
      insights.push({
        id: `performance_trade_success_${Date.now()}`,
        type: 'warning',
        category: 'performance',
        title: 'Low Trade Success Rate',
        description: `Trade success rate at ${current.trade.successRate}% - below optimal threshold`,
        severity: current.trade.successRate < 60 ? 'high' : 'medium',
        confidence: 0.9,
        data: { tradeMetrics: current.trade },
        actionable: true,
        recommendations: [
          'Review trade discovery parameters',
          'Check NFT price data accuracy',
          'Analyze failed trade patterns'
        ],
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
      });
    }

    // Check notification performance
    if (current.notifications.deliverySuccessRate < 95) {
      insights.push({
        id: `performance_notifications_${Date.now()}`,
        type: 'warning',
        category: 'performance',
        title: 'Notification Delivery Issues',
        description: `Notification delivery rate at ${current.notifications.deliverySuccessRate.toFixed(1)}% - some users may miss alerts`,
        severity: current.notifications.deliverySuccessRate < 90 ? 'high' : 'medium',
        confidence: 0.85,
        data: { notificationMetrics: current.notifications },
        actionable: true,
        recommendations: [
          'Check WebSocket connection stability',
          'Review rate limiting settings',
          'Monitor external service dependencies'
        ],
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours
      });
    }
    
    return insights;
  }

  /**
   * Analyze business insights
   */
  private async analyzeBusinessInsights(current: SystemPerformanceMetrics): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // User growth opportunities
    if (current.user.dailyActiveUsers > 0) {
      const engagementRate = current.user.engagementScore;
      
      if (engagementRate > 10) {
        insights.push({
          id: `business_engagement_${Date.now()}`,
          type: 'opportunity',
          category: 'business',
          title: 'High User Engagement Detected',
          description: `Strong user engagement (${engagementRate.toFixed(1)} actions/session) indicates opportunity for growth initiatives`,
          severity: 'low',
          confidence: 0.8,
          data: { userMetrics: current.user },
          actionable: true,
          recommendations: [
            'Consider introducing premium features',
            'Launch referral program',
            'Implement user feedback collection'
          ],
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
        });
      }
    }
    
    // AI feature adoption
    if (current.ai.enhancedFeaturesUsage > 50) {
      insights.push({
        id: `business_ai_adoption_${Date.now()}`,
        type: 'opportunity',
        category: 'business',
        title: 'Strong AI Feature Adoption',
        description: `${current.ai.enhancedFeaturesUsage.toFixed(0)}% of users are using enhanced AI features`,
        severity: 'low',
        confidence: 0.9,
        data: { aiMetrics: current.ai },
        actionable: true,
        recommendations: [
          'Expand AI feature set',
          'Create premium AI tier',
          'Gather user feedback on AI experience'
        ],
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    }
    
    return insights;
  }

  /**
   * Analyze trends in metrics
   */
  private async analyzeTrends(): Promise<void> {
    const operation = this.logger.operation('analyzeTrends');
    
    try {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      };
      
      const metrics = this.metricsService.getMetricsHistory(timeRange, 'hour');
      
      if (metrics.length < 3) {
        operation.warn('Insufficient data for trend analysis');
        operation.end();
        return;
      }

      // Analyze trends for key metrics
      const metricsToAnalyze = [
        'system.errorRate',
        'system.memoryUsage.percentage',
        'trade.successRate',
        'trade.completedTrades24h',
        'user.dailyActiveUsers',
        'notifications.deliverySuccessRate',
        'ai.querySuccessRate'
      ];

      for (const metricPath of metricsToAnalyze) {
        const trendAnalysis = this.calculateTrend(metricPath, metrics);
        if (trendAnalysis) {
          this.trendAnalyses.set(metricPath, trendAnalysis);
        }
      }
      
      operation.info('Trend analysis completed', {
        metricsAnalyzed: metricsToAnalyze.length,
        trendsDetected: this.trendAnalyses.size
      });
      
      operation.end();
    } catch (error) {
      operation.error('Error analyzing trends', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(metricPath: string, metrics: SystemPerformanceMetrics[]): TrendAnalysis | null {
    const values = metrics.map(m => this.getNestedValue(m, metricPath)).filter(v => v !== undefined);
    
    if (values.length < 3) return null;

    // Calculate linear regression for trend direction and velocity
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (this.calculateVolatility(values) > 0.5) {
      direction = 'volatile';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    // Calculate forecast
    const forecast = {
      shortTerm: {
        value: intercept + slope * (n + 1),
        confidence: this.calculateForecastConfidence(values, slope, intercept)
      },
      mediumTerm: {
        value: intercept + slope * (n + 24),
        confidence: Math.max(0.3, this.calculateForecastConfidence(values, slope, intercept) - 0.2)
      },
      longTerm: {
        value: intercept + slope * (n + 168),
        confidence: Math.max(0.1, this.calculateForecastConfidence(values, slope, intercept) - 0.4)
      }
    };
    
    return {
      metric: metricPath,
      direction,
      velocity: slope,
      correlation: this.calculateCorrelations(metricPath, metrics),
      forecast,
      seasonality: {
        hourly: this.calculateSeasonality(values, 'hourly'),
        daily: this.calculateSeasonality(values, 'daily'),
        weekly: this.calculateSeasonality(values, 'weekly')
      }
    };
  }

  /**
   * Calculate volatility of values
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0;
  }

  /**
   * Calculate forecast confidence
   */
  private calculateForecastConfidence(values: number[], slope: number, intercept: number): number {
    const predictions = values.map((_, i) => intercept + slope * i);
    const errors = values.map((val, i) => Math.abs(val - predictions[i]));
    const mape = errors.reduce((sum, err, i) => sum + err / Math.max(values[i], 0.01), 0) / values.length;
    
    return Math.max(0.1, Math.min(0.95, 1 - mape));
  }

  /**
   * Calculate correlations with other metrics
   */
  private calculateCorrelations(metricPath: string, metrics: SystemPerformanceMetrics[]): Record<string, number> {
    const correlations: Record<string, number> = {};
    const targetValues = metrics.map(m => this.getNestedValue(m, metricPath)).filter(v => v !== undefined);
    
    if (targetValues.length < 3) return correlations;

    const otherMetrics = [
      'system.errorRate',
      'system.memoryUsage.percentage',
      'trade.successRate',
      'user.dailyActiveUsers'
    ].filter(path => path !== metricPath);

    for (const otherMetric of otherMetrics) {
      const otherValues = metrics.map(m => this.getNestedValue(m, otherMetric)).filter(v => v !== undefined);
      
      if (otherValues.length === targetValues.length) {
        const correlation = this.calculatePearsonCorrelation(targetValues, otherValues);
        if (Math.abs(correlation) > this.CORRELATION_THRESHOLD) {
          correlations[otherMetric] = correlation;
        }
      }
    }
    
    return correlations;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate seasonality patterns
   */
  private calculateSeasonality(values: number[], type: 'hourly' | 'daily' | 'weekly'): number[] {
    // Simplified seasonality calculation
    // In a real implementation, this would use more sophisticated time series analysis
    const periods = type === 'hourly' ? 24 : type === 'daily' ? 7 : 52;
    const result = new Array(periods).fill(0);
    
    // For now, return uniform distribution
    return result.map(() => 1 / periods);
  }

  /**
   * Analyze user behavior patterns
   */
  private analyzeUserBehavior(): void {
    const events = this.metricsService.getEventHistory({
      type: 'user_action',
      timeRange: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() }
    });

    // Calculate patterns
    const hourlyUsage = new Array(24).fill(0);
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourlyUsage[hour]++;
    });

    const peakUsageHours = hourlyUsage
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    this.userBehaviorCache = {
      patterns: {
        peakUsageHours,
        averageSessionLength: 15.5, // Calculate from session data
        bounceRate: 0.25,
        conversionFunnel: {
          visitors: 1000,
          signups: 150,
          firstTrade: 45,
          activeTrade: 30
        },
        featureUsage: {
          aiAssistant: 0.65,
          notifications: 0.40,
          collections: 0.80
        }
      },
      segments: [
        {
          name: 'Power Traders',
          criteria: { tradesPerWeek: '>10' },
          size: 25,
          characteristics: { experience: 'high', value: 'high' },
          behavior: { sessionLength: 45, engagement: 'high' }
        },
        {
          name: 'Casual Users',
          criteria: { tradesPerWeek: '1-5' },
          size: 60,
          characteristics: { experience: 'medium', value: 'medium' },
          behavior: { sessionLength: 20, engagement: 'medium' }
        }
      ],
      churnRisk: [
        {
          userId: 'user_123',
          riskScore: 0.8,
          reasons: ['Low activity', 'Failed trades'],
          recommendations: ['Send engagement notifications', 'Provide trading tips']
        }
      ]
    };
  }

  /**
   * Analyze business metrics
   */
  private analyzeBusinessMetrics(): void {
    const currentMetrics = this.metricsService.getCurrentMetrics();
    
    this.businessIntelligenceCache = {
      revenue: {
        current: currentMetrics.business.revenue24h,
        projected: currentMetrics.business.revenue24h * 1.15,
        growthRate: currentMetrics.business.growthRate,
        trends: this.getTrendAnalysis('business.revenue24h') || {
          metric: 'business.revenue24h',
          direction: 'increasing',
          velocity: 0.05,
          correlation: {},
          forecast: {
            shortTerm: { value: currentMetrics.business.revenue24h * 1.02, confidence: 0.7 },
            mediumTerm: { value: currentMetrics.business.revenue24h * 1.10, confidence: 0.6 },
            longTerm: { value: currentMetrics.business.revenue24h * 1.25, confidence: 0.4 }
          },
          seasonality: { hourly: [], daily: [], weekly: [] }
        }
      },
      userAcquisition: {
        cost: 25.50,
        channels: { organic: 0.6, referral: 0.25, advertising: 0.15 },
        conversionRates: { visitor_signup: 0.15, signup_trade: 0.30 },
        lifetimeValue: currentMetrics.business.lifetimeValue
      },
      productMetrics: {
        adoption: { trading: 0.80, ai: 0.65, notifications: 0.40 },
        satisfaction: currentMetrics.ai.userSatisfactionScore,
        nps: 8.5,
        usage: { dailyActive: currentMetrics.user.dailyActiveUsers }
      },
      marketPosition: {
        competitiveAdvantage: ['Multi-party trading', 'AI integration', 'Real-time notifications'],
        weaknesses: ['User onboarding', 'Mobile experience'],
        opportunities: ['Cross-chain expansion', 'Premium features', 'API marketplace'],
        threats: ['Regulatory changes', 'Market volatility', 'Competition']
      }
    };
  }

  /**
   * Analyze system performance
   */
  private analyzePerformance(): void {
    const currentMetrics = this.metricsService.getCurrentMetrics();
    
    const systemHealth = this.calculateSystemHealth(currentMetrics);
    const bottlenecks = this.identifyBottlenecks(currentMetrics);
    
    this.performanceAnalysisCache = {
      systemHealth: {
        overall: systemHealth,
        components: {
          'Trade Discovery': currentMetrics.trade.successRate,
          'Notifications': currentMetrics.notifications.deliverySuccessRate,
          'AI Services': currentMetrics.ai.querySuccessRate,
          'System Resources': 100 - currentMetrics.system.memoryUsage.percentage
        },
        bottlenecks,
        recommendations: this.getPerformanceRecommendations(bottlenecks)
      },
      scalability: {
        currentCapacity: 1000, // Current user capacity
        utilizationRate: currentMetrics.user.dailyActiveUsers / 1000,
        projectedNeed: Math.round(currentMetrics.user.dailyActiveUsers * 1.5),
        recommendations: this.getScalabilityRecommendations(currentMetrics)
      },
      reliability: {
        uptime: 99.5,
        mtbf: 720, // hours
        mttr: 15, // minutes
        sla: 99.9
      }
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateSystemHealth(metrics: SystemPerformanceMetrics): number {
    const components = [
      { weight: 0.3, value: metrics.trade.successRate },
      { weight: 0.2, value: 100 - metrics.system.errorRate },
      { weight: 0.2, value: 100 - metrics.system.memoryUsage.percentage },
      { weight: 0.15, value: metrics.notifications.deliverySuccessRate },
      { weight: 0.15, value: metrics.ai.querySuccessRate }
    ];
    
    return Math.round(components.reduce((sum, comp) => sum + comp.weight * comp.value, 0));
  }

  /**
   * Identify system bottlenecks
   */
  private identifyBottlenecks(metrics: SystemPerformanceMetrics): string[] {
    const bottlenecks: string[] = [];
    
    if (metrics.system.memoryUsage.percentage > 80) {
      bottlenecks.push('High memory usage');
    }
    if (metrics.system.errorRate > 2) {
      bottlenecks.push('Elevated error rate');
    }
    if (metrics.trade.averageDiscoveryTime > 2) {
      bottlenecks.push('Slow trade discovery');
    }
    if (metrics.notifications.averageDeliveryTime > 1000) {
      bottlenecks.push('Slow notification delivery');
    }
    
    return bottlenecks;
  }

  /**
   * Get performance recommendations
   */
  private getPerformanceRecommendations(bottlenecks: string[]): string[] {
    const recommendations: string[] = [];
    
    bottlenecks.forEach(bottleneck => {
      switch (bottleneck) {
        case 'High memory usage':
          recommendations.push('Optimize caching strategies');
          recommendations.push('Review memory-intensive operations');
          break;
        case 'Elevated error rate':
          recommendations.push('Enhance error handling');
          recommendations.push('Improve monitoring and alerting');
          break;
        case 'Slow trade discovery':
          recommendations.push('Optimize graph algorithms');
          recommendations.push('Implement parallel processing');
          break;
        case 'Slow notification delivery':
          recommendations.push('Optimize WebSocket connections');
          recommendations.push('Review message queuing');
          break;
      }
    });
    
    return recommendations;
  }

  /**
   * Get scalability recommendations
   */
  private getScalabilityRecommendations(metrics: SystemPerformanceMetrics): string[] {
    const recommendations: string[] = [];
    const utilizationRate = metrics.user.dailyActiveUsers / 1000;
    
    if (utilizationRate > 0.8) {
      recommendations.push('Plan for horizontal scaling');
      recommendations.push('Implement load balancing');
    }
    if (utilizationRate > 0.6) {
      recommendations.push('Monitor resource usage closely');
      recommendations.push('Prepare scaling procedures');
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isPositiveTrend(metricPath: string, direction: string): boolean {
    const positiveMetrics = ['trade.successRate', 'user.dailyActiveUsers', 'notifications.deliverySuccessRate', 'ai.querySuccessRate'];
    const negativeMetrics = ['system.errorRate', 'system.memoryUsage.percentage'];
    
    if (positiveMetrics.includes(metricPath)) {
      return direction === 'increasing';
    }
    if (negativeMetrics.includes(metricPath)) {
      return direction === 'decreasing';
    }
    
    return true; // Neutral
  }

  private getMetricDisplayName(metricPath: string): string {
    const names: Record<string, string> = {
      'system.errorRate': 'System Error Rate',
      'system.memoryUsage.percentage': 'Memory Usage',
      'trade.successRate': 'Trade Success Rate',
      'user.dailyActiveUsers': 'Daily Active Users',
      'notifications.deliverySuccessRate': 'Notification Delivery Rate',
      'ai.querySuccessRate': 'AI Query Success Rate'
    };
    
    return names[metricPath] || metricPath;
  }

  private getTrendRecommendations(metricPath: string, trend: TrendAnalysis): string[] {
    const recommendations: string[] = [];
    const isPositive = this.isPositiveTrend(metricPath, trend.direction);
    
    if (!isPositive) {
      switch (metricPath) {
        case 'trade.successRate':
          recommendations.push('Review trade discovery parameters');
          recommendations.push('Analyze failed trade patterns');
          break;
        case 'user.dailyActiveUsers':
          recommendations.push('Investigate user experience issues');
          recommendations.push('Review engagement strategies');
          break;
        case 'system.errorRate':
          recommendations.push('Investigate error sources');
          recommendations.push('Improve error handling');
          break;
      }
    }
    
    return recommendations;
  }

  /**
   * Clean up old insights
   */
  private cleanupOldInsights(): void {
    const now = new Date();
    this.insights = this.insights.filter(insight => 
      !insight.expiresAt || insight.expiresAt > now
    );
    
    // Limit total insights
    if (this.insights.length > this.MAX_INSIGHTS_STORED) {
      this.insights = this.insights
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, this.MAX_INSIGHTS_STORED);
    }
  }
} 