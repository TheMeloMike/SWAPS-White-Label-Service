import { TradeStep, NFTMetadata, IndexingStats } from './types';
import { WebSocket } from 'ws';
import { createServer } from 'http';
import { D3Node } from 'd3-node';

export class TradeVisualizer {
  private wsServer: WebSocket.Server;
  private clients: Set<WebSocket>;
  private readonly PORT = 3001;

  constructor() {
    this.clients = new Set();
    this.initializeWebSocket();
    this.initializeD3Visualizations();
  }

  private initializeWebSocket() {
    const server = createServer();
    this.wsServer = new WebSocket.Server({ server });

    this.wsServer.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });

    server.listen(this.PORT);
  }

  async visualizeTradeLoop(path: TradeStep[]): Promise<void> {
    const d3n = new D3Node();
    const svg = this.createInteractiveGraph(d3n, path);
    
    // Send updates to all connected clients
    this.broadcast({
      type: 'tradeLoop',
      data: {
        svg: svg.toString(),
        metrics: this.calculateTradeMetrics(path),
        timestamp: Date.now()
      }
    });
  }

  private createInteractiveGraph(d3n: D3Node, path: TradeStep[]): string {
    // Create interactive D3 visualization
    const d3 = d3n.d3;
    const svg = d3.select(d3n.document.body)
      .append('svg')
      .attr('width', 800)
      .attr('height', 600);

    // Add interactive elements
    this.addZoomBehavior(svg);
    this.addDragBehavior(svg);
    this.addTooltips(svg);
    this.addAnimations(svg);

    return d3n.svgString();
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  visualizeIndexingProgress(stats: IndexingStats): void {
    const progress = (stats.processedWallets / stats.totalWallets) * 100;
    console.log(`
Indexing Progress: ${progress.toFixed(2)}%
├── Processed: ${stats.processedWallets}/${stats.totalWallets} wallets
├── Total NFTs: ${stats.totalNFTs}
└── Errors: ${stats.errors.length}
    `);
  }

  visualizePathExploration(
    currentPath: TradeStep[],
    efficiency: number,
    depth: number
  ): void {
    console.log(`
Exploring Path (Depth: ${depth}):
├── Current Efficiency: ${(efficiency * 100).toFixed(2)}%
├── Path Length: ${currentPath.length}
└── Trade Steps:
    ${this.formatTradeSteps(currentPath)}
    `);
  }

  private formatTradeSteps(path: TradeStep[]): string {
    return path.map((step, index) => `
    ${index + 1}. ${step.from.slice(0, 8)} → ${step.to.slice(0, 8)}
       ├── NFTs: ${step.nfts.map(nft => nft.name).join(', ')}
       └── SOL Adjustment: ${step.solAdjustment || 0} SOL
    `).join('\n');
  }

  private generateGraphNodes(path: TradeStep[]): string {
    const nodes = new Set<string>();
    path.forEach(step => {
      nodes.add(step.from);
      nodes.add(step.to);
    });

    return Array.from(nodes)
      .map(wallet => `  "${wallet}" [label="${wallet.slice(0, 8)}..."]`)
      .join('\n');
  }

  private generateGraphEdges(path: TradeStep[]): string {
    return path
      .map(step => {
        const label = `${step.nfts.map(nft => nft.name).join(', ')}
${step.solAdjustment ? `${step.solAdjustment} SOL` : ''}`;
        return `  "${step.from}" -> "${step.to}" [label="${label}"]`;
      })
      .join('\n');
  }

  private initializeEventListeners(): void {
    process.on('indexing-progress', (stats: IndexingStats) => {
      this.visualizeIndexingProgress(stats);
    });

    process.on('path-exploration', (data: {
      path: TradeStep[];
      efficiency: number;
      depth: number;
    }) => {
      this.visualizePathExploration(data.path, data.efficiency, data.depth);
    });
  }
} 