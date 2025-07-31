import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TenantConfig } from '../../types/abstract';
import { TradeLoop } from '../../types/trade';
import fetch from 'node-fetch';

/**
 * Webhook payload interface
 */
export interface WebhookPayload {
  event: 'trade_loop_discovered' | 'trade_loop_invalidated' | 'trade_loop_completed';
  timestamp: string;
  tenant: {
    id: string;
    name: string;
  };
  data: {
    loop?: TradeLoop;
    loopId?: string;
    trigger?: string;
    reason?: string;
    metadata?: Record<string, any>;
  };
  signature?: string; // HMAC signature for verification
}

/**
 * Webhook delivery attempt
 */
interface WebhookAttempt {
  id: string;
  tenantId: string;
  payload: WebhookPayload;
  url: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'max_retries';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  timestamp: Date;
  nextRetry?: Date;
}

/**
 * Webhook Notification Service
 * 
 * Handles real-time webhook notifications to partners when trade events occur.
 * Includes retry logic, signature verification, and delivery tracking.
 */
export class WebhookNotificationService {
  private static instance: WebhookNotificationService;
  private logger: Logger;
  
  // Webhook delivery tracking
  private pendingWebhooks = new Map<string, WebhookAttempt>();
  private deliveryHistory: WebhookAttempt[] = [];
  
  // Configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
  private readonly TIMEOUT_MS = 10000; // 10 second timeout
  private readonly MAX_HISTORY = 1000; // Keep last 1000 delivery attempts

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('WebhookNotification');
    
    // Start retry processor
    this.startRetryProcessor();
    
    this.logger.info('WebhookNotificationService initialized');
  }

  public static getInstance(): WebhookNotificationService {
    if (!WebhookNotificationService.instance) {
      WebhookNotificationService.instance = new WebhookNotificationService();
    }
    return WebhookNotificationService.instance;
  }

  /**
   * Send webhook notification for trade loop discovery
   */
  public async notifyTradeLoopDiscovered(
    tenant: TenantConfig,
    loop: TradeLoop,
    trigger: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!tenant.settings.webhooks.enabled || !tenant.settings.webhooks.tradeDiscoveryUrl) {
      return;
    }

    const payload: WebhookPayload = {
      event: 'trade_loop_discovered',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name
      },
      data: {
        loop,
        trigger,
        metadata
      }
    };

    await this.sendWebhook(tenant, payload);
  }

  /**
   * Send webhook notification for trade loop invalidation
   */
  public async notifyTradeLoopInvalidated(
    tenant: TenantConfig,
    loopId: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!tenant.settings.webhooks.enabled || !tenant.settings.webhooks.tradeDiscoveryUrl) {
      return;
    }

    const payload: WebhookPayload = {
      event: 'trade_loop_invalidated',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name
      },
      data: {
        loopId,
        reason,
        metadata
      }
    };

    await this.sendWebhook(tenant, payload);
  }

  /**
   * Send webhook notification for trade loop completion
   */
  public async notifyTradeLoopCompleted(
    tenant: TenantConfig,
    loop: TradeLoop,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!tenant.settings.webhooks.enabled || !tenant.settings.webhooks.tradeDiscoveryUrl) {
      return;
    }

    const payload: WebhookPayload = {
      event: 'trade_loop_completed',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name
      },
      data: {
        loop,
        metadata
      }
    };

    await this.sendWebhook(tenant, payload);
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhook(tenant: TenantConfig, payload: WebhookPayload): Promise<void> {
    const operation = this.logger.operation('sendWebhook');
    
    try {
      // Add signature if webhook secret is configured
      if (process.env.WEBHOOK_SECRET) {
        payload.signature = this.generateSignature(payload, process.env.WEBHOOK_SECRET);
      }

      const attemptId = this.generateAttemptId();
      const attempt: WebhookAttempt = {
        id: attemptId,
        tenantId: tenant.id,
        payload,
        url: tenant.settings.webhooks.tradeDiscoveryUrl!,
        attempt: 1,
        status: 'pending',
        timestamp: new Date()
      };

      // Store pending webhook
      this.pendingWebhooks.set(attemptId, attempt);

      // Attempt immediate delivery
      await this.deliverWebhook(attempt);

      operation.info('Webhook queued for delivery', {
        tenantId: tenant.id,
        event: payload.event,
        attemptId,
        url: tenant.settings.webhooks.tradeDiscoveryUrl
      });

      operation.end();
    } catch (error) {
      operation.error('Failed to send webhook', {
        tenantId: tenant.id,
        event: payload.event,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }

  /**
   * Deliver webhook with HTTP request
   */
  private async deliverWebhook(attempt: WebhookAttempt): Promise<void> {
    const operation = this.logger.operation('deliverWebhook');
    
    try {
      const response = await fetch(attempt.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SWAPS-Webhook/1.0',
          'X-SWAPS-Event': attempt.payload.event,
          'X-SWAPS-Tenant': attempt.tenantId,
          'X-SWAPS-Signature': attempt.payload.signature || '',
          'X-SWAPS-Timestamp': attempt.payload.timestamp
        },
        body: JSON.stringify(attempt.payload),
        timeout: this.TIMEOUT_MS
      });

      attempt.responseStatus = response.status;
      attempt.responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // Success
        attempt.status = 'success';
        this.pendingWebhooks.delete(attempt.id);
        
        operation.info('Webhook delivered successfully', {
          attemptId: attempt.id,
          tenantId: attempt.tenantId,
          status: response.status,
          attempt: attempt.attempt
        });
      } else {
        // HTTP error - schedule retry
        throw new Error(`HTTP ${response.status}: ${attempt.responseBody}`);
      }

      operation.end();
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      
      if (attempt.attempt >= this.MAX_RETRIES) {
        // Max retries reached
        attempt.status = 'max_retries';
        this.pendingWebhooks.delete(attempt.id);
        
        operation.error('Webhook delivery failed after max retries', {
          attemptId: attempt.id,
          tenantId: attempt.tenantId,
          attempt: attempt.attempt,
          error: attempt.error
        });
      } else {
        // Schedule retry
        attempt.status = 'failed';
        attempt.attempt++;
        const delayMs = this.RETRY_DELAYS[attempt.attempt - 2] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        attempt.nextRetry = new Date(Date.now() + delayMs);
        
        operation.warn('Webhook delivery failed, scheduling retry', {
          attemptId: attempt.id,
          tenantId: attempt.tenantId,
          attempt: attempt.attempt,
          nextRetry: attempt.nextRetry,
          error: attempt.error
        });
      }
      
      operation.end();
    } finally {
      // Add to history
      this.addToHistory(attempt);
    }
  }

  /**
   * Background retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetries();
    }, 1000); // Check every second
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    
    for (const [attemptId, attempt] of this.pendingWebhooks) {
      if (
        attempt.status === 'failed' && 
        attempt.nextRetry && 
        attempt.nextRetry <= now
      ) {
        // Retry delivery
        attempt.status = 'pending';
        await this.deliverWebhook(attempt);
      }
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Generate unique attempt ID
   */
  private generateAttemptId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Add attempt to delivery history
   */
  private addToHistory(attempt: WebhookAttempt): void {
    this.deliveryHistory.push({...attempt});
    
    // Keep only last N attempts
    if (this.deliveryHistory.length > this.MAX_HISTORY) {
      this.deliveryHistory.shift();
    }
  }

  /**
   * Get delivery statistics for a tenant
   */
  public getDeliveryStats(tenantId: string) {
    const tenantHistory = this.deliveryHistory.filter(a => a.tenantId === tenantId);
    const pendingCount = Array.from(this.pendingWebhooks.values())
      .filter(a => a.tenantId === tenantId).length;
    
    const totalAttempts = tenantHistory.length;
    const successfulDeliveries = tenantHistory.filter(a => a.status === 'success').length;
    const failedDeliveries = tenantHistory.filter(a => a.status === 'max_retries').length;
    
    const successRate = totalAttempts > 0 ? (successfulDeliveries / totalAttempts) * 100 : 0;
    
    return {
      totalAttempts,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries: pendingCount,
      successRate: Number(successRate.toFixed(2)),
      lastDelivery: tenantHistory.length > 0 
        ? tenantHistory[tenantHistory.length - 1].timestamp 
        : null
    };
  }

  /**
   * Get system-wide webhook metrics
   */
  public getSystemMetrics() {
    const totalPending = this.pendingWebhooks.size;
    const totalHistory = this.deliveryHistory.length;
    const successfulDeliveries = this.deliveryHistory.filter(a => a.status === 'success').length;
    const failedDeliveries = this.deliveryHistory.filter(a => a.status === 'max_retries').length;
    
    const overallSuccessRate = totalHistory > 0 
      ? (successfulDeliveries / totalHistory) * 100 
      : 0;

    return {
      pendingWebhooks: totalPending,
      totalDeliveries: totalHistory,
      successfulDeliveries,
      failedDeliveries,
      overallSuccessRate: Number(overallSuccessRate.toFixed(2)),
      averageRetries: totalHistory > 0 
        ? this.deliveryHistory.reduce((sum, a) => sum + a.attempt, 0) / totalHistory
        : 0
    };
  }

  /**
   * Test webhook endpoint for a tenant
   */
  public async testWebhook(tenant: TenantConfig): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    if (!tenant.settings.webhooks.enabled || !tenant.settings.webhooks.tradeDiscoveryUrl) {
      return { success: false, error: 'Webhook not configured' };
    }

    const testPayload: WebhookPayload = {
      event: 'trade_loop_discovered',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name
      },
      data: {
        trigger: 'webhook_test',
        metadata: { test: true }
      }
    };

    const startTime = Date.now();
    
    try {
      const response = await fetch(tenant.settings.webhooks.tradeDiscoveryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SWAPS-Webhook-Test/1.0',
          'X-SWAPS-Event': 'test',
          'X-SWAPS-Tenant': tenant.id
        },
        body: JSON.stringify(testPayload),
        timeout: this.TIMEOUT_MS
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return { 
          success: false, 
          error: `HTTP ${response.status}`,
          responseTime 
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime 
      };
    }
  }
} 