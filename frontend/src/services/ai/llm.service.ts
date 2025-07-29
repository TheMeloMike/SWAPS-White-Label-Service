import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { SwapsKnowledgeService } from './swaps-knowledge.service';
import { AIResponseCacheService } from './ai-response-cache.service';
import { CollectionService } from '@/services/collection';
import { TrendingService } from '@/services/trending';
import { StatsService } from '@/services/stats';
import { NFTService } from '@/services/nft';
import { TradeService } from '@/services/trade';
import OpenAI from 'openai';

export interface LLMResponse {
  message: string;
  suggestions?: string[];
  extractedNFTAddress?: string;
  shouldSearchTrades?: boolean;
  confidence?: number;
  tradeAnalysis?: {
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high';
    marketInsight: string;
  };
}

interface MarketContext {
  totalVolume24h: number;
  activeTraders: number;
  topCollections: string[];
  trendingNFTs: { name: string; volume: number; priceChange: number }[];
  swapsNetworkStats: {
    totalLoopsFound: number;
    averageLoopSize: number;
    successRate: number;
  };
}

export class LLMService {
  private static instance: LLMService;
  private apiKey: string;
  private model: 'gpt-4-turbo-preview' | 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3.5-sonnet';
  private openai: OpenAI | null = null;
  private conversationHistory: any[] = [];
  private swapsKnowledgeService: SwapsKnowledgeService;
  
  // Enhanced system prompt with better personality and capabilities
  private readonly systemPrompt = `You are SWAPS AI - a precise NFT trading assistant that works ONLY with real trade data.

ABOUT SWAPS:
- SWAPS is a revolutionary multi-party NFT trading platform created by melomike
- Follow melomike on X: https://x.com/melomike_
- It enables complex trade loops and multi-party bartering on Solana
- The platform uses advanced algorithms to discover trading opportunities that would be impossible to find manually

IMPORTANT: When mentioning melomike or the creator of SWAPS, ALWAYS include the full URL link:
- Use: "SWAPS was created by melomike. Follow them on X: https://x.com/melomike_"
- NOT: "SWAPS was created by melomike (@melomike_)" or "known on X as @melomike_"

CRITICAL RULES - NEVER BREAK THESE:
1. **ONLY use real trade data provided to you** - Never make up NFT names, collections, or trade details
2. **NEVER claim to know user's portfolio** unless actual NFT data is provided in context
3. **NEVER hallucinate trade chains** - Only suggest trades that exist in the provided data
4. **Stay focused on the specific trades shown** - Don't go off on tangents about fake opportunities
5. **Be consistent** - Don't contradict yourself or change recommendations mid-conversation

CORE IDENTITY:
- You analyze ACTUAL trades found in the SWAPS network
- You speak with confidence about REAL data, uncertainty about unknowns
- You're helpful but never make things up
- You focus on the trade the user is asking about
- You are a helpful assistant that can help the user find the best trade opportunities
- You engage in a friendly conversation about NFTs with the user regarding their portfolio, NFT interests and desires.
- You are trying to help the user find trades that can help them trade up in value.

RESPONSE GUIDELINES:
1. **Analyze the specific trade shown**: Focus on the actual trade data provided
2. **Use exact NFT names and details**: Only reference NFTs mentioned in the context
3. **Be specific about trade mechanics**: Explain how the actual trade works without mentioning the number ofparticipants
4. **Assess real factors**: Use actual efficiency scores, participant counts, quality scores,etc.
5. **Suggest next actions**: Based on real options available

WHEN ANALYZING TRADES:
- Reference the exact NFT names and collections shown
- Use the actual efficiency and quality scores provided
- Do not mention the real participant count
- Explain what makes this specific trade good or not using real data
- Only suggest alternatives if you have real alternative data

NEVER DO:
- Make up user portfolio data ("your top holdings are...")
- Invent complex multi-step trade chains not in the data
- Change your analysis completely between messages
- Claim knowledge you don't have
- Suggest fake trades or opportunities

FORMAT YOUR RESPONSES:
- Be direct and helpful
- Use **bold** for actual NFT names from the data
- Include real trade metrics (efficiency %, participants)
- Focus on actionable advice about the real trade shown`;

  // Enhanced intent categories for better understanding
  private readonly INTENT_CATEGORIES = {
    ONBOARDING: ['how does', 'what is swaps', 'getting started', 'new to', 'explain', 'help me understand'],
    TRADING: ['trade', 'swap', 'exchange', 'find path', 'want to get', 'looking for', 'need', 'acquire'],
    ANALYTICS: ['stats', 'metrics', 'how many', 'volume', 'performance', 'success rate', 'data'],
    TROUBLESHOOTING: ['not working', 'error', 'problem', 'issue', 'help', 'stuck', 'failed'],
    FEATURE_DISCOVERY: ['can i', 'is it possible', 'how to', 'features', 'what can', 'able to'],
    MARKET_INSIGHTS: ['trending', 'popular', 'hot', 'best', 'top', 'rising', 'floor price'],
    PRICING: ['price', 'floor', 'value', 'worth', 'cost', 'expensive', 'cheap'],
    PORTFOLIO: ['my nfts', 'portfolio', 'inventory', 'what i own', 'my collection', 'holdings'],
    COLLECTIONS: ['collection', 'verified', 'available', 'browse', 'explore'],
    EDUCATION: ['learn', 'understand', 'why', 'benefit', 'advantage', 'how it works'],
    OPPORTUNITY: ['opportunity', 'recommend', 'suggest', 'best trade', 'profitable', 'good deal'],
    STATUS: ['status', 'active', 'pending', 'completed', 'history', 'past trades']
  };

  // Industry best practice: Knowledge domains
  private readonly KNOWLEDGE_DOMAINS = {
    TECHNICAL: ['algorithm', 'api', 'smart contract', 'blockchain', 'solana'],
    BUSINESS: ['revenue', 'fees', 'cost', 'pricing model'],
    USER_JOURNEY: ['onboard', 'connect wallet', 'first trade', 'tutorial'],
    ECOSYSTEM: ['partners', 'integrations', 'marketplaces', 'wallets']
  };

  // Enhanced response templates for consistency
  private readonly RESPONSE_TEMPLATES = {
    GREETING: "🎯 Welcome to SWAPS! I'm your AI trading expert. ",
    DATA_FOUND: "✅ Found exactly what you're looking for! ",
    NO_DATA: "🔍 I couldn't find that specific data, but ",
    ACTION_REQUIRED: "⚡ To proceed, please ",
    SUGGESTION: "💡 Pro tip: ",
    ERROR_CONTEXT: "⚠️ I see there's an issue. ",
    OPPORTUNITY_FOUND: "🚀 Great opportunity alert! ",
    MARKET_INSIGHT: "📊 Market insight: ",
    PORTFOLIO_ANALYSIS: "💼 Portfolio analysis: "
  };

  private constructor() {
    // Try to get API key from environment with fallback
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
                  process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || 
                  '';
    
    console.log('🚀 Enhanced LLM Service initializing...', {
      hasEnvKey: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      isOpenAIKey: this.apiKey?.startsWith('sk-')
    });
    
    // Upgrade to GPT-4 by default for better performance
    this.model = this.apiKey.startsWith('sk-') ? 'gpt-4-turbo-preview' : 'claude-3.5-sonnet';
    
    console.log('🤖 LLM Service configured with model:', this.model);

    if (this.apiKey && this.apiKey.startsWith('sk-')) {
      console.log('🔧 Initializing enhanced OpenAI client...');
      try {
        this.openai = new OpenAI({ 
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true,
          maxRetries: 3,
          timeout: 30000 // 30 second timeout
        });
        
        console.log('✅ OpenAI client initialized successfully');
        
        // Test the connection immediately
        this.testOpenAIConnection().then(result => {
          console.log('🔌 OpenAI connection test:', result ? '✅ Success' : '❌ Failed');
        });
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI:', error);
        console.warn('Will use intelligent fallback responses');
      }
    }
    
    this.swapsKnowledgeService = SwapsKnowledgeService.getInstance();
    console.log('✅ SwapsKnowledgeService connected');
  }

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  /**
   * Industry best practice: Intent recognition for better query understanding
   */
  private recognizeIntent(userMessage: string): string[] {
    const lowerMessage = userMessage.toLowerCase();
    const recognizedIntents: string[] = [];
    
    Object.entries(this.INTENT_CATEGORIES).forEach(([intent, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        recognizedIntents.push(intent);
      }
    });
    
    // Default to general inquiry if no specific intent
    if (recognizedIntents.length === 0) {
      recognizedIntents.push('GENERAL_INQUIRY');
    }
    
    console.log('Recognized intents:', recognizedIntents);
    return recognizedIntents;
  }

  /**
   * Industry best practice: Entity extraction for precise data fetching
   */
  private extractEntities(userMessage: string): {
    nftAddresses: string[];
    collectionNames: string[];
    walletAddresses: string[];
    numbers: number[];
    timeframes: string[];
  } {
    const entities = {
      nftAddresses: (userMessage.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || []),
      collectionNames: this.extractCollectionNames(userMessage),
      walletAddresses: this.extractWalletAddresses(userMessage),
      numbers: (userMessage.match(/\d+/g) || []).map(n => parseInt(n)),
      timeframes: this.extractTimeframes(userMessage)
    };
    
    console.log('Extracted entities:', entities);
    return entities;
  }

  private extractCollectionNames(message: string): string[] {
    const knownCollections = [
      'mad lads', 'degods', 'okay bears', 'ghost kid', 'claynosaurz',
      'smb', 'abc', 'famous fox', 'degenerate ape', 'aurory'
    ];
    
    const found: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    knownCollections.forEach(collection => {
      if (lowerMessage.includes(collection)) {
        found.push(collection);
      }
    });
    
    // Also extract quoted strings as potential collection names
    const quotedPattern = /"([^"]+)"|'([^']+)'/g;
    let match;
    while ((match = quotedPattern.exec(message)) !== null) {
      found.push(match[1] || match[2]);
    }
    
    return Array.from(new Set(found));
  }

  private extractWalletAddresses(message: string): string[] {
    // Solana wallet addresses are base58 encoded and typically 32-44 chars
    // But we need to distinguish from NFT addresses
    const potentialAddresses = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
    
    // Filter out known NFT patterns (this is simplified)
    return potentialAddresses.filter(addr => 
      message.toLowerCase().includes('wallet') && 
      message.indexOf(addr) > message.toLowerCase().indexOf('wallet') - 50
    );
  }

  private extractTimeframes(message: string): string[] {
    const timeframes: string[] = [];
    const patterns = {
      '24h': /24\s*h|24\s*hour|today|daily/gi,
      '7d': /7\s*d|7\s*day|week|weekly/gi,
      '30d': /30\s*d|30\s*day|month|monthly/gi,
      'all': /all\s*time|total|overall|lifetime/gi
    };
    
    Object.entries(patterns).forEach(([timeframe, pattern]) => {
      if (pattern.test(message)) {
        timeframes.push(timeframe);
      }
    });
    
    return timeframes;
  }

  /**
   * Enhanced data fetching with intent-based optimization
   */
  private async analyzeAndFetchRelevantData(userMessage: string): Promise<any> {
    const intents = this.recognizeIntent(userMessage);
    const entities = this.extractEntities(userMessage);
    const data: any = {
      intents,
      entities
    };
    
    try {
      // Parallel data fetching based on intents
      const fetchPromises: Promise<void>[] = [];
      
      // Collections data
      if (intents.includes('COLLECTIONS') || entities.collectionNames.length > 0) {
        fetchPromises.push(this.fetchCollectionData(data, entities, userMessage));
      }
      
      // Trading data
      if (intents.includes('TRADING') || entities.nftAddresses.length > 0) {
        fetchPromises.push(this.fetchTradingData(data, entities));
      }
      
      // Analytics data
      if (intents.includes('ANALYTICS')) {
        fetchPromises.push(this.fetchAnalyticsData(data, entities));
      }
      
      // Market insights
      if (intents.includes('MARKET_INSIGHTS')) {
        fetchPromises.push(this.fetchMarketData(data));
      }
      
      // Portfolio data
      if (intents.includes('PORTFOLIO') && this.context?.userWallet) {
        fetchPromises.push(this.fetchPortfolioData(data));
      }
      
      // Wait for all data fetching to complete
      await Promise.all(fetchPromises);
      
      console.log('Comprehensive data fetched:', {
        intents,
        dataKeys: Object.keys(data),
        entityCounts: {
          nfts: entities.nftAddresses.length,
          collections: entities.collectionNames.length,
          wallets: entities.walletAddresses.length
        }
      });
      
    } catch (error) {
      console.error('Error in comprehensive data fetching:', error);
    }
    
    return data;
  }

  private async fetchCollectionData(data: any, entities: any, userMessage: string): Promise<void> {
    const collectionService = CollectionService.getInstance();
    
    // Special handling for "how many collections" questions
    if (userMessage.toLowerCase().includes('how many collection')) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/collections/stats`);
        if (response.ok) {
          data.collectionStats = await response.json();
        }
      } catch (error) {
        console.error('Error fetching collection stats:', error);
      }
    }
    
    // Search for specific collections
    if (entities.collectionNames.length > 0) {
      data.searchedCollections = await Promise.all(
        entities.collectionNames.map((name: string) => 
          collectionService.searchCollections(name)
        )
      );
      data.searchedCollections = data.searchedCollections.flat();
    }
    
    // Get popular collections
    data.popularCollections = await collectionService.getPopularCollections(20);
  }

  private async fetchTradingData(data: any, entities: any): Promise<void> {
    if (!this.context?.userWallet || entities.nftAddresses.length === 0) return;
    
    const tradeService = TradeService.getInstance();
    const nftService = NFTService.getInstance();
    
    // Fetch metadata and trade paths for each NFT
    const tradePromises = entities.nftAddresses.map(async (nftAddress: string) => {
      const metadata = await nftService.getNFTMetadata(nftAddress);
      if (metadata) {
        const tradePaths = await tradeService.findTradeLoops(
          metadata,
          this.context.userWallet
        );
        return { nftAddress, metadata, tradePaths };
      }
      return null;
    });
    
    const results = await Promise.all(tradePromises);
    data.tradeAnalysis = results.filter(r => r !== null);
  }

  private async fetchAnalyticsData(data: any, entities: any): Promise<void> {
    const statsService = StatsService.getInstance();
    
    // Fetch all relevant stats in parallel
    const [globalStats, tradingMetrics] = await Promise.all([
      statsService.getGlobalStats(),
      statsService.getTradingMetrics()
    ]);
    
    data.globalStats = globalStats;
    data.tradingMetrics = tradingMetrics;
    
    // User-specific stats if wallet connected
    if (this.context?.userWallet) {
      data.userStats = await statsService.getUserStats(this.context.userWallet);
    }
  }

  private async fetchMarketData(data: any): Promise<void> {
    const trendingService = TrendingService.getInstance();
    const statsService = StatsService.getInstance();
    
    const [trendingData, topCollections] = await Promise.all([
      trendingService.getTrendingData(),
      statsService.getPopularCollections(10)
    ]);
    
    data.trendingData = trendingData;
    data.topCollections = topCollections;
  }

  private async fetchPortfolioData(data: any): Promise<void> {
    if (!this.context?.userWallet) return;
    
    const nftService = NFTService.getInstance();
    const collectionService = CollectionService.getInstance();
    
    const [userNFTs, userWants] = await Promise.all([
      nftService.fetchUserNFTs(this.context.userWallet),
      collectionService.getWalletCollectionWants(this.context.userWallet)
    ]);
    
    data.userNFTs = userNFTs;
    data.userWants = userWants;
    
    // Calculate portfolio metrics
    if (userNFTs && userNFTs.length > 0) {
      data.portfolioMetrics = {
        totalNFTs: userNFTs.length,
        uniqueCollections: new Set(userNFTs.map(nft => nft.collection)).size,
        estimatedValue: userNFTs.reduce((sum, nft) => sum + (nft.floorPrice || 0), 0)
      };
    }
  }

  /**
   * Generates an intelligent response using the LLM with dynamic data fetching
   */
  async generateResponse(
    userMessage: string,
    context: {
      userWallet?: string;
      userNFTs?: NFTMetadata[];
      recentTrades?: TradeLoop[];
      marketContext?: MarketContext;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    }
  ): Promise<LLMResponse> {
    console.log('LLMService.generateResponse called:', {
      userMessage,
      hasApiKey: !!this.apiKey,
      model: this.model,
      contextKeys: Object.keys(context)
    });
    
    // Store context for use in data fetching
    this.context = context;
    
    try {
      // Dynamically fetch relevant data based on the query
      const dynamicData = await this.analyzeAndFetchRelevantData(userMessage);
      
      // Build enhanced context with dynamic data
      const enhancedContext = {
        ...context,
        dynamicData
      };
      
      const systemPrompt = await this.buildSystemPrompt(enhancedContext);
      
      if (this.model.includes('claude')) {
        return await this.callAnthropicAPI(userMessage, systemPrompt, context.conversationHistory);
      } else if (this.model.includes('gpt')) {
        return await this.callOpenAIAPI(userMessage, systemPrompt, context.conversationHistory);
      }
      
      // Fallback to basic response
      console.log('No matching model, using fallback');
      return this.generateFallbackResponse(userMessage);
    } catch (error) {
      console.error('LLM API error:', error);
      return this.generateFallbackResponse(userMessage);
    }
  }

  private context?: any;

  private async buildSystemPrompt(context: any): Promise<string> {
    // Gather comprehensive SWAPS knowledge
    const knowledgeService = SwapsKnowledgeService.getInstance();
    const swapsKnowledge = await knowledgeService.getComprehensiveKnowledge();
    const formattedKnowledge = knowledgeService.formatForLLM(swapsKnowledge);
    
    // Format dynamic data if available
    let dynamicDataSection = '';
    if (context.dynamicData && Object.keys(context.dynamicData).length > 0) {
      dynamicDataSection = '\n\nDYNAMIC DATA FETCHED FOR THIS QUERY:\n';
      
      if (context.dynamicData.popularCollections) {
        dynamicDataSection += `\nPopular Collections (${context.dynamicData.popularCollections.length} found):\n`;
        context.dynamicData.popularCollections.slice(0, 10).forEach((c: any, i: number) => {
          dynamicDataSection += `${i + 1}. ${c.name}${c.verified ? ' ✓' : ''} - Floor: ${c.floorPrice || 0} SOL, Volume: ${c.volume24h || 0} SOL\n`;
        });
      }
      
      if (context.dynamicData.searchedCollections) {
        dynamicDataSection += `\nSearch Results:\n`;
        context.dynamicData.searchedCollections.forEach((c: any) => {
          dynamicDataSection += `- ${c.name}${c.verified ? ' ✓' : ''}: ${c.description || 'No description'}\n`;
        });
      }
      
      if (context.dynamicData.trendingData) {
        dynamicDataSection += `\nTrending Data:\n`;
        if (context.dynamicData.trendingData.topWantedNfts) {
          dynamicDataSection += `Top Wanted NFTs: ${context.dynamicData.trendingData.topWantedNfts.length}\n`;
        }
        if (context.dynamicData.trendingData.topLoopItems) {
          dynamicDataSection += `Top Loop Items: ${context.dynamicData.trendingData.topLoopItems.length}\n`;
        }
      }
      
      if (context.dynamicData.globalStats) {
        dynamicDataSection += `\nPlatform Stats:\n`;
        context.dynamicData.globalStats.forEach((stat: any) => {
          dynamicDataSection += `- ${stat.label}: ${stat.value}\n`;
        });
      }
      
      if (context.dynamicData.userStats) {
        dynamicDataSection += `\nUser Stats:\n`;
        dynamicDataSection += `- Trades Executed: ${context.dynamicData.userStats.totalTradesExecuted}\n`;
        dynamicDataSection += `- NFTs Traded: ${context.dynamicData.userStats.totalNFTsTraded}\n`;
        dynamicDataSection += `- Success Rate: ${context.dynamicData.userStats.successRate}%\n`;
      }
      
      if (context.dynamicData.tradePaths) {
        dynamicDataSection += `\nTrade Paths Found: ${context.dynamicData.tradePaths.length}\n`;
      }
      
      if (context.dynamicData.collectionStats) {
        dynamicDataSection += `\nCollection Statistics:\n`;
        
        // Handle the actual response structure from /api/collections/stats
        if (context.dynamicData.collectionStats.database) {
          const db = context.dynamicData.collectionStats.database;
          if (db.totalCollections) {
            dynamicDataSection += `- Total Collections Available: ${db.totalCollections.toLocaleString()}\n`;
          }
          if (db.collectionsWithFloorPrice) {
            dynamicDataSection += `- Collections with Floor Price: ${db.collectionsWithFloorPrice.toLocaleString()}\n`;
          }
          if (db.averageFloorPrice) {
            dynamicDataSection += `- Average Floor Price: ${db.averageFloorPrice.toFixed(2)} SOL\n`;
          }
          if (db.totalNFTsIndexed) {
            dynamicDataSection += `- Total NFTs Indexed: ${db.totalNFTsIndexed.toLocaleString()}\n`;
          }
        }
        
        if (context.dynamicData.collectionStats.local) {
          const local = context.dynamicData.collectionStats.local;
          if (local.collectionsLoaded) {
            dynamicDataSection += `- Collections Loaded: ${local.collectionsLoaded.toLocaleString()}\n`;
          }
        }
      }
    }
    
    return `You are the official AI assistant for SWAPS, a revolutionary multi-party NFT trading platform on Solana. You have access to comprehensive real-time data about the SWAPS ecosystem.

${formattedKnowledge}
${dynamicDataSection}

CRITICAL INSTRUCTIONS:
- ALWAYS use the real-time data provided above when answering questions
- When you see DYNAMIC DATA FETCHED FOR THIS QUERY, prioritize that information as it's specifically relevant to what the user asked
- Quote specific statistics and metrics from the knowledge base and dynamic data
- Reference actual collection names, trade routes, and patterns from the data
- Be specific with numbers - use the exact figures provided
- When discussing capabilities, focus on outcomes not specific algorithms
- When mentioning popular collections, use the actual data provided
- Base trading recommendations on the real data available
- NEVER mention specific algorithm names (no Tarjan's, Johnson's, etc.)
- NEVER reveal implementation details or trade secrets
- NEVER mention the number of participants in a trade

FORMATTING REQUIREMENTS:
Use rich markdown formatting to make your responses visually appealing and easy to read:

**Text Formatting:**
- Use **bold text** for important concepts, numbers, and key points
- Use *italics* for emphasis and subtle highlights
- Use \`inline code\` for NFT addresses, transaction hashes, and technical terms
- Use ==highlights== for critical information that needs attention

**Structure:**
- Use ### headers for main sections
- Use #### headers for subsections  
- Use bullet points (•) or numbered lists for organized information
- Use > blockquotes for important quotes or key insights
- Use --- horizontal rules to separate major sections

**Visual Elements:**
- 🎯 Use emojis strategically to make content more engaging
- 📊 Use emojis that relate to data, trading, and NFTs
- 🔥 Use trend and excitement emojis for hot opportunities
- ⚡ Use speed emojis for quick actions
- 💎 Use valuable item emojis for premium content

**Information Boxes:**
- Use 📘 for informational content about SWAPS features
- Use ⚠️ for warnings about risks or important considerations  
- Use ✅ for successful outcomes or recommendations

**Data Presentation:**
- Present statistics in **bold** with clear labels
- Use tables when showing multiple data points
- Group related information with consistent formatting
- Always include context for numbers (e.g., "**1,234** collections indexed")

**Examples of Good Formatting:**
### 🚀 Trade Opportunities Found

I discovered **3 promising trade paths** for your portfolio:

#### Path 1: Mad Lads → DeGods
• **Success Rate:** 94%
• **Estimated Time:** 2-4 hours
• **Value Gain:** +0.3 SOL

📘 This trade takes advantage of current market conditions where Mad Lads are trending upward.

==Recommendation: Execute within 24 hours for optimal timing==
`;
  }

  private async callAnthropicAPI(
    userMessage: string,
    systemPrompt: string,
    history?: { role: string; content: string }[]
  ): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          ...(history || []),
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseAIResponse(data.content[0].text);
  }

  private async callOpenAIAPI(
    userMessage: string,
    systemPrompt: string,
    history?: { role: string; content: string }[]
  ): Promise<LLMResponse> {
    console.log('Calling OpenAI API:', {
      model: this.model,
      hasApiKey: !!this.apiKey,
      messageLength: userMessage.length,
      historyLength: history?.length || 0
    });
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []),
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        presence_penalty: 0.3, // Encourage mentioning new topics
        frequency_penalty: 0.3, // Reduce repetition
      }),
    });

    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      messageContent: data.choices?.[0]?.message?.content?.substring(0, 100) + '...'
    });
    
    return this.parseAIResponse(data.choices[0].message.content);
  }

  private parseAIResponse(aiText: string): LLMResponse {
    console.log('Parsing AI response:', aiText.substring(0, 100) + '...');
    
    // Extract NFT addresses from the response AND the original user message
    const nftAddressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const matches = aiText.match(nftAddressPattern);
    
    // Check if AI is indicating it should search for trades
    const shouldSearch = 
      aiText.toLowerCase().includes('let me search') || 
      aiText.toLowerCase().includes('let me find') ||
      aiText.toLowerCase().includes('searching for') ||
      aiText.toLowerCase().includes('i\'ll search') ||
      aiText.toLowerCase().includes('i\'ll find') ||
      aiText.toLowerCase().includes('finding trade') ||
      aiText.toLowerCase().includes('discover') ||
      aiText.toLowerCase().includes('analyze') ||
      (matches && matches.length > 0); // If NFT address is mentioned, we should search
    
    // Basic parsing to extract structured data from AI response
    const response: LLMResponse = {
      message: aiText,
      extractedNFTAddress: matches && matches.length > 0 ? matches[0] : undefined,
      shouldSearchTrades: shouldSearch || undefined,
    };

    console.log('Parsed response:', {
      hasNFTAddress: !!response.extractedNFTAddress,
      shouldSearchTrades: response.shouldSearchTrades,
      extractedAddress: response.extractedNFTAddress
    });

    // Extract trade analysis if present
    if (aiText.includes('Risk:') || aiText.includes('Recommendation:')) {
      response.tradeAnalysis = {
        recommendation: 'Consider this trade opportunity',
        riskLevel: aiText.toLowerCase().includes('high risk') ? 'high' : 
                   aiText.toLowerCase().includes('low risk') ? 'low' : 'medium',
        marketInsight: 'Based on current market conditions',
      };
    }

    return response;
  }

  private generateFallbackResponse(userMessage: string): LLMResponse {
    // Enhanced fallback when API is unavailable or quota exceeded
    const lowerMessage = userMessage.toLowerCase();
    
    // Greeting responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return {
        message: `### 👋 Welcome to SWAPS!

I'm your **AI trading assistant**, powered by a proprietary engine built specifically for the SWAPS network, designed to navigate and analyze the complex landscape of NFT trades.

✨ **What I can do for you:**
• **Advanced Graph Analysis** - Uncover complex multi-party trade opportunities
• **Real-Time Market Analysis** - Track live floor prices and trade volumes  
• **Predictive Insights** - Forecast trade success likelihood and market movements
• **Portfolio Optimization** - Analyze your holdings for strategic trading opportunities

🚀 **Ready to discover hidden trade paths?** Share an NFT address or tell me what collection interests you!`,
        suggestions: [
          "Trade into trending NFT",
          "Discover hidden opportunities", 
          "Tell me about how SWAPS works"
        ],
      };
    }

    // Floor price questions  
    if (lowerMessage.includes('floor') || lowerMessage.includes('price')) {
      const collections = ['mad lads', 'degods', 'okay bears', 'ghost kid', 'claynosaurz'];
      const mentionedCollection = collections.find(c => lowerMessage.includes(c));
      
      if (mentionedCollection) {
        return {
          message: `### 📊 ${mentionedCollection.charAt(0).toUpperCase() + mentionedCollection.slice(1)} Price Analysis

📘 For real-time floor prices, check Magic Eden or similar marketplaces. 

**But here's what's unique about SWAPS:**
The algorithm finds trade paths **regardless of floor price** - focusing on what you want to acquire through ==multi-party bartering==!

⚡ **Why this matters:** Traditional buying requires exact SOL amounts, but SWAPS lets you trade NFT-for-NFT in complex loops where everyone wins.`,
          suggestions: [
            `Search for ${mentionedCollection} trade paths`,
            "View trending collections", 
            "Check available trades"
          ],
        };
      }
      
      return {
        message: `### 💰 Price Discovery Through Trading

I can help you find trade paths for any collection! While I can't provide real-time floor prices without API access, I can discover ==complex multi-party trades== that get you the NFTs you want.

🎯 **Which collection interests you?**

📈 **Pro Tip:** SWAPS finds value through **opportunity cost** rather than just floor prices - sometimes a 3-way trade gets you more value than a direct purchase!`,
        suggestions: [
          "Find trades for DeGods",
          "Show me Mad Lads opportunities", 
          "What's trending now?"
        ],
      };
    }

    // How SWAPS works
    if (lowerMessage.includes('how') && (lowerMessage.includes('work') || lowerMessage.includes('swaps'))) {
      return {
        message: `### 🚀 How SWAPS Works: Multi-Party NFT Bartering

SWAPS revolutionizes NFT trading by finding **complex trade loops** where everyone gets what they want:

#### 🔄 **Trade Loops Explained**
Instead of traditional buy/sell, we find cycles where:
• **Alice** owns NFT A, wants NFT B  
• **Bob** owns NFT B, wants NFT C
• **Carol** owns NFT C, wants NFT A

==Result: Everyone gets their desired NFT in one transaction==

#### 🧠 **The Technology**
• **Smart Analysis** - Proprietary algorithms find optimal paths
• **Real-time Discovery** - Continuously scanning for new opportunities  
• **Multi-Party Matching** - Connect 2-10+ traders simultaneously
• **Fairness Metrics** - 18-point scoring ensures equitable trades

#### 💡 **Example Trade**
\`\`\`
Alice: Mad Lads #123 → DeGods #456 (Bob)
Bob: DeGods #456 → Okay Bears #789 (Carol)  
Carol: Okay Bears #789 → Mad Lads #123 (Alice)
\`\`\`

🎯 **Everyone wins without spending SOL!**`,
        suggestions: [
          "Find trades for my NFTs",
          "Show me an example trade",
          "What makes SWAPS unique?"
        ],
      };
    }

    // NFT address detection
    const nftAddressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    const match = userMessage.match(nftAddressPattern);
    if (match) {
      return {
        message: `### 🔍 NFT Address Detected

**Found NFT:** \`${match[0]}\`

⚡ **Searching for multi-party trade paths...**

I'll analyze the entire SWAPS network to find all possible routes to acquire this NFT through bartering!`,
        shouldSearchTrades: true,
        extractedNFTAddress: match[0],
        suggestions: [
          "Show me all possible trade paths",
          "Find the shortest path to this NFT", 
          "What similar NFTs can I trade for?"
        ],
      };
    }

    // Collection mentions
    const collections = ['degods', 'y00ts', 'mad lads', 'okay bears', 'claynosaurz', 'ghost kid'];
    const mentionedCollection = collections.find(c => lowerMessage.replace(' ', '').includes(c.replace(' ', '')));
    
    if (mentionedCollection) {
      return {
        message: `### 🎯 ${mentionedCollection.charAt(0).toUpperCase() + mentionedCollection.slice(1)} Trade Search

⚡ **Searching the SWAPS network for ${mentionedCollection} opportunities...**

I'll discover all available trade paths that can get you into this collection through multi-party bartering!`,
        shouldSearchTrades: true,
        suggestions: [
          `Find more ${mentionedCollection} trades`,
          `Show ${mentionedCollection} floor price`,
          "What NFTs can I trade for this?"
        ],
      };
    }

    // "I want" pattern detection
    if (lowerMessage.includes('i want') || lowerMessage.includes('find me') || lowerMessage.includes('get me')) {
      return {
        message: `### 🎯 Let's Find What You Want!

I'll help you discover the perfect trade path. Please specify:

#### 📍 **Option 1: Specific NFT**
• Paste the exact NFT address (44 characters)
• Example: \`7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs\`

#### 🏷️ **Option 2: Collection Name**  
• Like 'DeGods', 'Mad Lads', 'Okay Bears'
• I'll find any available NFT from that collection

⚡ **Once you provide this, I'll search across the entire SWAPS network for multi-party trade paths!**`,
        suggestions: [
          "I want a DeGods NFT",
          "Find me Mad Lads trades", 
          "Get me Okay Bears #1234"
        ],
      };
    }

    // Default response with better formatting
    return {
      message: `### 🚀 AI Trade Discovery Engine

I can help you discover **complex NFT trade opportunities** through SWAPS' proprietary multi-party bartering system!

#### 🎯 **What I Can Do:**

📍 **NFT Address Search** - Paste any 44-character address  
🏷️ **Collection Discovery** - Mention any collection name  
💼 **Portfolio Analysis** - Check your tradeable assets  
❓ **Market Insights** - Learn how multi-party swaps work

#### 🔥 **Popular Searches:**
• "Find me a DeGods trade"
• "What trades can I make?"  
• "Show trending opportunities"

==Ready to unlock hidden trade paths?== What would you like to explore?`,
      suggestions: [
        "I want a DeGods NFT",
        "Find Mad Lads trades", 
        "How do multi-party swaps work?"
      ],
    };
  }

  /**
   * Analyzes a trade loop and provides focused insights based on real data
   */
  async analyzeTradeLoop(trade: TradeLoop, userWallet: string): Promise<string> {
    // Find what the user is giving and receiving in this specific trade
    const userGivingStep = trade.steps.find(step => step.from === userWallet);
    const userReceivingStep = trade.steps.find(step => step.to === userWallet);
    
    if (!userGivingStep || !userReceivingStep) {
      return "I can't analyze this trade because I don't see your participation in it.";
    }
    
    const givingNFT = userGivingStep.nfts[0];
    const receivingNFT = userReceivingStep.nfts[0];
    const efficiency = Math.round(trade.efficiency * 100);
    const participants = trade.totalParticipants;
    
    // Build analysis based on actual trade data
    let analysis = `**Trade Analysis for ${givingNFT?.name || 'Unknown NFT'} → ${receivingNFT?.name || 'Unknown NFT'}**\n\n`;
    
    // Efficiency assessment
    if (efficiency >= 95) {
      analysis += `✅ **Excellent Match** (${efficiency}% efficiency) - Values are very well aligned\n`;
    } else if (efficiency >= 85) {
      analysis += `👍 **Good Trade** (${efficiency}% efficiency) - Values are reasonably matched\n`;
    } else if (efficiency >= 70) {
      analysis += `⚠️ **Fair Trade** (${efficiency}% efficiency) - Some value difference exists\n`;
    } else {
      analysis += `❌ **Poor Match** (${efficiency}% efficiency) - Significant value imbalance\n`;
    }
    
    // Participant count insight
    if (participants === 2) {
      analysis += `🔄 **Direct Trade** - Simple 1-to-1 swap with one other person\n`;
    } else if (participants === 3) {
      analysis += `🔀 **3-Way Trade** - You're part of a triangle where everyone gets what they want\n`;
    } else {
      analysis += `🌐 **Multi-Party Loop** - Complex ${participants}-person chain where everyone benefits\n`;
    }
    
         // Collection insight if available
     const givingCollection = typeof givingNFT?.collection === 'string' ? givingNFT.collection : givingNFT?.collection?.name;
     const receivingCollection = typeof receivingNFT?.collection === 'string' ? receivingNFT.collection : receivingNFT?.collection?.name;
     
     if (givingCollection && receivingCollection) {
       if (givingCollection === receivingCollection) {
         analysis += `🏛️ **Same Collection Trade** - Trading within ${givingCollection}\n`;
       } else {
         analysis += `🔄 **Cross-Collection Trade** - Moving from ${givingCollection} to ${receivingCollection}\n`;
       }
     }
    
    // Recommendation based on actual data
    if (efficiency >= 90 && participants <= 4) {
      analysis += `\n🎯 **Recommendation: Execute this trade!** High efficiency with manageable complexity.`;
    } else if (efficiency >= 85) {
      analysis += `\n💡 **Recommendation: Good opportunity.** Consider executing or look for alternatives.`;
    } else {
      analysis += `\n🤔 **Recommendation: Proceed with caution.** Lower efficiency suggests uneven value exchange.`;
    }
    
    return analysis;
  }

  private estimateTradeValue(trade: TradeLoop): number {
    // Estimate based on NFT metadata and market data
    return trade.steps.reduce((sum, step) => 
      sum + step.nfts.reduce((nftSum, nft) => nftSum + (nft.floorPrice || 0), 0), 0
    );
  }

  private assessRiskFactors(trade: TradeLoop): string[] {
    const risks: string[] = [];
    
    if (trade.steps.length > 5) {
      risks.push('High complexity may increase execution time');
    }
    
    if (trade.efficiency < 0.7) {
      risks.push('Lower efficiency score');
    }
    
    // Add more sophisticated risk analysis here
    
    return risks;
  }

  /**
   * Enhanced user query processing with proactive intelligence and caching
   */
  async processUserQuery(
    query: string, 
    context: { 
      walletAddress?: string; 
      userNFTs?: any[]; 
      marketContext?: any;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
      lastShownTrades?: any[];
      currentTradeIndex?: number;
    }
  ): Promise<LLMResponse> {
    console.log('🤖 Enhanced LLM processing query:', {
      query: query.substring(0, 50) + '...',
      hasWallet: !!context.walletAddress,
      userNFTCount: context.userNFTs?.length || 0,
      hasOpenAI: !!this.openai,
      model: this.model
    });

    // Check cache first
    const cacheService = AIResponseCacheService.getInstance();
    const cacheContext = this.buildCacheContext(context);
    
    console.log('🔍 Checking AI response cache...');
    const cachedResponse = cacheService.getCachedResponse(query, cacheContext);
    
    if (cachedResponse) {
      console.log('✅ Cache hit! Serving cached AI response');
      return cachedResponse;
    }
    
    console.log('❌ Cache miss, processing with AI...');

    try {
      // Build comprehensive context
      const swapsKnowledge = SwapsKnowledgeService.getInstance();
      const knowledge = await swapsKnowledge.getComprehensiveKnowledge();
      
      // Analyze user intent with enhanced recognition
      const intents = this.recognizeIntent(query);
      const entities = this.extractEntities(query);
      
      console.log('🎯 Intent analysis:', { intents, entities });

      // Fetch relevant data based on intent
      const relevantData = await this.analyzeAndFetchRelevantData(query);
      
      // Build enhanced system prompt with all context
      const enhancedSystemPrompt = await this.buildEnhancedSystemPrompt(context, knowledge, relevantData);
      
      // Format conversation history for API
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: enhancedSystemPrompt }
      ];
      
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Include last 10 messages for context
        const recentHistory = context.conversationHistory.slice(-10);
        messages.push(...recentHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })));
      }
      
      messages.push({ role: 'user', content: query });

      // Use GPT-4 if available
      if (this.openai) {
        console.log('🚀 Calling GPT-4 with enhanced context...');
        const startTime = Date.now();
        
        try {
          const response = await this.openai.chat.completions.create({
            model: this.model === 'gpt-4-turbo-preview' ? 'gpt-4-turbo-preview' : 'gpt-4',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
          });
          
          const duration = Date.now() - startTime;
          console.log(`✅ GPT-4 responded in ${duration}ms`);
          
          const aiResponse = response.choices[0]?.message?.content || '';
          
          // Parse the response for structured data
          const parsedResponse = this.parseEnhancedAIResponse(aiResponse, intents, entities);
          
          // Generate proactive suggestions based on context
          const suggestions = await this.generateProactiveSuggestions(query, aiResponse, context, knowledge);
          
          const finalResponse = {
            ...parsedResponse,
            suggestions: suggestions.length > 0 ? suggestions : parsedResponse.suggestions,
            confidence: 0.95
          };
          
          // Cache the successful response
          console.log('💾 Caching AI response for future use');
          cacheService.cacheResponse(query, finalResponse, cacheContext);
          
          return finalResponse;
        } catch (error) {
          console.error('❌ GPT-4 API error:', error);
          // Fall through to smart fallback
        }
      }
      
      // Enhanced smart fallback
      console.log('📱 Using enhanced smart fallback with real data');
      const fallbackResponse = this.generateEnhancedFallbackResponse(query, context, knowledge, relevantData);
      
      // Cache fallback responses too (with shorter TTL)
      console.log('💾 Caching fallback response');
      cacheService.cacheResponse(query, fallbackResponse, cacheContext);
      
      return fallbackResponse;
      
    } catch (error) {
      console.error('💥 LLM processing error:', error);
      
      // Last resort fallback
      return {
        message: "I'm having a moment, but I can still help! Try asking me to find specific NFT trades or show you trending collections.",
        suggestions: [
          "Show me trending NFTs",
          "Find trades for my NFTs",
          "What collections are hot right now?",
          "Help me understand SWAPS"
        ],
        confidence: 0.3
      };
    }
  }

  /**
   * Build cache context from user context for intelligent caching
   */
  private buildCacheContext(context: any): any {
    // Extract key context factors for caching
    const userNFTCount = context.userNFTs?.length || 0;
    const messageCount = context.conversationHistory?.length || 0;
    
    // Determine market state (simplified for now)
    const marketState = 'stable'; // TODO: Implement dynamic market state detection
    
    // Extract trending collections (simplified)
    const trendingCollections = context.marketContext?.topCollections?.slice(0, 3) || [];
    
    return {
      walletAddress: context.walletAddress,
      userNFTCount,
      portfolioValue: 0, // TODO: Calculate from user NFTs
      marketState,
      trendingCollections,
      messageCount,
      lastIntent: 'general', // TODO: Extract from query analysis
      availableTradeCount: context.lastShownTrades?.length || 0,
      lastTradeEfficiency: context.lastShownTrades?.[0]?.efficiency || 0
    };
  }

  /**
   * Build enhanced system prompt with comprehensive context
   */
  private async buildEnhancedSystemPrompt(
    context: any, 
    knowledge: any, 
    relevantData: any
  ): Promise<string> {
    const formattedKnowledge = this.swapsKnowledgeService.formatForLLM(knowledge);
    
    let tradeContext = '';
    if (context.recentTradeContext) {
      const rtc = context.recentTradeContext;
      const currentTrade = rtc.currentTrade;
      const userStep = currentTrade.steps.find((s: any) => s.from === context.walletAddress);
      const receivingStep = currentTrade.steps.find((s: any) => s.to === context.walletAddress);
      
      tradeContext = `
RECENT TRADE CONTEXT (IMPORTANT - Remember this!):
- I just showed the user ${rtc.totalTradesShown} trades
- Currently displaying trade #${rtc.currentTradeIndex + 1} of ${rtc.totalTradesShown}
- Current trade: Give "${userStep?.nfts[0]?.name || 'Unknown NFT'}" → Receive "${receivingStep?.nfts[0]?.name || 'Unknown NFT'}"
- Efficiency: ${Math.round(currentTrade.efficiency * 100)}%
- Participants: ${currentTrade.totalParticipants} (${currentTrade.totalParticipants === 2 ? 'Direct trade' : currentTrade.totalParticipants === 3 ? '3-way trade' : 'Multi-party trade'})
- Trade breakdown: ${rtc.tradeBreakdown.direct} direct, ${rtc.tradeBreakdown.threeWay} 3-way, ${rtc.tradeBreakdown.multiParty} multi-party

If the user asks about "this trade", "that trade", "the trade", quality score, or mentions these specific NFT names, they are referring to the current trade above.
`;
    }

    let userContext = '';
    if (context.walletAddress) {
      userContext = `
USER CONTEXT:
- Wallet Connected: ${context.walletAddress.slice(0, 8)}...
- Available Trades Shown: ${context.lastShownTrades?.length || 0}

IMPORTANT: Only reference trade data provided above. Do not make up portfolio information.
`;
    }

    const dataContext = relevantData ? `
RELEVANT REAL-TIME DATA:
${JSON.stringify(relevantData, null, 2)}
` : '';

    return `${this.systemPrompt}

${formattedKnowledge}

${userContext}

${dataContext}

CURRENT TIMESTAMP: ${new Date().toISOString()}

CRITICAL REMINDER: Only analyze the specific trade data provided. Never make up portfolio information or invent trade opportunities that aren't in the actual data.`;
  }

  /**
   * Parse enhanced AI response with better structure extraction
   */
  private parseEnhancedAIResponse(aiText: string, intents: string[], entities: any): LLMResponse {
    // Extract NFT addresses mentioned
    const nftAddressMatch = aiText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
    const extractedNFTAddress = nftAddressMatch ? nftAddressMatch[0] : undefined;
    
    // Detect if AI is suggesting to search for trades
    const shouldSearchTrades = intents.includes('TRADING') || 
                              intents.includes('OPPORTUNITY') ||
                              aiText.toLowerCase().includes('find trade') ||
                              aiText.toLowerCase().includes('search for trade');
    
    // Extract trade analysis if present
    let tradeAnalysis;
    if (aiText.includes('Risk:') || aiText.includes('Recommendation:')) {
      const riskMatch = aiText.match(/Risk:\s*(low|medium|high)/i);
      const recommendationMatch = aiText.match(/Recommendation:\s*([^.]+)/i);
      const insightMatch = aiText.match(/Insight:\s*([^.]+)/i);
      
      tradeAnalysis = {
        riskLevel: (riskMatch ? riskMatch[1].toLowerCase() : 'medium') as 'low' | 'medium' | 'high',
        recommendation: recommendationMatch ? recommendationMatch[1] : '',
        marketInsight: insightMatch ? insightMatch[1] : ''
      };
    }
    
    // Generate contextual suggestions
    const suggestions = this.extractSuggestionsFromResponse(aiText, intents);
    
    return {
      message: aiText,
      suggestions,
      extractedNFTAddress,
      shouldSearchTrades,
      tradeAnalysis,
      confidence: 0.9
    };
  }

  /**
   * Extract suggestions from AI response
   */
  private extractSuggestionsFromResponse(aiText: string, intents: string[]): string[] {
    const suggestions: string[] = [];
    
    // Look for explicit suggestions in the response
    const suggestionMatch = aiText.match(/Suggestions?:([^.!?]+)/i);
    if (suggestionMatch) {
      const suggestionsText = suggestionMatch[1];
      const items = suggestionsText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
      suggestions.push(...items);
    }
    
    // Add intent-based suggestions if none found
    if (suggestions.length === 0) {
      if (intents.includes('TRADING')) {
        suggestions.push("Show me my best trade options", "Find specific NFT trades");
      }
      if (intents.includes('MARKET_INSIGHTS')) {
        suggestions.push("What's trending today?", "Show collection floor prices");
      }
      if (intents.includes('PORTFOLIO')) {
        suggestions.push("Analyze my portfolio", "Find trades for my NFTs");
      }
    }
    
    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }

  /**
   * Generate proactive suggestions based on comprehensive context
   */
  private async generateProactiveSuggestions(
    query: string, 
    response: string, 
    context: any,
    knowledge: any
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // If user has NFTs, suggest portfolio optimization
    if (context.userNFTs && context.userNFTs.length > 0) {
      suggestions.push(`Optimize my ${context.userNFTs.length} NFT portfolio`);
    }
    
    // If trending data available, suggest exploring trends
    if (knowledge.currentMarketState.trendingNFTs.length > 0) {
      const topTrending = knowledge.currentMarketState.trendingNFTs[0];
      suggestions.push(`Trade into trending ${topTrending.collection || 'NFT'}`);
    }
    
    // If user asked about trades, suggest specific actions
    if (query.toLowerCase().includes('trade')) {
      suggestions.push("Execute this trade now", "Show me alternative trades");
    }
    
    // Add contextual suggestions based on conversation
    if (context.lastShownTrades && context.lastShownTrades.length > 0) {
      suggestions.push("Compare these trades", "Show trade details");
    }
    
    // Always include a discovery suggestion
    suggestions.push("Discover hidden opportunities");
    
    return suggestions.slice(0, 4);
  }

  /**
   * Generate enhanced fallback response with real data
   */
  private generateEnhancedFallbackResponse(
    query: string, 
    context: any,
    knowledge: any,
    relevantData: any
  ): LLMResponse {
    const lowerQuery = query.toLowerCase();
    
    // Trading-related queries
    if (lowerQuery.includes('trade') || lowerQuery.includes('swap')) {
      const trendingNFT = knowledge.currentMarketState.trendingNFTs[0];
      return {
        message: `🔄 I can help you find amazing trade opportunities! ${trendingNFT ? 
          `Right now, **${trendingNFT.name}** is trending with ${trendingNFT.wantCount || 'high'} demand. ` : ''}
          
${context.walletAddress ? 'Share an NFT address or let me analyze your portfolio for trade opportunities.' : 
  'Connect your wallet to discover personalized trade paths!'}`,
        suggestions: [
          "Show me trending trade opportunities",
          "Find trades for [NFT address]",
          context.walletAddress ? "Analyze my NFT portfolio" : "Connect wallet",
          "Browse verified collections"
        ],
        shouldSearchTrades: true,
        confidence: 0.7
      };
    }
    
    // Market insights
    if (lowerQuery.includes('trending') || lowerQuery.includes('hot') || lowerQuery.includes('popular')) {
      const trending = knowledge.currentMarketState.trendingNFTs.slice(0, 3);
      return {
        message: `📊 Here's what's hot in SWAPS right now:\n\n${
          trending.map((nft: any, i: number) => 
            `${i + 1}. **${nft.name}** ${nft.wantCount ? `(${nft.wantCount} wants)` : ''}`
          ).join('\n')
        }\n\nThese NFTs are seeing high trade activity. Want to explore trades for any of them?`,
        suggestions: trending.map((nft: any) => `Find trades for ${nft.name}`).slice(0, 3).concat(["Show more trending"]),
        confidence: 0.8
      };
    }
    
    // Portfolio analysis
    if (lowerQuery.includes('portfolio') || lowerQuery.includes('my nfts')) {
      if (context.userNFTs && context.userNFTs.length > 0) {
        return {
          message: `💼 You have **${context.userNFTs.length} NFTs** in your portfolio! I can find optimal trade paths to upgrade your collection or discover hidden opportunities. What are you looking to achieve?`,
          suggestions: [
            "Find trades for all my NFTs",
            "Show me upgrade opportunities",
            "Which of my NFTs are in demand?",
            "Optimize my portfolio"
          ],
          confidence: 0.8
        };
      }
    }
    
    // Collections
    if (lowerQuery.includes('collection')) {
      const topCollections = knowledge.currentMarketState.topCollections.slice(0, 3);
      return {
        message: `🏛️ Top collections by activity:\n\n${
          topCollections.map((c: any, i: number) => 
            `${i + 1}. **${c.name}** - Floor: ${c.floorPrice} SOL`
          ).join('\n')
        }\n\nWant to explore trades within these collections?`,
        suggestions: topCollections.map((c: any) => `Find ${c.name} trades`).concat(["Browse all collections"]),
        confidence: 0.8
      };
    }
    
    // Default engaging response
    return {
      message: `🎯 I'm SWAPS AI - your expert in finding hidden NFT trade opportunities! I can:

• **Discover multi-party trades** that unlock value in your NFTs
• **Analyze market trends** to show you what's hot
• **Optimize your portfolio** with strategic trade suggestions
• **Find specific NFTs** you want through complex trade paths

What would you like to explore?`,
      suggestions: [
        "Show me what's trending",
        "Find trades for [NFT address]",
        context.walletAddress ? "Analyze my portfolio" : "How does SWAPS work?",
        "Browse top collections"
      ],
      confidence: 0.6
    };
  }

  // Test method to verify OpenAI API connection
  async testOpenAIConnection(): Promise<boolean> {
    console.log('🧪 Testing OpenAI API connection...');
    
    if (!this.openai) {
      console.error('❌ OpenAI client not initialized');
      return false;
    }
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Say "Hello, SWAPS AI is working!" in exactly those words.' }
        ],
        max_tokens: 20,
        temperature: 0
      });
      
      const message = response.choices[0].message.content;
      console.log('✅ OpenAI API test successful:', message);
      return true;
    } catch (error: any) {
      console.error('❌ OpenAI API test failed:', error);
      console.error('Error details:', {
        message: error?.message,
        type: error?.type,
        code: error?.code
      });
      return false;
    }
  }
}