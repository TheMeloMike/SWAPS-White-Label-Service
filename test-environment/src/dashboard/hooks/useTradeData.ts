import { useState, useEffect } from 'react';
import { TradeStep, TradeMetrics } from '../../lib/trade-discovery/types';

export function useTradeData() {
  const [tradePaths, setTradePaths] = useState<TradeStep[][]>([]);
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'tradePaths':
          setTradePaths(data.paths);
          break;
        case 'metrics':
          setMetrics(data.metrics);
          break;
        case 'history':
          setHistory(prev => [...prev, data.entry]);
          break;
        case 'status':
          setStatus(data.status);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };

    return () => {
      ws.close();
    };
  }, []);

  return {
    tradePaths,
    metrics,
    history,
    status
  };
} 