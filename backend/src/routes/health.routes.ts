import express from 'express';
import { TradeDiscoveryService } from '../lib/trade-discovery';

const router = express.Router();
const tradeDiscovery = TradeDiscoveryService.getInstance();

// Main health check endpoint
router.get('/', (_req, res) => {
  const systemState = tradeDiscovery.getSystemState();
  res.json({
    status: 'ok',
    message: 'SWAPS Backend Running',
    timestamp: new Date().toISOString(),
    system: {
      walletCount: systemState.wallets,
      nftCount: systemState.nfts,
      tradeRequests: systemState.wanted
    }
  });
});

export default router; 