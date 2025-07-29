import express from 'express';
import { NFTController } from '../controllers/NFTController';
import { NFTService } from '../services/nft/NFTService';
import { WalletService } from '../services/trade/WalletService';
import { Helius } from 'helius-sdk';
import fetch from 'node-fetch';
import { Request, Response } from 'express';
import { LoggingService } from '../utils/logging/LoggingService';
import { ipfsGatewayService } from '../services/ipfsGateway.service';

const router = express.Router();
const logger = LoggingService.getInstance().createLogger('NFTRoutes');

// Create instances
const apiKey = process.env.HELIUS_API_KEY || '';
const helius = new Helius(apiKey);
const nftService = NFTService.getInstance();
const walletService = new WalletService(helius, new Map());
const nftController = new NFTController(nftService, walletService);

// Get metadata for a specific NFT by mint address
router.get('/:nftAddress', nftController.getNFTMetadata);

// Get NFTs owned by a specific wallet
router.get('/wallet/:walletAddress', nftController.getUserNFTs);

// Batch fetch NFT metadata for multiple NFTs
router.post('/batch', nftController.getBatchNFTMetadata);

// Special endpoint for Shadow Drive NFTs validation and access
router.post('/shadow-drive/validate', async (req: Request, res: Response) => {
  try {
    const { nftAddress, imageUrl } = req.body;
    
    if (!nftAddress || !imageUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters. Need both nftAddress and imageUrl.' 
      });
    }
    
    // Verify this is actually a Shadow Drive URL
    if (!imageUrl.includes('shdw-drive.genesysgo.net')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Not a Shadow Drive URL. This endpoint is specific to Shadow Drive NFTs.' 
      });
    }
    
    logger.info('Shadow Drive validation request', { 
      nftAddress, 
      imageUrl 
    });
    
    // Try to fetch and validate the Shadow Drive URL
    try {
      // Use a generous timeout for Shadow Drive
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.ok) {
        logger.info('Shadow Drive URL is accessible via HEAD', { nftAddress, imageUrl });
        
        return res.json({
          success: true,
          message: 'Shadow Drive URL is accessible',
          validation: {
            method: 'HEAD',
            statusCode: response.status,
            isAccessible: true,
            contentType: response.headers.get('content-type') || 'unknown'
          }
        });
      }
      
      // If HEAD fails, try GET with range request
      logger.info('HEAD request failed, trying GET', { nftAddress, imageUrl });
      
      const getResponse = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*',
          'Range': 'bytes=0-1024' // Just get the first KB
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (getResponse.ok) {
        logger.info('Shadow Drive URL is accessible via GET', { nftAddress, imageUrl });
        
        return res.json({
          success: true,
          message: 'Shadow Drive URL is accessible via GET',
          validation: {
            method: 'GET',
            statusCode: getResponse.status,
            isAccessible: true,
            contentType: getResponse.headers.get('content-type') || 'unknown'
          }
        });
      }
      
      // Both methods failed
      logger.warn('Shadow Drive URL is not accessible', { 
        nftAddress, 
        imageUrl, 
        headStatus: response.status,
        getStatus: getResponse.status
      });
      
      return res.json({
        success: true,
        message: 'Shadow Drive URL appears to be inaccessible',
        validation: {
          method: 'BOTH',
          headStatus: response.status,
          getStatus: getResponse.status,
          isAccessible: false
        }
      });
    } catch (error) {
      logger.error('Error validating Shadow Drive URL', {
        nftAddress,
        imageUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // For Shadow Drive URLs, we often want to proceed even with validation errors
      return res.json({
        success: true,
        message: 'Shadow Drive URL validation encountered errors but may still work in browsers',
        validation: {
          method: 'ERROR',
          isAccessible: true, // Assume it might work in browsers even if our validation fails
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  } catch (error) {
    logger.error('Error in Shadow Drive validation endpoint', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Server error while validating Shadow Drive URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Admin endpoint for monitoring IPFS gateway performance
router.get('/ipfs-gateway-stats', async (req, res) => {
  try {
    const stats = ipfsGatewayService.getGatewayStats();
    const formattedStats = Object.entries(stats).map(([gateway, metrics]) => {
      const successRate = metrics.totalAttempts > 0 
        ? (metrics.successCount / metrics.totalAttempts * 100).toFixed(2) + '%'
        : 'N/A';
      
      return {
        gateway,
        successRate,
        totalAttempts: metrics.totalAttempts,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        averageResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms',
        lastSuccess: metrics.lastSuccess ? new Date(metrics.lastSuccess).toISOString() : 'Never',
        lastUsed: new Date(metrics.lastUsed).toISOString()
      };
    });
    
    // Sort by success rate (descending)
    formattedStats.sort((a, b) => {
      const rateA = a.successRate === 'N/A' ? 0 : parseFloat(a.successRate);
      const rateB = b.successRate === 'N/A' ? 0 : parseFloat(b.successRate);
      return rateB - rateA;
    });
    
    return res.json({
      gatewayStats: formattedStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving IPFS gateway stats', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Failed to retrieve gateway statistics' });
  }
});

// Image proxy endpoint to handle CORS issues with NFT images
router.get('/image-proxy/:mintAddress', async (req, res) => {
  const mintAddress = req.params.mintAddress;
  // Get collection parameter if available, for better IPFS gateway selection
  const collectionParam = req.query.collection as string | undefined;
  // Check if this is a forced refresh request
  const forceRefresh = req.query.refresh === 'true';
  
  // Generate a unique hash for this request for easier log tracking
  const urlHash = require('crypto').createHash('md5').update(mintAddress).digest('hex').substring(0, 8);
  const operation = logger.operation(`image-proxy-${urlHash}`);

  try {
    operation.info(`Proxy request started for NFT: ${mintAddress}${collectionParam ? ', collection: ' + collectionParam : ''}${forceRefresh ? ' (forced refresh)' : ''}`);
    
    // Check for If-None-Match header (client ETag)
    const clientETag = req.headers['if-none-match'];
    const etagForMint = `"nft-${mintAddress.substring(0, 10)}-${urlHash}"`;
    
    // Add debugging headers to the response
    res.setHeader('X-Debug-NFT-Mint', mintAddress);
    res.setHeader('X-Debug-Request-Hash', urlHash);
    res.setHeader('ETag', etagForMint);
    
    // Only check ETag if not forcing a refresh
    if (!forceRefresh && clientETag === etagForMint) {
      operation.info(`Client provided matching ETag: ${clientETag}`);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.status(304).end();
      operation.end();
      return;
    }
    
    // Get NFT metadata to find the correct image URL - if forcing refresh, make a note in logs
    operation.info(`Fetching NFT metadata${forceRefresh ? ' (bypassing cache)' : ''}...`);
    const nftMetadata = await nftService.getNFTMetadata(mintAddress);
    
    if (!nftMetadata) {
      operation.error('No metadata returned from nftService.');
      return res.status(404).send('NFT metadata not found');
    }
    operation.info(`Metadata fetched successfully. Name: ${nftMetadata.name}`);
    
    if (!nftMetadata.image) {
      operation.error('No image URL found in metadata.');
      return res.status(404).send('Image URL not found in metadata');
    }
    
    let imageUrl = nftMetadata.image;
    operation.info(`Original image URL from metadata: ${imageUrl}`);

    // --- Handle placeholder URLs by generating an SVG directly ---
    if (imageUrl.includes('placeholder.com') || 
        imageUrl.match(/placeholder\.(com|io|net)/) ||
        imageUrl.match(/via\.placeholder/) ||
        imageUrl.match(/placehold\.it/)) {
      operation.info(`Detected placeholder URL: ${imageUrl} - will generate SVG directly`);
      
      // Extract text from placeholder URL if available
      const textMatch = imageUrl.match(/text=([^&]+)/i);
      const placeholderText = textMatch ? decodeURIComponent(textMatch[1]) : nftMetadata.name || `NFT ${mintAddress.slice(0, 8)}...`;
      
      // Create a simple SVG with the text
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
          <rect width="300" height="300" fill="#303050"/>
          <text x="150" y="150" font-family="Arial, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${placeholderText}</text>
        </svg>
      `;
      
      // Set appropriate headers for SVG
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      operation.info('Sending generated SVG placeholder.');
      operation.end();
      return res.send(svgContent.trim());
    }
    // --- End placeholder URL handling ---

    // --- Start URL Normalization & Extraction (No change in logic, just grouping for clarity) ---
    let nftNumber: string | null = null;
    const urlMatch = imageUrl.match(/(\d+)\.(?:png|jpg|jpeg|gif)/i);
    
    if (urlMatch && urlMatch[1]) {
      nftNumber = urlMatch[1];
      operation.info(`Extracted NFT number from URL: ${nftNumber}`);
    } else if (nftMetadata.name) {
      const nameMatch = nftMetadata.name.match(/#(\d+)/i);
      if (nameMatch && nameMatch[1]) {
        nftNumber = nameMatch[1];
        operation.info(`Extracted NFT number from name: ${nftNumber}`);
      }
    }
    // --- End URL Normalization & Extraction ---

    // --- IPFS Handling --- 
    if (imageUrl.startsWith('ipfs://') || imageUrl.includes('/ipfs/') || imageUrl.includes('ipfs.io') || imageUrl.includes('.ipfs.') || imageUrl.includes('dweb.link')) {
      operation.info('Detected IPFS URL, using dynamic gateway selection.');
      try {
        // Normalize the IPFS URL to extract CID and path
        let cid = '';
        let path = '';
        
        // Extract the CID (Content ID) and path from various IPFS URL formats
        if (imageUrl.startsWith('ipfs://')) {
          const ipfsPath = imageUrl.replace('ipfs://', '');
          if (ipfsPath.includes('/')) {
            cid = ipfsPath.substring(0, ipfsPath.indexOf('/'));
            path = ipfsPath.substring(ipfsPath.indexOf('/'));
          } else {
            cid = ipfsPath;
            path = '';
          }
        } 
        else if (imageUrl.includes('/ipfs/')) {
          const ipfsMatch = imageUrl.match(/\/ipfs\/([^\/\s]+)(\/.*)?/);
          if (ipfsMatch) {
            cid = ipfsMatch[1];
            path = ipfsMatch[2] || '';
          }
        }
        else if (imageUrl.includes('.ipfs.') || imageUrl.includes('dweb.link')) {
          // Handle URLs like bafybei....ipfs.dweb.link/123.png
          const dwebMatch = imageUrl.match(/([a-z0-9]+)\.ipfs\.dweb\.link(\/.*)?/i);
          if (dwebMatch) {
            cid = dwebMatch[1];
            path = dwebMatch[2] || '';
          } else {
            // Try a more general approach for any dweb.link URL
            const generalMatch = imageUrl.match(/(bafybei[a-z0-9]+)(\/.*)?/i);
            if (generalMatch) {
              cid = generalMatch[1];
              path = generalMatch[2] || '';
            }
          }
        }
        
        // If we successfully extracted a CID, get prioritized gateway URLs
        if (cid) {
          // Try to extract collection name for better gateway prioritization
          let collectionSymbol: string | undefined;
          
          // First use collection from query parameter if available
          if (collectionParam) {
            collectionSymbol = collectionParam;
            operation.info(`Using collection from query parameter: ${collectionSymbol}`);
          }
          // Otherwise try to extract from metadata
          else if (typeof nftMetadata === 'object' && nftMetadata !== null) {
            collectionSymbol = 'symbol' in nftMetadata ? nftMetadata.symbol as string : undefined;
            
            // Try to extract from collection object if available
            if (!collectionSymbol && 'collection' in nftMetadata && typeof nftMetadata.collection === 'object' && nftMetadata.collection !== null) {
              collectionSymbol = 'symbol' in nftMetadata.collection ? nftMetadata.collection.symbol as string : undefined;
            }
            
            // Fall back to name-based extraction
            if (!collectionSymbol && 'name' in nftMetadata && typeof nftMetadata.name === 'string') {
              const nameParts = nftMetadata.name.split('#');
              if (nameParts.length > 1) {
                collectionSymbol = nameParts[0].trim();
              }
            }
          }
          
          // Get dynamically prioritized gateways based on past performance
          const gatewayUrls = ipfsGatewayService.getPrioritizedGateways(cid + path, collectionSymbol);
          
          operation.info(`Extracted CID: ${cid}, path: ${path}, collection: ${collectionSymbol || 'unknown'}`);
          operation.info(`Will try ${gatewayUrls.length} prioritized gateways in sequence`);
          
          // Try gateways in sequence
          let responseData = null;
          let usedGateway = '';
          let contentType = '';
          let startTime = 0;
          let responseTime = 0;

          for (const gateway of gatewayUrls) {
            try {
              operation.info(`Trying IPFS gateway: ${gateway}`);
              startTime = performance.now();
              
              // Use a longer timeout for IPFS which can be slow
              const response = await fetch(gateway, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Accept': 'image/*',
                  'Cache-Control': 'no-cache'
                },
                timeout: 30000 // 30 second timeout
              });
              
              responseTime = performance.now() - startTime;
              
              if (response.ok) {
                contentType = response.headers.get('content-type') || '';
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength > 0) {
                  responseData = buffer;
                  usedGateway = gateway;
                  operation.info(`Successfully fetched from gateway ${gateway}, content type: ${contentType}, size: ${buffer.byteLength} bytes, time: ${responseTime.toFixed(0)}ms`);
                  
                  // Record successful gateway for future prioritization
                  ipfsGatewayService.recordSuccess(gateway, responseTime, collectionSymbol);
                  break;
                } else {
                  operation.warn(`Gateway ${gateway} returned empty response`);
                  ipfsGatewayService.recordFailure(gateway);
                }
              } else {
                operation.warn(`Gateway ${gateway} failed with status: ${response.status}`);
                ipfsGatewayService.recordFailure(gateway);
              }
            } catch (gatewayError: unknown) {
              const errorMessage = gatewayError instanceof Error ? gatewayError.message : String(gatewayError);
              operation.warn(`Error with gateway ${gateway}: ${errorMessage}`);
              ipfsGatewayService.recordFailure(gateway);
              // Continue to the next gateway
            }
          }
          
          // If we have a valid response from any gateway, send it
          if (responseData) {
            const bufferLength = Buffer.from(responseData).length;
            
            // Determine final content type, defaulting to image/png if unknown
            const finalContentType = contentType || 
                               (path.toLowerCase().endsWith('.png') ? 'image/png' : 
                                path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 
                                path.toLowerCase().endsWith('.gif') ? 'image/gif' :
                                path.toLowerCase().endsWith('.svg') ? 'image/svg+xml' :
                                'image/png'); // Default to PNG for IPFS content
            
            res.setHeader('Content-Type', finalContentType);
            res.setHeader('Content-Length', bufferLength.toString());
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('X-IPFS-Gateway-Used', usedGateway);
            
            operation.info(`Sending image buffer from IPFS gateway ${usedGateway}`);
            operation.end();
            return res.send(Buffer.from(responseData));
          }
          
          // If all gateways failed, fall through to the original URL as a last attempt
          operation.warn('All IPFS gateways failed, trying original URL directly as last resort');
          // Continue with the original URL fallback...
          
          // Final attempt with the original URL if none of the gateways worked
          operation.info(`Final attempt with: ${imageUrl}`);
          try {
            const finalResponse = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*',
                'Cache-Control': 'no-cache'
              },
              timeout: 30000
            });
            
            if (finalResponse.ok) {
              const contentTypeHeader = finalResponse.headers.get('content-type');
              operation.info(`Original URL fetch succeeded. Content-Type: ${contentTypeHeader}`);
              
              const imageBuffer = await finalResponse.arrayBuffer();
              const bufferLength = Buffer.from(imageBuffer).length;
              
              if (bufferLength === 0) {
                throw new Error('Empty response from original URL');
              }
              
              const finalContentType = contentTypeHeader || 
                               (imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                                imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 
                                'image/png');
              
              res.setHeader('Content-Type', finalContentType);
              res.setHeader('Content-Length', bufferLength.toString());
              res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
              res.setHeader('Access-Control-Allow-Origin', '*');
              
              operation.info(`Sending image buffer from original URL fetch`);
              operation.end();
              return res.send(Buffer.from(imageBuffer));
            } else {
              throw new Error(`Original URL fetch failed with status: ${finalResponse.status}`);
            }
          } catch (finalError: unknown) {
            const errorMessage = finalError instanceof Error ? finalError.message : String(finalError);
            operation.error(`Final fetch attempt failed: ${errorMessage}`);
            throw finalError; // Let the catch block handle the placeholder creation
          }
        } else {
          // If we couldn't extract a CID, use the original URL
          operation.warn('Could not extract CID from IPFS URL, using original URL');
          // Continue with the original URL fallback...
        }
        
        // Final attempt with the original URL if none of the gateways worked
        operation.info(`Final attempt with: ${imageUrl}`);
        try {
          const finalResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'image/*',
              'Cache-Control': 'no-cache'
            },
            timeout: 30000
          });
          
          if (finalResponse.ok) {
            const contentTypeHeader = finalResponse.headers.get('content-type');
            operation.info(`Original URL fetch succeeded. Content-Type: ${contentTypeHeader}`);
            
            const imageBuffer = await finalResponse.arrayBuffer();
            const bufferLength = Buffer.from(imageBuffer).length;
            
            if (bufferLength === 0) {
              throw new Error('Empty response from original URL');
            }
            
            const finalContentType = contentTypeHeader || 
                             (imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                              imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 
                              'image/png');
            
            res.setHeader('Content-Type', finalContentType);
            res.setHeader('Content-Length', bufferLength.toString());
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            operation.info(`Sending image buffer from original URL fetch`);
            operation.end();
            return res.send(Buffer.from(imageBuffer));
          } else {
            throw new Error(`Original URL fetch failed with status: ${finalResponse.status}`);
          }
        } catch (finalError: unknown) {
          const errorMessage = finalError instanceof Error ? finalError.message : String(finalError);
          operation.error(`Final fetch attempt failed: ${errorMessage}`);
          throw finalError; // Let the catch block handle the placeholder creation
        }
      } catch (ipfsError: unknown) {
        const errorMessage = ipfsError instanceof Error ? ipfsError.message : String(ipfsError);
        operation.error(`Error during IPFS fetch: ${errorMessage}`);
        
        // Generate a placeholder with the NFT name and number if available
        operation.info('Falling back to SVG placeholder after IPFS failure');
        
        // Extract NFT number from name for better placeholder
        let nftDisplayName = nftMetadata.name || `NFT ${mintAddress.slice(0, 8)}...`;
        let nftNum = '';
        if (nftMetadata.name) {
          const numMatch = nftMetadata.name.match(/#(\d+)/i);
          if (numMatch && numMatch[1]) {
            nftNum = numMatch[1];
          }
        }
        
        // Create a fancier placeholder that shows the collection and number
        const svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
            <rect width="300" height="300" fill="#303050"/>
            <text x="150" y="100" font-family="Arial, sans-serif" font-size="20" fill="#FFFFFF" text-anchor="middle">${nftDisplayName}</text>
            ${nftNum ? `<text x="150" y="150" font-family="Arial, sans-serif" font-size="60" fill="#FFFFFF" text-anchor="middle">#${nftNum}</text>` : ''}
            <text x="150" y="200" font-family="Arial, sans-serif" font-size="16" fill="#AAAAAA" text-anchor="middle">Image temporarily unavailable</text>
            <text x="150" y="220" font-family="Arial, sans-serif" font-size="14" fill="#AAAAAA" text-anchor="middle">Please try again later</text>
          </svg>
        `;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400'); // Cache for 1 hour, stale for 1 day
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Image-Fallback', 'svg-placeholder');
        
        operation.info('Sending SVG placeholder after IPFS failure.');
        operation.end();
        return res.send(svgContent.trim());
      }
    }
    // --- End IPFS Handling --- 

    // --- Shadow Drive Handling --- 
    if (imageUrl.includes('shdw-drive.genesysgo.net') || imageUrl.includes('daswebs.xyz')) {
      operation.info('Potential Shadow Drive URL detected.');
      try {
        // Robustly extract the core Shadow Drive URL, removing wrappers
        const coreShadowMatch = imageUrl.match(/(https?:\/\/shdw-drive\.genesysgo\.net\/[^/\s"']+)\/([^/\s"']+)/i);
        let finalShadowUrl = imageUrl; // Default to original if extraction fails
        
        if (coreShadowMatch && coreShadowMatch[1] && coreShadowMatch[2]) {
          const storageAccount = coreShadowMatch[1]; // Includes https:// prefix
          let filename = coreShadowMatch[2];
          operation.info(`Extracted Shadow Drive parts: Account=${storageAccount}, Filename=${filename}`);
          
          // Attempt filename reconstruction only if we have a number AND the original filename was likely numeric
          if (nftNumber && /^d+\.\w+$/.test(filename)) {
             const extension = filename.match(/(\.\w+)$/)?.[1] || '.png'; // Preserve original extension if possible
             filename = `${nftNumber}${extension}`;
             operation.info(`Reconstructed filename using NFT number: ${filename}`);
          }
          
          finalShadowUrl = `${storageAccount}/${filename}`;
          operation.info(`Normalized Shadow Drive URL: ${finalShadowUrl}`);
        } else {
            operation.warn(`Could not extract parts from potential Shadow Drive URL: ${imageUrl}. Using original.`);
        }
        
        operation.info(`Attempting to fetch directly from Shadow Drive: ${finalShadowUrl}`);
        
        // Direct fetch from Shadow Drive with appropriate headers
        const imageResponse = await fetch(finalShadowUrl, {
          headers: {
            // Use a common browser user agent
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/*',
            'Cache-Control': 'no-cache'
          },
          timeout: 15000 // 15 second timeout
        });
        
        operation.info(`Shadow Drive fetch completed. Status: ${imageResponse.status}, OK: ${imageResponse.ok}`);

        if (!imageResponse.ok) {
          // Log the status text if available
          const statusText = imageResponse.statusText;
          operation.error(`Shadow Drive fetch failed. Status: ${imageResponse.status} ${statusText}`);
          throw new Error(`Shadow Drive fetch failed with status: ${imageResponse.status} ${statusText}`);
        }
        
        // Get content type *before* consuming the body
        const contentTypeHeader = imageResponse.headers.get('content-type');
        operation.info(`Received Content-Type header: ${contentTypeHeader}`);

        operation.info('Reading image buffer from Shadow Drive response...');
        const imageBuffer = await imageResponse.arrayBuffer();
        const bufferLength = Buffer.from(imageBuffer).length;
        operation.info(`Image buffer received. Length: ${bufferLength} bytes`);
        
        if (bufferLength === 0) {
            operation.warn('Received empty buffer from Shadow Drive.');
            // Consider throwing error or handling differently? For now, proceed but log.
        }
        
        // Determine final content type
        const finalContentType = contentTypeHeader || 
                           (finalShadowUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                            finalShadowUrl.toLowerCase().endsWith('.jpg') || finalShadowUrl.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 
                            finalShadowUrl.toLowerCase().endsWith('.gif') ? 'image/gif' : 
                            finalShadowUrl.toLowerCase().endsWith('.svg') ? 'image/svg+xml' :
                            'application/octet-stream'); // Default binary if unsure
        operation.info(`Setting final Content-Type: ${finalContentType}`);
        
        // Set appropriate headers for the *proxy response* to the frontend
        res.setHeader('Content-Type', finalContentType);
        res.setHeader('Content-Length', bufferLength.toString());
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
        res.setHeader('Access-Control-Allow-Origin', '*'); // Crucial for frontend
        
        operation.info('Sending image buffer to frontend.');
        operation.end(); // End operation successfully before sending response
        return res.send(Buffer.from(imageBuffer));

      } catch (shadowError: unknown) {
        const errorMessage = shadowError instanceof Error ? shadowError.message : String(shadowError);
        operation.error(`Error during Shadow Drive fetch/processing: ${errorMessage}`);
        if (shadowError instanceof Error && shadowError.stack) {
            operation.error(`Shadow Drive Error Stack: ${shadowError.stack}`);
        }
        
        // IMPORTANT: Don't redirect here. If proxy fails, let it fail.
        // The frontend's onError should handle the ultimate fallback.
        operation.error('Proxy failed during Shadow Drive handling. Responding with 500.');
        operation.end();
        return res.status(500).json({ 
            error: 'Proxy failed while fetching from Shadow Drive',
            details: errorMessage,
            requestHash: urlHash
        });
      }
    }
    // --- End Shadow Drive Handling --- 

    // --- Generic URL Handling (for any remaining URL types) ---
    // Instead of redirecting, which can cause CORS issues, we'll proxy everything
    operation.info(`Handling generic URL: ${imageUrl}`);
    try {
      // Direct fetch with appropriate headers
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000 // 15 second timeout
      });
      
      operation.info(`Generic URL fetch completed. Status: ${imageResponse.status}, OK: ${imageResponse.ok}`);

      if (!imageResponse.ok) {
        operation.error(`Generic URL fetch failed. Status: ${imageResponse.status} ${imageResponse.statusText}`);
        throw new Error(`Generic URL fetch failed with status: ${imageResponse.status}`);
      }
      
      // Get content type header
      const contentTypeHeader = imageResponse.headers.get('content-type');
      operation.info(`Received Content-Type header: ${contentTypeHeader}`);

      operation.info('Reading image buffer from response...');
      const imageBuffer = await imageResponse.arrayBuffer();
      const bufferLength = Buffer.from(imageBuffer).length;
      operation.info(`Image buffer received. Length: ${bufferLength} bytes`);
      
      // Determine final content type
      const finalContentType = contentTypeHeader || 
                         (imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                          imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 
                          imageUrl.toLowerCase().endsWith('.gif') ? 'image/gif' : 
                          imageUrl.toLowerCase().endsWith('.svg') ? 'image/svg+xml' :
                          'application/octet-stream');
      
      // Set appropriate headers
      res.setHeader('Content-Type', finalContentType);
      res.setHeader('Content-Length', bufferLength.toString());
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      operation.info('Sending image buffer to frontend.');
      operation.end();
      return res.send(Buffer.from(imageBuffer));
    } catch (genericError: unknown) {
      const errorMessage = genericError instanceof Error ? genericError.message : String(genericError);
      operation.error(`Error during generic URL fetch: ${errorMessage}`);
      
      // As a last resort, generate a placeholder SVG
      operation.info('Generating placeholder after all fetch attempts failed');
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
          <rect width="300" height="300" fill="#303050"/>
          <text x="150" y="150" font-family="Arial, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${nftMetadata.name || `NFT ${mintAddress.slice(0, 8)}...`}</text>
        </svg>
      `;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000'); // Cache for 7 days, stale for 30 days
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      operation.info('Sending SVG placeholder as final fallback.');
      operation.end();
      return res.send(svgContent.trim());
    }
    // --- End Generic URL Handling ---
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    operation.error(`Unhandled error in image proxy: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      operation.error(`Unhandled Error Stack: ${error.stack}`);
    }
    operation.end();
    // Ensure response is sent even on unexpected errors
    if (!res.headersSent) {
        return res.status(500).json({
          error: 'Internal server error in image proxy',
          details: errorMessage,
          requestHash: urlHash
        });
    }
  }
});

export default router; 