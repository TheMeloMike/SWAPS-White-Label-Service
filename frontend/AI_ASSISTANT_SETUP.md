# SWAPS AI Assistant Setup Guide

## Overview
The SWAPS AI Assistant is a sophisticated LLM-powered chatbot that helps users discover multi-party NFT trade opportunities. It uses real-time data from the SWAPS ecosystem to provide intelligent, context-aware responses.

## Environment Variables

Add these to your `.env.local` file:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api

# AI Assistant Configuration
# Get your API key from OpenAI or Anthropic
NEXT_PUBLIC_AI_API_KEY=your-api-key-here

# AI Model Selection
# Options: gpt-4, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet
NEXT_PUBLIC_AI_MODEL=gpt-4

# Solana Network
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Optional: API Endpoints (if using proxy)
NEXT_PUBLIC_OPENAI_API_URL=https://api.openai.com/v1
NEXT_PUBLIC_ANTHROPIC_API_URL=https://api.anthropic.com/v1
```

## Getting API Keys

### OpenAI (GPT-4)
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

### Anthropic (Claude 3)
1. Go to [Anthropic Console](https://console.anthropic.com/account/keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

## Model Selection

- **gpt-4**: Most capable, best for complex trade analysis and market insights
- **gpt-3.5-turbo**: Faster and cheaper, good for basic interactions
- **claude-3-opus**: Anthropic's most capable model, excellent reasoning
- **claude-3-sonnet**: Good balance of capability and speed

## Features

Once configured, the AI Assistant can:

1. **Intelligent Conversation**: Natural language understanding of trade requests
2. **Market Analysis**: Real-time insights on NFT collections and trends
3. **Trade Path Discovery**: Finds complex multi-party trade opportunities
4. **Portfolio Analysis**: Understands your NFT holdings and suggests strategies
5. **Collection Insights**: Provides data on floor prices, volume, and trends

## Testing the Setup

1. Start the frontend application
2. Click on the AI Assistant button (bottom-right corner)
3. Try these test queries:
   - "What's the current floor price of Mad Lads?"
   - "Find me trade paths for [NFT_ADDRESS]"
   - "What are the trending collections today?"
   - "Analyze my portfolio"

## Troubleshooting

If the AI Assistant falls back to basic responses:

1. Check that your API key is correctly set in `.env.local`
2. Verify the API key has sufficient credits/usage
3. Check the browser console for any API errors
4. Ensure the selected model is available for your API key

## Cost Considerations

- GPT-4: ~$0.03 per 1K tokens (most expensive but best quality)
- GPT-3.5-turbo: ~$0.001 per 1K tokens (very affordable)
- Claude 3 Opus: ~$0.015 per 1K tokens
- Claude 3 Sonnet: ~$0.003 per 1K tokens

Average conversation uses 500-2000 tokens.

## OpenAI Configuration

### 1. Create a GPT-4 Assistant

Go to [OpenAI Platform](https://platform.openai.com/assistants) and create a new assistant with:

**Name**: SWAPS AI Trading Assistant

**Instructions**: Copy the entire system prompt from `frontend/src/services/ai/openai-prompts.md`

**Model**: GPT-4 (or GPT-4 Turbo for faster responses)

**Temperature**: 0.7

**Tools**: Enable if you want to add custom functions

### 2. Fine-tuning (Optional)

For even better responses, create a fine-tuning dataset:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are SWAPS AI Assistant..."
    },
    {
      "role": "user", 
      "content": "I want a Mad Lads NFT"
    },
    {
      "role": "assistant",
      "content": "Mad Lads - excellent choice! It's one of our top 5 most wanted collections..."
    }
  ]
}
```

## Claude (Anthropic) Configuration

### 1. API Setup

```javascript
// Example configuration
const claudeConfig = {
  model: "claude-3-opus-20240229",
  max_tokens: 1000,
  temperature: 0.7,
  system: "Copy from openai-prompts.md"
}
```

### 2. Constitutional AI Settings

Add these principles for Claude:

```
- Always be helpful and enthusiastic about NFT trading
- Never provide financial advice or guarantees
- Focus on the technical capabilities of SWAPS
- Use specific data and statistics when available
- Explain complex concepts in simple terms
```

## Data Integration

The AI Assistant automatically integrates with:

### 1. SwapsKnowledgeService
- Real-time market data
- Collection statistics
- Trade patterns and routes
- User behavior insights

### 2. TradeService
- Live trade discovery
- Path finding algorithms
- Trade scoring and validation

### 3. NFTService
- NFT metadata lookup
- Collection information
- Price data

## Testing the AI Assistant

### 1. Basic Functionality Test

```javascript
// Test queries to validate setup
const testQueries = [
  "Hello",
  "How does SWAPS work?",
  "I want a DeGods NFT",
  "CQCrLu5AQ15zSBGyNodWYxXxBfYHibMN29DR1jPXaFHx",
  "What are the most active collections?",
  "Show me 5-way trade loops"
];
```

### 2. Knowledge Base Validation

Ensure the AI correctly references:
- Algorithm names (Tarjan's, Johnson's)
- Statistics (3,547 loops, 87.5% success rate)
- Collection names
- Trade patterns

### 3. Context Awareness

Test with connected wallet:
- AI should recognize wallet connection
- Reference user's NFTs
- Provide personalized recommendations

## Advanced Features

### 1. Custom Functions (OpenAI)

Add function calling for:
```json
{
  "name": "search_trade_paths",
  "description": "Search for multi-party trade paths",
  "parameters": {
    "type": "object",
    "properties": {
      "nft_address": {"type": "string"},
      "max_hops": {"type": "integer"}
    }
  }
}
```

### 2. Streaming Responses

Enable streaming for better UX:
```javascript
stream: true,
stream_callback: (chunk) => {
  // Update UI with partial response
}
```

### 3. Conversation Memory

The system maintains conversation history:
- Last 10 messages are included in context
- User preferences are remembered
- Trade searches are tracked

## Monitoring & Analytics

### Track Key Metrics:
1. Response time
2. User satisfaction (via feedback)
3. Trade discovery success rate
4. Most common queries
5. Error rates

### Logging:
```javascript
console.log('AI Metrics:', {
  avgResponseTime: metrics.responseTime,
  successfulTrades: metrics.tradesFound,
  userSatisfaction: metrics.satisfaction
});
```

## Troubleshooting

### Common Issues:

1. **Slow Responses**
   - Check API rate limits
   - Reduce max_tokens
   - Use GPT-3.5-Turbo for faster responses

2. **Generic Responses**
   - Ensure system prompt is loaded
   - Check SwapsKnowledgeService is working
   - Verify API key permissions

3. **Incorrect Data**
   - Validate knowledge base updates
   - Check service connections
   - Review error logs

### Debug Mode:
```javascript
// Enable debug logging
localStorage.setItem('ai_debug', 'true');
```

## Best Practices

1. **Update Knowledge Base Regularly**
   - Run cron job for market data
   - Update collection statistics daily
   - Track new algorithms/features

2. **Optimize Prompts**
   - A/B test different phrasings
   - Monitor user satisfaction
   - Iterate based on feedback

3. **Handle Edge Cases**
   - Wallet not connected
   - No trades available
   - API errors/timeouts

4. **Security**
   - Never expose private keys
   - Validate all user inputs
   - Rate limit API calls

## Future Enhancements

1. **Voice Integration**
   - Speech-to-text input
   - Natural conversation flow

2. **Predictive Analytics**
   - ML models for trade success
   - Price prediction integration

3. **Multi-language Support**
   - Translate prompts
   - Localized responses

4. **Advanced Visualizations**
   - Trade path diagrams
   - Interactive collection maps 