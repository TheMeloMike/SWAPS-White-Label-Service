import { BaseService } from './base.service';
import { AdminAuthService } from './adminAuth';

export interface DashboardOverview {
  kpis: {
    activeUsers: number;
    completedTrades: number;
    systemUptime: number;
    successRate: number;
    notificationsSent: number;
    aiQueries: number;
    revenue: number;
    errorRate: number;
  };
  trends: Record<string, number>;
  alerts: Array<{
    metric: string;
    condition: 'above' | 'below' | 'equals';
    value: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    lastTriggered?: Date;
    description: string;
  }>;
  insights: Array<{
    id: string;
    type: 'trend' | 'anomaly' | 'opportunity' | 'warning' | 'prediction';
    category: 'performance' | 'user_behavior' | 'business' | 'technical';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    data: any;
    actionable: boolean;
    recommendations: string[];
    timestamp: Date;
    expiresAt?: Date;
  }>;
  summary: {
    healthScore: number;
    criticalInsights: number;
    trendingUp: number;
    userSatisfaction: number;
    revenue24h: number;
    uptime: number;
  };
  systemHealth: number;
  timestamp: Date;
}

export class DashboardService extends BaseService {
  private adminAuth = AdminAuthService.getInstance();

  /**
   * Get comprehensive dashboard overview
   */
  async getOverview(): Promise<DashboardOverview> {
    const response: { success: boolean; data: DashboardOverview } = await this.apiGet('/api/dashboard/overview', {
      headers: this.adminAuth.getAuthHeader()
    });
    return response.data;
  }

  /**
   * Get real-time metrics for live dashboard updates
   */
  async getRealTimeData(): Promise<any> {
    const response: { success: boolean; data: any } = await this.apiGet('/api/dashboard/real-time', {
      headers: this.adminAuth.getAuthHeader()
    });
    return response.data;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<any> {
    const response: { success: boolean; data: any } = await this.apiGet('/api/dashboard/system-health', {
      headers: this.adminAuth.getAuthHeader()
    });
    return response.data;
  }

  /**
   * Record user interaction with dashboard for analytics
   */
  async recordInteraction(interaction: {
    action: string;
    component: string;
    data?: any;
    userId?: string;
  }): Promise<{ success: boolean; message: string; timestamp: Date }> {
    return await this.apiPost('/api/dashboard/record-interaction', interaction, {
      headers: this.adminAuth.getAuthHeader()
    });
  }

  // Memory breakdown methods
  async getMemoryBreakdown(): Promise<MemoryBreakdownData> {
    const response = await this.apiGet('/api/dashboard/memory-breakdown', {
      headers: this.adminAuth.getAuthHeader()
    }) as { data: MemoryBreakdownData };
    return response.data;
  }

  async getComponentMemoryDetails(component: string): Promise<ComponentMemoryDetails> {
    const response = await this.apiGet(`/api/dashboard/memory-breakdown/${component}`, {
      headers: this.adminAuth.getAuthHeader()
    }) as { data: ComponentMemoryDetails };
    return response.data;
  }
}

export default DashboardService;

// Memory breakdown interfaces
export interface MemoryBreakdownData {
  overview: {
    totalUsed: number;
    totalAvailable: number;
    utilizationPercentage: number;
    growthRate: number;
    peakUsage: number;
    averageUsage: number;
  };
  components: Record<string, ComponentMemoryUsage>;
  topConsumers: Array<{
    name: string;
    used: number;
    percentage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    healthStatus: 'healthy' | 'warning' | 'critical';
  }>;
  garbageCollection: {
    totalGCTime: number;
    gcFrequency: number;
    majorGCCount: number;
    minorGCCount: number;
    lastGCTime: number;
  };
  efficiency: {
    memoryPerUser: number;
    memoryPerTrade: number;
    cacheHitRatio: number;
    memoryTurnover: number;
  };
  recommendations: {
    critical: MemoryRecommendation[];
    all: MemoryRecommendation[];
  };
  trends: Array<{
    timestamp: Date;
    totalMemory: number;
    percentage: number;
    components: Record<string, ComponentMemoryUsage>;
  }>;
  lastUpdated: Date;
}

export interface ComponentMemoryUsage {
  used: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  details: {
    dataStructures: Record<string, number>;
    caches: Record<string, number>;
    buffers: Record<string, number>;
    objects: Record<string, number>;
  };
  healthStatus: 'healthy' | 'warning' | 'critical';
  lastUpdated: Date;
}

export interface MemoryRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'optimization' | 'scaling' | 'cleanup' | 'monitoring';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actions: string[];
  estimatedSavings: number;
}

export interface ComponentMemoryDetails {
  component: string;
  current: ComponentMemoryUsage;
  trends: Array<{
    timestamp: Date;
    used: number;
    percentage: number;
  }>;
  recommendations: MemoryRecommendation[];
  details: {
    breakdown: {
      dataStructures: Record<string, number>;
      caches: Record<string, number>;
      buffers: Record<string, number>;
      objects: Record<string, number>;
    };
    healthAnalysis: {
      status: 'healthy' | 'warning' | 'critical';
      trend: 'increasing' | 'decreasing' | 'stable';
      riskLevel: 'low' | 'medium' | 'high';
    };
  };
  lastUpdated: Date;
} 