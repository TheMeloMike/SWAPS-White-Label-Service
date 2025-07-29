interface StreamChunk {
  content: string;
  type: 'text' | 'markdown' | 'trade_proposal' | 'suggestions';
  metadata?: {
    isComplete?: boolean;
    chunkIndex?: number;
    totalChunks?: number;
    estimatedDuration?: number;
  };
}

interface StreamingMessage {
  id: string;
  isUser: boolean;
  timestamp: Date;
  chunks: StreamChunk[];
  isStreaming: boolean;
  isComplete: boolean;
  currentText: string;
  tradeProposal?: any;
  suggestions?: string[];
}

interface StreamingOptions {
  // Typing simulation settings
  typingSpeed: number; // characters per second
  minChunkDelay: number; // minimum delay between chunks (ms)
  maxChunkDelay: number; // maximum delay between chunks (ms)
  
  // Content parsing settings
  enableMarkdownStreaming: boolean;
  enableTradeProposalStreaming: boolean;
  enableSuggestionStreaming: boolean;
  
  // Animation settings
  showTypingIndicator: boolean;
  highlightNewContent: boolean;
  smoothScrollToBottom: boolean;
}

/**
 * Response Streaming Service
 * 
 * Provides progressive AI response display with:
 * - Intelligent text chunking for natural streaming effect
 * - Adaptive typing speeds based on content type
 * - Enhanced loading states for different response components
 * - Smooth transitions and animations
 * - Smart content parsing (markdown, trade proposals, suggestions)
 * 
 * Designed to make AI responses feel instant and engaging while
 * maintaining compatibility with existing message structures.
 */
export class ResponseStreamingService {
  private static instance: ResponseStreamingService;
  
  // Default streaming configuration
  private readonly DEFAULT_OPTIONS: StreamingOptions = {
    typingSpeed: 50, // 50 characters per second (natural reading speed)
    minChunkDelay: 100, // 100ms minimum between chunks
    maxChunkDelay: 300, // 300ms maximum between chunks
    enableMarkdownStreaming: true,
    enableTradeProposalStreaming: true,
    enableSuggestionStreaming: true,
    showTypingIndicator: true,
    highlightNewContent: true,
    smoothScrollToBottom: true
  };
  
  // Active streaming sessions
  private activeStreams: Map<string, {
    message: StreamingMessage;
    timeoutId?: NodeJS.Timeout;
    currentChunkIndex: number;
    options: StreamingOptions;
    onUpdate: (message: StreamingMessage) => void;
    onComplete: (message: StreamingMessage) => void;
  }> = new Map();
  
  // Content type patterns for adaptive streaming
  private readonly CONTENT_PATTERNS = {
    // Fast streaming for simple text
    simple: /^[^*#`\n]*$/,
    // Slower for formatted content
    formatted: /[*#`]|^-|\d+\./,
    // Pause before trade proposals
    tradeProposal: /trade|efficiency|participants|give|receive/i,
    // Pause before bullet points
    bulletPoint: /^[•\-*]/,
    // Pause before headers
    header: /^#{1,6}\s/,
    // Pause before code blocks
    codeBlock: /```/
  };
  
  private constructor() {}
  
  public static getInstance(): ResponseStreamingService {
    if (!ResponseStreamingService.instance) {
      ResponseStreamingService.instance = new ResponseStreamingService();
    }
    return ResponseStreamingService.instance;
  }
  
  /**
   * Start streaming a response progressively
   */
  public startStreaming(
    messageId: string,
    content: string,
    options: Partial<StreamingOptions> = {},
    callbacks: {
      onUpdate: (message: StreamingMessage) => void;
      onComplete: (message: StreamingMessage) => void;
    }
  ): void {
    const streamOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Parse content into streamable chunks
    const chunks = this.parseContentIntoChunks(content);
    
    // Create streaming message
    const message: StreamingMessage = {
      id: messageId,
      isUser: false,
      timestamp: new Date(),
      chunks,
      isStreaming: true,
      isComplete: false,
      currentText: '',
      tradeProposal: undefined,
      suggestions: undefined
    };
    
    // Start streaming session
    this.activeStreams.set(messageId, {
      message,
      currentChunkIndex: 0,
      options: streamOptions,
      onUpdate: callbacks.onUpdate,
      onComplete: callbacks.onComplete
    });
    
    // Start the streaming process
    this.processNextChunk(messageId);
  }
  
  /**
   * Parse response content into intelligent chunks
   */
  private parseContentIntoChunks(content: string): StreamChunk[] {
    const chunks: StreamChunk[] = [];
    
    // Split by natural breaks (paragraphs, headers, lists)
    const sections = content.split(/\n\s*\n/);
    
    sections.forEach((section, sectionIndex) => {
      // Handle different content types
      if (this.isTradeProposal(section)) {
        chunks.push({
          content: section,
          type: 'trade_proposal',
          metadata: {
            chunkIndex: chunks.length,
            estimatedDuration: 1500 // Trade proposals need time to process
          }
        });
      } else if (this.isSuggestionsSection(section)) {
        chunks.push({
          content: section,
          type: 'suggestions',
          metadata: {
            chunkIndex: chunks.length,
            estimatedDuration: 800
          }
        });
      } else {
        // Break text sections into smaller, natural chunks
        const textChunks = this.breakIntoTextChunks(section);
        textChunks.forEach(textChunk => {
          chunks.push({
            content: textChunk,
            type: this.containsMarkdown(textChunk) ? 'markdown' : 'text',
            metadata: {
              chunkIndex: chunks.length,
              estimatedDuration: this.calculateChunkDuration(textChunk)
            }
          });
        });
      }
    });
    
    // Mark the last chunk as complete
    if (chunks.length > 0) {
      chunks[chunks.length - 1].metadata = {
        ...chunks[chunks.length - 1].metadata,
        isComplete: true,
        totalChunks: chunks.length
      };
    }
    
    return chunks;
  }
  
  /**
   * Break text into natural, streamable chunks
   */
  private breakIntoTextChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/([.!?]+\s+|[\n\r]+)/);
    
    let currentChunk = '';
    const maxChunkLength = 150; // Characters per chunk
    
    sentences.forEach(sentence => {
      if (currentChunk.length + sentence.length > maxChunkLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    });
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }
  
  /**
   * Calculate appropriate duration for a chunk based on content
   */
  private calculateChunkDuration(content: string): number {
    const baseSpeed = this.DEFAULT_OPTIONS.typingSpeed; // chars per second
    let duration = (content.length / baseSpeed) * 1000; // Convert to ms
    
    // Adjust duration based on content type
    if (this.CONTENT_PATTERNS.formatted.test(content)) {
      duration *= 1.3; // 30% slower for formatted content
    }
    
    if (this.CONTENT_PATTERNS.tradeProposal.test(content)) {
      duration *= 1.5; // 50% slower for trade content
    }
    
    if (this.CONTENT_PATTERNS.bulletPoint.test(content)) {
      duration += 200; // Extra pause before bullet points
    }
    
    if (this.CONTENT_PATTERNS.header.test(content)) {
      duration += 300; // Extra pause before headers
    }
    
    // Ensure reasonable bounds
    return Math.max(this.DEFAULT_OPTIONS.minChunkDelay, 
                   Math.min(duration, 2000)); // Max 2 seconds per chunk
  }
  
  /**
   * Process the next chunk in the streaming sequence
   */
  private processNextChunk(messageId: string): void {
    const session = this.activeStreams.get(messageId);
    if (!session) return;
    
    const { message, currentChunkIndex, options, onUpdate, onComplete } = session;
    
    // Check if streaming is complete
    if (currentChunkIndex >= message.chunks.length) {
      this.completeStreaming(messageId);
      return;
    }
    
    const currentChunk = message.chunks[currentChunkIndex];
    
    // Update message with current chunk
    message.currentText += (message.currentText ? ' ' : '') + currentChunk.content;
    
    // Handle special chunk types
    if (currentChunk.type === 'trade_proposal') {
      this.extractTradeProposal(message, currentChunk.content);
    } else if (currentChunk.type === 'suggestions') {
      this.extractSuggestions(message, currentChunk.content);
    }
    
    // Update session
    session.currentChunkIndex++;
    
    // Notify update
    onUpdate(message);
    
    // Schedule next chunk
    const delay = currentChunk.metadata?.estimatedDuration || this.DEFAULT_OPTIONS.minChunkDelay;
    const timeoutId = setTimeout(() => {
      this.processNextChunk(messageId);
    }, delay);
    
    session.timeoutId = timeoutId;
  }
  
  /**
   * Complete the streaming process
   */
  private completeStreaming(messageId: string): void {
    const session = this.activeStreams.get(messageId);
    if (!session) return;
    
    const { message, onComplete } = session;
    
    // Mark as complete
    message.isStreaming = false;
    message.isComplete = true;
    
    // Clean up timeout
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    
    // Remove from active streams
    this.activeStreams.delete(messageId);
    
    // Notify completion
    onComplete(message);
  }
  
  /**
   * Stop streaming for a specific message
   */
  public stopStreaming(messageId: string): void {
    const session = this.activeStreams.get(messageId);
    if (!session) return;
    
    // Cancel any pending timeout
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    
    // Complete immediately with all remaining content
    const { message } = session;
    const remainingChunks = message.chunks.slice(session.currentChunkIndex);
    const remainingContent = remainingChunks.map(chunk => chunk.content).join(' ');
    
    message.currentText += (message.currentText ? ' ' : '') + remainingContent;
    message.isStreaming = false;
    message.isComplete = true;
    
    // Extract any remaining special content
    remainingChunks.forEach(chunk => {
      if (chunk.type === 'trade_proposal') {
        this.extractTradeProposal(message, chunk.content);
      } else if (chunk.type === 'suggestions') {
        this.extractSuggestions(message, chunk.content);
      }
    });
    
    // Notify completion
    session.onComplete(message);
    
    // Clean up
    this.activeStreams.delete(messageId);
  }
  
  /**
   * Extract trade proposal from content
   */
  private extractTradeProposal(message: StreamingMessage, content: string): void {
    // Simple pattern matching for trade proposals
    // In a real implementation, this would parse structured trade data
    const efficiencyMatch = content.match(/(\d+)%\s*efficiency/i);
    const participantsMatch = content.match(/(\d+)\s*participants?/i);
    
    if (efficiencyMatch || participantsMatch) {
      message.tradeProposal = {
        efficiency: efficiencyMatch ? parseInt(efficiencyMatch[1]) : 0,
        participants: participantsMatch ? parseInt(participantsMatch[1]) : 0,
        content: content
      };
    }
  }
  
  /**
   * Extract suggestions from content
   */
  private extractSuggestions(message: StreamingMessage, content: string): void {
    // Look for suggestion patterns
    const suggestionLines = content.split('\n').filter(line => 
      line.trim().startsWith('•') || 
      line.trim().startsWith('-') ||
      line.trim().startsWith('*')
    );
    
    if (suggestionLines.length > 0) {
      message.suggestions = suggestionLines.map(line => 
        line.replace(/^[•\-*]\s*/, '').trim()
      ).filter(suggestion => suggestion.length > 0);
    }
  }
  
  /**
   * Content type detection helpers
   */
  private isTradeProposal(content: string): boolean {
    const tradeKeywords = ['efficiency', 'participants', 'give', 'receive', 'trade'];
    const keywordCount = tradeKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;
    return keywordCount >= 2;
  }
  
  private isSuggestionsSection(content: string): boolean {
    const lines = content.split('\n');
    const bulletLines = lines.filter(line => 
      line.trim().match(/^[•\-*]/)).length;
    return bulletLines >= 2 || content.toLowerCase().includes('suggestions');
  }
  
  private containsMarkdown(content: string): boolean {
    return /[*#`_]|\[.*\]|\*\*/.test(content);
  }
  
  /**
   * Get current streaming status
   */
  public getStreamingStatus(messageId: string): {
    isStreaming: boolean;
    progress: number;
    estimatedTimeRemaining: number;
  } | null {
    const session = this.activeStreams.get(messageId);
    if (!session) return null;
    
    const { message, currentChunkIndex } = session;
    const progress = message.chunks.length > 0 ? 
      currentChunkIndex / message.chunks.length : 0;
    
    const remainingChunks = message.chunks.slice(currentChunkIndex);
    const estimatedTimeRemaining = remainingChunks.reduce((total, chunk) => 
      total + (chunk.metadata?.estimatedDuration || 500), 0);
    
    return {
      isStreaming: message.isStreaming,
      progress: progress * 100,
      estimatedTimeRemaining
    };
  }
  
  /**
   * Generate typing indicator content for loading states
   */
  public generateTypingIndicator(): string {
    const indicators = ['●', '●●', '●●●'];
    const index = Math.floor(Date.now() / 500) % indicators.length;
    return indicators[index];
  }
  
  /**
   * Create enhanced skeleton loading based on expected content type
   */
  public createSkeletonForContentType(type: 'simple' | 'trade_analysis' | 'portfolio' | 'search'): string[] {
    switch (type) {
      case 'trade_analysis':
        return [
          '🔍 Analyzing trade opportunity...',
          '📊 Calculating efficiency metrics...',
          '⚖️ Evaluating fairness factors...',
          '🎯 Generating recommendation...'
        ];
      
      case 'portfolio':
        return [
          '📦 Scanning your NFT portfolio...',
          '🔍 Identifying tradeable assets...',
          '📈 Calculating portfolio value...',
          '🎯 Finding optimization opportunities...'
        ];
      
      case 'search':
        return [
          '🌐 Searching SWAPS network...',
          '🔄 Discovering trade paths...',
          '⚡ Finding best matches...',
          '📋 Preparing results...'
        ];
      
      default:
        return [
          '🤖 Processing your request...',
          '💭 Generating response...',
          '✨ Almost ready...'
        ];
    }
  }
} 