import { Router } from 'express';
import { TradeDiscoveryService } from '../../lib/trade-discovery';

const router = Router();
const tradeDiscovery = new TradeDiscoveryService();

router.post('/trade-discovery', async (req, res) => {
  try {
    const { targetNFT, userWallet } = req.body;
    const trades = await tradeDiscovery.findPotentialTrades(targetNFT, userWallet);
    res.json(trades);
  } catch (error) {
    console.error('Trade discovery error:', error);
    res.status(500).json({ error: 'Failed to find trades' });
  }
});

export default router; 