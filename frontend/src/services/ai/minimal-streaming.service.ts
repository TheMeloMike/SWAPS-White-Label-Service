interface MinimalStreamingOptions {
  charactersPerSecond: number; // Characters per second for typing effect
  initialDelay: number; // Delay before starting to type (ms)
  enableMarkdownStreaming: boolean; // Whether to stream markdown progressively
}

interface StreamingSession {
  messageId: string;
  fullText: string;
  currentIndex: number;
  isActive: boolean;
  intervalId?: NodeJS.Timeout;
  onUpdate: (text: string, isComplete: boolean) => void;
  onComplete: () => void;
}

/**
 * Minimal Streaming Service
 * 
 * Provides clean character-by-character streaming without intrusive UI:
 * - True character-by-character typing effect
 * - Minimal loading states (just a simple typing indicator)
 * - No chunky text blocks or large progress bars
 * - Respects chat layout and doesn't cause overflow
 */
export class MinimalStreamingService {
  private static instance: MinimalStreamingService;
  
  private readonly DEFAULT_OPTIONS: MinimalStreamingOptions = {
    charactersPerSecond: 100, // Much faster typing speed
    initialDelay: 200, // Shorter delay before starting
    enableMarkdownStreaming: true
  };
  
  private activeSessions: Map<string, StreamingSession> = new Map();
  
  private constructor() {}
  
  public static getInstance(): MinimalStreamingService {
    if (!MinimalStreamingService.instance) {
      MinimalStreamingService.instance = new MinimalStreamingService();
    }
    return MinimalStreamingService.instance;
  }
  
  /**
   * Start character-by-character streaming
   */
  public startStreaming(
    messageId: string,
    fullText: string,
    options: Partial<MinimalStreamingOptions> = {},
    callbacks: {
      onUpdate: (text: string, isComplete: boolean) => void;
      onComplete: () => void;
    }
  ): void {
    // Stop any existing session for this message
    this.stopStreaming(messageId);
    
    const streamOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const session: StreamingSession = {
      messageId,
      fullText,
      currentIndex: 0,
      isActive: true,
      onUpdate: callbacks.onUpdate,
      onComplete: callbacks.onComplete
    };
    
    this.activeSessions.set(messageId, session);
    
    // Start with initial delay
    setTimeout(() => {
      if (session.isActive) {
        this.startCharacterStreaming(session, streamOptions);
      }
    }, streamOptions.initialDelay);
  }
  
  /**
   * Character-by-character streaming implementation
   */
  private startCharacterStreaming(
    session: StreamingSession,
    options: MinimalStreamingOptions
  ): void {
    const intervalMs = 1000 / options.charactersPerSecond;
    
    session.intervalId = setInterval(() => {
      if (!session.isActive || session.currentIndex >= session.fullText.length) {
        this.completeStreaming(session.messageId);
        return;
      }
      
      // Add next character
      session.currentIndex++;
      const currentText = session.fullText.substring(0, session.currentIndex);
      
      // Update with current text
      session.onUpdate(currentText, false);
      
      // Handle special characters (pause slightly at punctuation)
      const lastChar = session.fullText[session.currentIndex - 1];
      if (['.', '!', '?', '\n'].includes(lastChar)) {
        // Brief pause at sentence endings
        if (session.intervalId) {
          clearInterval(session.intervalId);
          setTimeout(() => {
            if (session.isActive) {
              this.startCharacterStreaming(session, options);
            }
          }, intervalMs * 1.5); // Shorter pause at punctuation
        }
      }
    }, intervalMs);
  }
  
  /**
   * Complete streaming session
   */
  private completeStreaming(messageId: string): void {
    const session = this.activeSessions.get(messageId);
    if (!session) return;
    
    // Clear interval
    if (session.intervalId) {
      clearInterval(session.intervalId);
    }
    
    // Mark as complete
    session.isActive = false;
    
    // Final update with complete text
    session.onUpdate(session.fullText, true);
    session.onComplete();
    
    // Clean up
    this.activeSessions.delete(messageId);
  }
  
  /**
   * Stop streaming (user clicked to complete)
   */
  public stopStreaming(messageId: string): void {
    const session = this.activeSessions.get(messageId);
    if (!session) return;
    
    session.isActive = false;
    this.completeStreaming(messageId);
  }
  
  /**
   * Check if a message is currently streaming
   */
  public isStreaming(messageId: string): boolean {
    const session = this.activeSessions.get(messageId);
    return session?.isActive ?? false;
  }
  
  /**
   * Get simple progress (0-100)
   */
  public getProgress(messageId: string): number {
    const session = this.activeSessions.get(messageId);
    if (!session) return 100;
    
    return (session.currentIndex / session.fullText.length) * 100;
  }
  
  /**
   * Clean up all sessions (on unmount)
   */
  public cleanup(): void {
    Array.from(this.activeSessions.keys()).forEach(messageId => {
      this.stopStreaming(messageId);
    });
  }
  
  /**
   * Simple typing indicator animation
   */
  public getTypingIndicator(): string {
    const dots = ['', '.', '..', '...'];
    const index = Math.floor(Date.now() / 500) % dots.length;
    return `🤖${dots[index]}`;
  }
} 