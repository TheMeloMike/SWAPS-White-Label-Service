## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

### AI Assistant Configuration (Optional)

To enable the intelligent AI assistant powered by GPT-4 or Claude 3:

```bash
# Get your API key from OpenAI or Anthropic
NEXT_PUBLIC_AI_API_KEY=your-api-key-here

# Choose your model: gpt-4, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet
NEXT_PUBLIC_AI_MODEL=gpt-4
```

See [AI_ASSISTANT_SETUP.md](./AI_ASSISTANT_SETUP.md) for detailed setup instructions.

## Running the Application 