import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { NFTMetadata, NFTGenerationConfig } from './types';

export class NFTGenerator {
  private connection: Connection;
  private metaplex: Metaplex;

  constructor(connection: Connection, adminKeypair: Keypair) {
    this.connection = connection;
    this.metaplex = Metaplex.make(connection)
      .use(keypairIdentity(adminKeypair));
  }

  async generateNFTMetadata(
    index: number,
    config: NFTGenerationConfig
  ): Promise<NFTMetadata> {
    return {
      name: `Test NFT #${index + 1}`,
      symbol: config.symbol,
      description: `Test NFT for Solana NFT Swap #${index + 1}`,
      address: '', // Will be set after minting
      uri: `${config.baseUri}/nft-${index + 1}.json`,
      attributes: [
        {
          trait_type: 'Test ID',
          value: index + 1,
        },
      ],
      walletOwner: '', // Will be set during distribution
    };
  }

  async mintNFT(metadata: NFTMetadata): Promise<string> {
    try {
      const { nft } = await this.metaplex.nfts().create({
        uri: metadata.uri,
        name: metadata.name,
        symbol: metadata.symbol,
        sellerFeeBasisPoints: 500, // 5% royalty
      });

      return nft.address.toString();
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw error;
    }
  }
} 