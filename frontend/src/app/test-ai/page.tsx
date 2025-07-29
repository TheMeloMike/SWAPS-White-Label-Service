'use client';

import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 50px auto;
  padding: 20px;
`;

const Title = styled.h1`
  color: white;
  margin-bottom: 20px;
`;

const InfoBox = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  color: white;
`;

const Button = styled.button`
  background: #6d66d6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin-right: 10px;
  
  &:hover {
    background: #5952b5;
  }
`;

const ResponseBox = styled.pre`
  background: rgba(0, 0, 0, 0.3);
  padding: 20px;
  border-radius: 8px;
  color: #0ff;
  overflow-x: auto;
  font-size: 12px;
`;

export default function TestAIPage() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const testOpenAI = async () => {
    setLoading(true);
    setResponse('Testing OpenAI API...\n');
    
    try {
      // Log environment variables (safely)
      const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;
      const model = process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4';
      
      setResponse(prev => prev + `\nEnvironment Check:\n`);
      setResponse(prev => prev + `- API Key present: ${!!apiKey}\n`);
      setResponse(prev => prev + `- API Key length: ${apiKey?.length || 0}\n`);
      setResponse(prev => prev + `- API Key prefix: ${apiKey?.substring(0, 10)}...\n`);
      setResponse(prev => prev + `- Model: ${model}\n\n`);

      if (!apiKey) {
        setResponse(prev => prev + 'ERROR: No API key found in environment variables!\n');
        setLoading(false);
        return;
      }

      // Make a direct API call
      setResponse(prev => prev + 'Making API call to OpenAI...\n');
      
      const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello from SWAPS!" and nothing else.' }
          ],
          max_tokens: 50,
          temperature: 0.7,
        }),
      });

      setResponse(prev => prev + `\nAPI Response Status: ${apiResponse.status}\n`);

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        setResponse(prev => prev + `\nError Response:\n${errorText}\n`);
      } else {
        const data = await apiResponse.json();
        setResponse(prev => prev + `\nSuccess! Response:\n${JSON.stringify(data, null, 2)}\n`);
      }
    } catch (error) {
      setResponse(prev => prev + `\nError: ${error}\n`);
    }
    
    setLoading(false);
  };

  const testLLMService = async () => {
    setLoading(true);
    setResponse('Testing LLMService...\n');
    
    try {
      const { LLMService } = await import('@/services/ai/llm.service');
      const llmService = LLMService.getInstance();
      
      setResponse(prev => prev + 'LLMService loaded successfully\n');
      setResponse(prev => prev + 'Calling generateResponse...\n');
      
      const result = await llmService.generateResponse(
        "What's the current floor price of Mad Lads?",
        {
          userWallet: '11111111111111111111111111111111',
          marketContext: {
            totalVolume24h: 1000,
            activeTraders: 50,
            topCollections: ['Mad Lads', 'DeGods'],
            trendingNFTs: [],
            swapsNetworkStats: {
              totalLoopsFound: 100,
              averageLoopSize: 3,
              successRate: 85
            }
          }
        }
      );
      
      setResponse(prev => prev + `\nLLMService Response:\n${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      setResponse(prev => prev + `\nError: ${error}\n`);
    }
    
    setLoading(false);
  };

  return (
    <Container>
      <Title>OpenAI Integration Test</Title>
      
      <InfoBox>
        <p>This page tests the OpenAI integration directly.</p>
        <p>Check the browser console for detailed logs.</p>
      </InfoBox>

      <div>
        <Button onClick={testOpenAI} disabled={loading}>
          Test Direct OpenAI API
        </Button>
        <Button onClick={testLLMService} disabled={loading}>
          Test LLMService
        </Button>
      </div>

      {response && (
        <ResponseBox>{response}</ResponseBox>
      )}
    </Container>
  );
} 