/**
 * Structured logging service
 * Provides a centralized way to handle logging throughout the application
 */
import { ILoggingService, ILogger, ILoggerOperation } from '../../types/services';
import { injectable } from 'tsyringe';

@injectable()
export class LoggingService implements ILoggingService {
  private static instance: LoggingService;
  private loggers: Map<string, Logger> = new Map();
  
  constructor() {
    // Initialize with a default logger
    this.loggers.set('default', new Logger('default'));
  }
  
  /**
   * Get the singleton instance
   * @deprecated Use dependency injection instead
   */
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }
  
  /**
   * Create a new logger for a specific component
   */
  public createLogger(component: string): Logger {
    if (this.loggers.has(component)) {
      return this.loggers.get(component)!;
    }
    
    const logger = new Logger(component);
    this.loggers.set(component, logger);
    return logger;
  }
}

/**
 * Logger class for a specific component
 */
export class Logger implements ILogger {
  private component: string;
  
  constructor(component: string) {
    this.component = component;
  }
  
  /**
   * Log an info message
   */
  public info(message: string, context: Record<string, unknown> = {}): void {
    this.log('INFO', message, context);
  }
  
  /**
   * Log a warning message
   */
  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.log('WARN', message, context);
  }
  
  /**
   * Log an error message
   */
  public error(message: string, context: Record<string, unknown> = {}): void {
    this.log('ERROR', message, context);
  }
  
  /**
   * Log a debug message
   */
  public debug(message: string, context: Record<string, unknown> = {}): void {
    this.log('DEBUG', message, context);
  }
  
  /**
   * Create an operation that can be timed and logged as a unit
   */
  public operation(name: string): Operation {
    return new Operation(this, name);
  }
  
  /**
   * Internal method to handle the actual logging
   */
  private log(level: string, message: string, context: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length > 0 
      ? JSON.stringify(context)
      : '';
    
    console.log(`[${timestamp}] [${level}] [${this.component}] ${message} ${contextStr}`);
  }
}

/**
 * Operation class for tracking and timing operations
 */
export class Operation implements ILoggerOperation {
  private logger: Logger;
  private name: string;
  private startTime: number;
  private ended: boolean = false;
  
  constructor(logger: Logger, name: string) {
    this.logger = logger;
    this.name = name;
    this.startTime = performance.now();
  }
  
  /**
   * Log an info message within this operation
   */
  public info(message: string, context: Record<string, unknown> = {}): void {
    this.logger.info(`[Operation:${this.name}] ${message}`, context);
  }
  
  /**
   * Log a warning message within this operation
   */
  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(`[Operation:${this.name}] ${message}`, context);
  }
  
  /**
   * Log an error message within this operation
   */
  public error(message: string, context: Record<string, unknown> = {}): void {
    this.logger.error(`[Operation:${this.name}] ${message}`, context);
  }
  
  /**
   * Log a debug message within this operation
   */
  public debug(message: string, context: Record<string, unknown> = {}): void {
    this.logger.debug(`[Operation:${this.name}] ${message}`, context);
  }
  
  /**
   * End the operation and log its duration
   */
  public end(): void {
    if (this.ended) return;
    
    const duration = performance.now() - this.startTime;
    this.logger.info(`[Operation:${this.name}] Completed in ${duration.toFixed(2)}ms`);
    this.ended = true;
  }
} 