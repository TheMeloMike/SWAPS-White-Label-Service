import express from 'express';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { TradeDiscoveryService } from './lib/trade-discovery';
import { TradeVisualizer } from './lib/trade-discovery/visualizer';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const tradeDiscovery = new TradeDiscoveryService();
const visualizer = new TradeVisualizer();

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'findTrades') {
        const trades = await tradeDiscovery.findPotentialTrades(
          data.targetNFT,
          data.userWallet,
          data.connectedWallets
        );
        
        ws.send(JSON.stringify({
          type: 'tradePaths',
          paths: trades
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process request'
      }));
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 