interface SuggestionContext {
  // User State
  userWallet?: string;
  userNFTs?: Array<{name?: string; collection?: string; address: string}>;
  isWalletConnected: boolean;
  
  // Conversation Context
  lastUserMessage?: string;
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string}>;
  messageCount: number;
  
  // Trade Context
  lastShownTrades?: Array<{
    efficiency: number;
    totalParticipants: number;
    steps: Array<{
      from: string;
      to: string;
      nfts: Array<{name?: string; collection?: string; address: string}>;
    }>;
  }>;
  currentTradeIndex?: number;
  
  // Market Context
  trendingCollections?: Array<{name: string; floorPrice?: number}>;
  trendingNFTs?: Array<{name: string; collection?: string}>;
  hasRecentMarketData: boolean;
  
  // Intent Context
  lastDetectedIntent?: string;
  userExperienceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

interface SmartSuggestion {
  text: string;
  priority: number; // 1-5, 5 being highest priority
  category: 'action' | 'exploration' | 'education' | 'navigation';
  context: string; // why this suggestion is relevant
  icon?: string;
}

/**
 * Smart Suggestion Engine
 * 
 * Generates dynamic, context-aware suggestions that adapt to:
 * - User's current state and NFT portfolio
 * - Conversation history and detected patterns
 * - Available trade opportunities  
 * - Market conditions and trending data
 * - User experience level and preferences
 * 
 * Designed to be modular and scalable - can easily add new suggestion types
 * and context analysis without affecting existing functionality.
 */
export class SmartSuggestionEngine {
  private static instance: SmartSuggestionEngine;
  
  // Configuration
  private readonly MAX_SUGGESTIONS = 4;
  private readonly SUGGESTION_WEIGHTS = {
    action: 1.2,      // Execute trades, make decisions
    exploration: 1.0, // Discover new opportunities  
    education: 0.8,   // Learn about features
    navigation: 0.9   // Move through interface
  };
  
  private constructor() {}
  
  public static getInstance(): SmartSuggestionEngine {
    if (!SmartSuggestionEngine.instance) {
      SmartSuggestionEngine.instance = new SmartSuggestionEngine();
    }
    return SmartSuggestionEngine.instance;
  }
  
  /**
   * Generate contextually relevant suggestions
   */
  public generateSuggestions(context: SuggestionContext): string[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Priority 1: Immediate Action Opportunities
    suggestions.push(...this.getActionSuggestions(context));
    
    // Priority 2: Exploration & Discovery
    suggestions.push(...this.getExplorationSuggestions(context));
    
    // Priority 3: Educational Content (for new users)
    suggestions.push(...this.getEducationalSuggestions(context));
    
    // Priority 4: Navigation & Flow
    suggestions.push(...this.getNavigationSuggestions(context));
    
    // Sort by weighted priority and return top suggestions
    return this.prioritizeAndFormatSuggestions(suggestions);
  }
  
  /**
   * Action-oriented suggestions - highest priority
   */
  private getActionSuggestions(context: SuggestionContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Trade execution opportunities
    if (context.lastShownTrades && context.lastShownTrades.length > 0) {
      const currentTrade = context.lastShownTrades[context.currentTradeIndex || 0];
      
      if (currentTrade.efficiency >= 0.95) {
        suggestions.push({
          text: "🚀 Execute this excellent trade!",
          priority: 5,
          category: 'action',
          context: 'High efficiency trade available',
          icon: '⚡'
        });
      } else if (currentTrade.efficiency >= 0.85) {
        suggestions.push({
          text: "✅ Execute this good trade",
          priority: 4,
          category: 'action', 
          context: 'Good efficiency trade available',
          icon: '👍'
        });
      } else {
        suggestions.push({
          text: "🔍 Find better alternatives",
          priority: 3,
          category: 'action',
          context: 'Current trade could be improved',
          icon: '🎯'
        });
      }
      
      // Multi-option navigation
      if (context.lastShownTrades && context.lastShownTrades.length > 1) {
        suggestions.push({
          text: "➡️ Show next best trade",
          priority: 3,
          category: 'navigation',
          context: `${context.lastShownTrades.length - 1} more trades available`,
          icon: '📊'
        });
      }
    }
    
    // Portfolio optimization for users with NFTs
    if (context.userNFTs && context.userNFTs.length > 0) {
      if (context.userNFTs.length >= 10) {
        suggestions.push({
          text: `📊 Analyze my ${context.userNFTs.length} NFT portfolio`,
          priority: 4,
          category: 'action',
          context: 'Large portfolio ready for optimization',
          icon: '🔍'
        });
      } else if (context.userNFTs.length >= 3) {
        suggestions.push({
          text: "🔄 Find trades for my NFTs",
          priority: 4,
          category: 'action', 
          context: 'Active portfolio with trade potential',
          icon: '💫'
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Exploration and discovery suggestions
   */
  private getExplorationSuggestions(context: SuggestionContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Trending opportunities
    if (context.trendingCollections && context.trendingCollections.length > 0) {
      const topTrending = context.trendingCollections[0];
      suggestions.push({
        text: `🔥 Explore ${topTrending.name} opportunities`,
        priority: 3,
        category: 'exploration',
        context: 'Hot trending collection',
        icon: '🌟'
      });
    }
    
    if (context.trendingNFTs && context.trendingNFTs.length > 0) {
      const topTrendingNFT = context.trendingNFTs[0];
      suggestions.push({
        text: `⭐ Find path to ${topTrendingNFT.name}`,
        priority: 3,
        category: 'exploration',
        context: 'Trending NFT with high demand',
        icon: '🎯'
      });
    }
    
    // Discovery based on conversation patterns
    if (this.hasAskedAboutSpecificCollection(context)) {
      suggestions.push({
        text: "🎨 Browse similar collections", 
        priority: 2,
        category: 'exploration',
        context: 'User showed interest in specific collections',
        icon: '🔍'
      });
    }
    
    // Trade type exploration
    if (context.lastShownTrades && context.lastShownTrades.length > 0) {
      const tradeTypes = this.analyzeTradeTypes(context.lastShownTrades);
      
      if (tradeTypes.hasDirectTrades && !tradeTypes.hasMultiParty) {
        suggestions.push({
          text: "🔗 Explore multi-party trades",
          priority: 2, 
          category: 'exploration',
          context: 'User only seeing direct trades',
          icon: '🌐'
        });
      } else if (tradeTypes.hasMultiParty && !tradeTypes.hasDirectTrades) {
        suggestions.push({
          text: "⚡ Find quick direct trades",
          priority: 2,
          category: 'exploration', 
          context: 'User only seeing complex trades',
          icon: '🎯'
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Educational suggestions - especially for new users
   */
  private getEducationalSuggestions(context: SuggestionContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Onboarding suggestions for new users
    if (context.messageCount <= 3) {
      if (!context.isWalletConnected) {
        suggestions.push({
          text: "🔗 How does wallet connection work?",
          priority: 2,
          category: 'education',
          context: 'New user without wallet',
          icon: '❓'
        });
      }
      
      suggestions.push({
        text: "💡 What makes a good trade?",
        priority: 2,
        category: 'education',
        context: 'New user learning basics',
        icon: '🎓'
      });
      
      suggestions.push({
        text: "🌟 How does SWAPS work?",
        priority: 1,
        category: 'education',
        context: 'New user needs overview',
        icon: '📚'
      });
    }
    
    // Advanced concepts for engaged users
    if (context.messageCount > 10 && context.lastShownTrades && context.lastShownTrades.length > 0) {
      suggestions.push({
        text: "🔬 Understand quality scoring",
        priority: 1,
        category: 'education',
        context: 'Experienced user ready for advanced concepts',
        icon: '⚗️'
      });
    }
    
    return suggestions;
  }
  
  /**
   * Navigation and flow suggestions
   */
  private getNavigationSuggestions(context: SuggestionContext): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Navigation within trade results
    if (context.lastShownTrades && context.lastShownTrades.length > 1) {
      const currentIndex = context.currentTradeIndex || 0;
      const totalTrades = context.lastShownTrades.length;
      
      if (currentIndex < totalTrades - 1) {
        suggestions.push({
          text: `➡️ View trade ${currentIndex + 2} of ${totalTrades}`,
          priority: 2,
          category: 'navigation',
          context: 'More trades available to explore',
          icon: '📄'
        });
      }
      
      if (currentIndex > 0) {
        suggestions.push({
          text: "⬅️ Back to previous trade",
          priority: 1,
          category: 'navigation', 
          context: 'User has seen other trades',
          icon: '↩️'
        });
      }
    }
    
    // Fresh search suggestions
    if (context.lastShownTrades && context.lastShownTrades.length > 0) {
      suggestions.push({
        text: "🔄 Search for more opportunities",
        priority: 2,
        category: 'navigation',
        context: 'Expand beyond current results', 
        icon: '🔍'
      });
    }
    
    return suggestions;
  }
  
  /**
   * Analyze conversation for collection interest patterns
   */
  private hasAskedAboutSpecificCollection(context: SuggestionContext): boolean {
    if (!context.conversationHistory) return false;
    
    const recentMessages = context.conversationHistory.slice(-5);
    const collectionKeywords = ['mad lads', 'degods', 'y00ts', 'claynosaurz', 'okay bears'];
    
    return recentMessages.some(msg => 
      collectionKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    );
  }
  
  /**
   * Analyze trade types in current results
   */
  private analyzeTradeTypes(trades: SuggestionContext['lastShownTrades']): {
    hasDirectTrades: boolean;
    hasMultiParty: boolean;
    avgParticipants: number;
  } {
    if (!trades || trades.length === 0) {
      return { hasDirectTrades: false, hasMultiParty: false, avgParticipants: 0 };
    }
    
    const participantCounts = trades.map(t => t.totalParticipants);
    const hasDirectTrades = participantCounts.some(count => count === 2);
    const hasMultiParty = participantCounts.some(count => count > 2);
    const avgParticipants = participantCounts.reduce((sum, count) => sum + count, 0) / participantCounts.length;
    
    return { hasDirectTrades, hasMultiParty, avgParticipants };
  }
  
  /**
   * Prioritize suggestions and format for UI
   */
  private prioritizeAndFormatSuggestions(suggestions: SmartSuggestion[]): string[] {
    // Apply category weights to priorities
    const weightedSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      weightedPriority: suggestion.priority * this.SUGGESTION_WEIGHTS[suggestion.category]
    }));
    
    // Sort by weighted priority (descending) and remove duplicates
    const uniqueSuggestions = new Map<string, SmartSuggestion>();
    
    weightedSuggestions
      .sort((a, b) => b.weightedPriority - a.weightedPriority)
      .forEach(suggestion => {
        if (!uniqueSuggestions.has(suggestion.text)) {
          uniqueSuggestions.set(suggestion.text, suggestion);
        }
      });
    
    // Return top suggestions formatted for UI
    return Array.from(uniqueSuggestions.values())
      .slice(0, this.MAX_SUGGESTIONS)
      .map(suggestion => suggestion.text);
  }
  
  /**
   * Quick helper for simple context-aware suggestions
   */
  public getQuickSuggestions(
    hasWallet: boolean, 
    hasNFTs: boolean, 
    hasTrades: boolean,
    messageCount: number = 0
  ): string[] {
    const context: SuggestionContext = {
      isWalletConnected: hasWallet,
      userNFTs: hasNFTs ? [{name: 'NFT', collection: 'test', address: 'test'}] : [],
      lastShownTrades: hasTrades ? [{efficiency: 0.9, totalParticipants: 2, steps: []}] : [],
      messageCount,
      hasRecentMarketData: true
    };
    
    return this.generateSuggestions(context);
  }
} 