import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { NFTController } from '../controllers/NFTController';
import { NFTService } from '../services/nft/NFTService';
import { WalletService } from '../services/trade/WalletService';
import { LoggingService } from '../utils/logging/LoggingService';

// Mock dependencies
jest.mock('../services/nft/NFTService');
jest.mock('../services/trade/WalletService');
jest.mock('../utils/logging/LoggingService');

describe('NFTController', () => {
  let mockNftService: jest.Mocked<NFTService>;
  let mockWalletService: jest.Mocked<WalletService>;
  let mockLogger: any;
  let nftController: NFTController;
  let mockOperation: any;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock logger and operation
    mockOperation = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      end: jest.fn()
    };
    
    // Mock logger instance
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      operation: jest.fn().mockReturnValue(mockOperation)
    };
    
    // Configure LoggingService mock
    const mockLoggerFactory = {
      createLogger: jest.fn().mockReturnValue(mockLogger)
    };
    (LoggingService.getInstance as jest.Mock).mockReturnValue(mockLoggerFactory);
    
    // Create mocked NFTService and WalletService
    mockNftService = NFTService.getInstance() as jest.Mocked<NFTService>;
    mockWalletService = new WalletService({} as any, new Map()) as jest.Mocked<WalletService>;
    
    // Create the controller with mock dependencies
    nftController = new NFTController(mockNftService, mockWalletService);
  });
  
  // Create mock request and response objects for testing
  function createMockRequestResponse(params = {}, body = {}) {
    const req = {
      params,
      body
    } as Partial<Request> as Request;
    
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    } as Partial<Response> as Response;
    
    return { req, res };
  }
  
  describe('getNFTMetadata', () => {
    it('should return NFT metadata for a valid address', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({ nftAddress: 'testNftAddress' });
      const mockNft = { address: 'testNftAddress', name: 'Test NFT' };
      mockNftService.getNFTMetadata = jest.fn().mockResolvedValue(mockNft);
      
      // Execute
      await nftController.getNFTMetadata(req, res);
      
      // Verify
      expect(mockNftService.getNFTMetadata).toHaveBeenCalledWith('testNftAddress');
      expect(res.json).toHaveBeenCalledWith({ nft: mockNft });
      expect(mockOperation.info).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should handle errors when fetching NFT metadata', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({ nftAddress: 'testNftAddress' });
      const mockError = new Error('Test error');
      mockNftService.getNFTMetadata = jest.fn().mockRejectedValue(mockError);
      
      // Execute
      await nftController.getNFTMetadata(req, res);
      
      // Verify
      expect(mockNftService.getNFTMetadata).toHaveBeenCalledWith('testNftAddress');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to fetch NFT'
      }));
      expect(mockOperation.error).toHaveBeenCalled();
      expect(mockOperation.end).toHaveBeenCalled();
    });
  });
  
  describe('getUserNFTs', () => {
    it('should return NFTs for a valid wallet address', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({ walletAddress: 'testWalletAddress' });
      const mockNftAddresses = ['nft1', 'nft2', 'nft3'];
      const mockNfts = [
        { address: 'nft1', name: 'NFT 1' },
        { address: 'nft2', name: 'NFT 2' },
        { address: 'nft3', name: 'NFT 3' }
      ];
      
      mockWalletService.getWalletNFTs = jest.fn().mockResolvedValue(mockNftAddresses);
      mockNftService.batchGetNFTMetadata = jest.fn().mockResolvedValue(mockNfts);
      
      // Execute
      await nftController.getUserNFTs(req, res);
      
      // Verify
      expect(mockWalletService.getWalletNFTs).toHaveBeenCalledWith('testWalletAddress');
      expect(mockNftService.batchGetNFTMetadata).toHaveBeenCalledWith(mockNftAddresses.slice(0, 20), expect.any(Number));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        nfts: mockNfts,
        totalCount: mockNftAddresses.length,
        fetchedCount: mockNfts.length
      }));
      expect(mockOperation.info).toHaveBeenCalledTimes(3); // Logs for start, found NFTs, and success
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should handle empty NFT lists', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({ walletAddress: 'emptyWallet' });
      mockWalletService.getWalletNFTs = jest.fn().mockResolvedValue([]);
      
      // Execute
      await nftController.getUserNFTs(req, res);
      
      // Verify
      expect(mockWalletService.getWalletNFTs).toHaveBeenCalledWith('emptyWallet');
      expect(mockNftService.batchGetNFTMetadata).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        nfts: [],
        totalCount: 0,
        fetchedCount: 0
      }));
      expect(mockOperation.info).toHaveBeenCalledWith(expect.stringContaining('No NFTs found'), expect.any(Object));
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should handle errors when fetching wallet NFTs', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({ walletAddress: 'testWalletAddress' });
      const mockError = new Error('Failed to get wallet NFTs');
      mockWalletService.getWalletNFTs = jest.fn().mockRejectedValue(mockError);
      
      // Execute
      await nftController.getUserNFTs(req, res);
      
      // Verify
      expect(mockWalletService.getWalletNFTs).toHaveBeenCalledWith('testWalletAddress');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to fetch user NFTs'
      }));
      expect(mockOperation.error).toHaveBeenCalled();
      expect(mockOperation.end).toHaveBeenCalled();
    });
  });
  
  describe('getBatchNFTMetadata', () => {
    it('should return metadata for a batch of NFT addresses', async () => {
      // Setup
      const addresses = ['nft1', 'nft2', 'nft3'];
      const { req, res } = createMockRequestResponse({}, { addresses });
      
      const mockNfts = [
        { address: 'nft1', name: 'NFT 1' },
        { address: 'nft2', name: 'NFT 2' },
        { address: 'nft3', name: 'NFT 3' }
      ];
      
      mockNftService.batchGetNFTMetadata = jest.fn().mockResolvedValue(mockNfts);
      
      // Execute
      await nftController.getBatchNFTMetadata(req, res);
      
      // Verify
      expect(mockNftService.batchGetNFTMetadata).toHaveBeenCalledWith(addresses, expect.any(Number));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        nfts: mockNfts,
        total: addresses.length,
        succeeded: mockNfts.length,
        failed: 0
      }));
      expect(mockOperation.info).toHaveBeenCalledWith(expect.stringContaining('Batch NFT metadata fetch completed'), expect.any(Object));
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should handle errors in batch processing', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({}, { addresses: ['nft1', 'nft2'] });
      const mockError = new Error('Batch processing failed');
      mockNftService.batchGetNFTMetadata = jest.fn().mockRejectedValue(mockError);
      
      // Execute
      await nftController.getBatchNFTMetadata(req, res);
      
      // Verify
      expect(mockNftService.batchGetNFTMetadata).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to fetch NFTs'
      }));
      expect(mockOperation.error).toHaveBeenCalled();
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should handle invalid input', async () => {
      // Setup
      const { req, res } = createMockRequestResponse({}, { addresses: 'not-an-array' });
      
      // Execute
      await nftController.getBatchNFTMetadata(req, res);
      
      // Verify
      expect(mockNftService.batchGetNFTMetadata).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid or empty addresses array'
      }));
      expect(mockOperation.warn).toHaveBeenCalled();
      expect(mockOperation.end).toHaveBeenCalled();
    });
    
    it('should truncate requests exceeding the batch limit', async () => {
      // Setup
      // Create an array of 25 addresses (above the 20 limit)
      const addresses = Array(25).fill(0).map((_, i) => `nft${i}`);
      const { req, res } = createMockRequestResponse({}, { addresses });
      
      // Mock responses for the first 20 NFTs
      const mockNfts = addresses.slice(0, 20).map(addr => ({ 
        address: addr, 
        name: `NFT ${addr.slice(3)}` 
      }));
      
      mockNftService.batchGetNFTMetadata = jest.fn().mockResolvedValue(mockNfts);
      
      // Execute
      await nftController.getBatchNFTMetadata(req, res);
      
      // Verify
      expect(mockOperation.warn).toHaveBeenCalledWith('Batch request truncated', expect.any(Object));
      expect(mockNftService.batchGetNFTMetadata).toHaveBeenCalledWith(
        addresses.slice(0, 20), // Should only process the first 20
        expect.any(Number)
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        total: 20, // Should reflect the truncated count
        succeeded: 20
      }));
    });
  });
}); 