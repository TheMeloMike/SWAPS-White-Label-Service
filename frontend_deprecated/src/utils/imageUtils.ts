// Define constants directly instead of importing missing modules
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PROD_MODE = process.env.NODE_ENV === 'production';

// Global image URL cache to avoid repeated failures
const imageUrlCache = new Map<string, string>();

// In-memory cache for successful image loads
const successfulImageCache = new Map<string, { url: string, timestamp: number }>();
const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes

// Image preload status cache
const preloadCache = new Map<string, boolean>();

// Track failed images to avoid repeated attempts for known bad URLs
const failedImageUrls = new Set<string>();

/**
 * Fixes common issues with image URLs and provides reliable fallback mechanisms
 * @param imageUrl The original image URL from NFT metadata
 * @param mintAddress Optional NFT mint address to use the backend proxy
 * @returns A fixed URL that should load properly
 */
export const fixImageUrl = (imageUrl: string | undefined, mintAddress?: string): string => {
  // Return from cache if available to avoid redundant processing
  const cacheKey = `${imageUrl}-${mintAddress || ''}`;
  if (imageUrlCache.has(cacheKey)) {
    return imageUrlCache.get(cacheKey)!;
  }

  // If it's a known failed URL and we have the mint address, go directly to proxy
  if (imageUrl && failedImageUrls.has(imageUrl) && mintAddress) {
    console.log(`Using proxy for known failed URL: ${imageUrl}`);
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL || 'http://localhost:3001';
    const endpoint = API_BASE_URL.includes('/api/') ? 'nft/image-proxy' : 'api/nfts/image-proxy';
    const proxyUrl = `${API_BASE_URL}/${endpoint}/${mintAddress}`;
    imageUrlCache.set(cacheKey, proxyUrl);
    return proxyUrl;
  }

  // If no image URL provided or it's explicitly null/undefined, or empty string
  if (!imageUrl || imageUrl.trim() === '') {
    const placeholderText = mintAddress ? 
      (getNFTNameFromAddress(mintAddress) || `NFT ${mintAddress.slice(0, 6)}...`) : 
      'No Image';
    const placeholderUrl = createPlaceholderDataUri(placeholderText, mintAddress || '');
    imageUrlCache.set(cacheKey, placeholderUrl);
    return placeholderUrl;
  }

  // Normalize the URL by trimming
  let normalizedUrl = imageUrl.trim();

  // Don't try to fix data URIs or blob URLs
  if (normalizedUrl.startsWith('data:') || 
      normalizedUrl.startsWith('blob:') || 
      normalizedUrl.startsWith('file:')) {
    return imageUrl;
  }
  
  // Immediately use our own data URI for placeholder URLs
  // This avoids DNS resolution issues with placeholder services
  if (normalizedUrl.includes('placeholder.com') || 
      normalizedUrl.match(/placeholder\.(com|io|net)/) ||
      normalizedUrl.match(/via\.placeholder/) ||
      normalizedUrl.match(/placehold\.it/)) {
    // Extract the text parameter from the placeholder URL if possible
    const textMatch = normalizedUrl.match(/text=([^&]+)/i);
    const placeholderText = textMatch ? 
      decodeURIComponent(textMatch[1]) : 
      (mintAddress ? getNFTNameFromAddress(mintAddress) || `NFT ${mintAddress.slice(0, 6)}...` : 'NFT');
    console.log(`Using local placeholder for ${mintAddress || 'unknown'}: ${placeholderText}`);
    return createDataURIPlaceholder(placeholderText);
  }
  
  // If we have a mint address, always use the backend proxy for reliability
  if (mintAddress) {
    // Always proxy in production, but allow for configuration override
    // This makes the app much more robust against CORS and URL issues
    const shouldUseProxy = PROD_MODE || process.env.NEXT_PUBLIC_ALWAYS_USE_IMAGE_PROXY === 'true';
    
    if (shouldUseProxy) {
      // Get the API base URL from environment variable or use BACKEND_URL
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL || 'http://localhost:3001';
      
      // Determine the correct endpoint path
      const endpoint = API_BASE_URL.includes('/api/') ? 'nft/image-proxy' : 'api/nfts/image-proxy';
      
      // Add collection parameter if available to help with gateway selection
      let proxyUrl = `${API_BASE_URL}/${endpoint}/${mintAddress}`;
      
      // Extract collection from image attributes or from NFT data attributes
      let collection = '';
      
      // Try to get collection from DOM attributes if running in browser
      if (typeof document !== 'undefined') {
        const element = document.querySelector(`[data-mint-address="${mintAddress}"]`);
        if (element) {
          collection = element.getAttribute('data-collection') || '';
        }
      }
      
      // Add collection as a query parameter for better IPFS gateway selection if available
      if (collection) {
        proxyUrl += `?collection=${encodeURIComponent(collection)}`;
      }
      
      imageUrlCache.set(cacheKey, proxyUrl);
      return proxyUrl;
    }
  }
  
  // The remaining code handles all the special cases for different URL formats
  // This runs if we don't use the proxy for all images

  // Fix common URL issues
  
  // 1. Fix Helius CDN URL with embedded URL
  if (normalizedUrl.toLowerCase().includes('cdn-cgi/image/https://')) {
    const ipfsMatch = normalizedUrl.match(/https:\/\/[^\/]+\/cdn-cgi\/image\/(https:\/\/.+)/i);
    if (ipfsMatch && ipfsMatch[1]) {
      normalizedUrl = ipfsMatch[1];
    }
  }
  
  // 2. Fix double slash issue in CDN URLs
  if (normalizedUrl.includes('cdn-cgi/image//')) {
    normalizedUrl = normalizedUrl.replace('cdn-cgi/image//', 'cdn-cgi/image/');
  }
  
  // 3. Directly extract Shadow Drive URLs from daswebs.xyz wrapper
  if (normalizedUrl.includes('daswebs.xyz') && normalizedUrl.includes('shdw-drive.genesysgo.net')) {
    // More aggressive pattern matching - get the storage account and filename directly
    const shadowMatch = normalizedUrl.match(/shdw-drive\.genesysgo\.net\/([^\/\s"']+)\/([^\/\s"']+)/i);
    if (shadowMatch && shadowMatch[1] && shadowMatch[2]) {
      const storageAccount = shadowMatch[1];
      const fileName = shadowMatch[2];
      // Directly construct the Shadow Drive URL
      normalizedUrl = `https://shdw-drive.genesysgo.net/${storageAccount}/${fileName}`;
      console.log('Extracted Shadow Drive URL directly:', normalizedUrl);
    } else {
      // Fallback to simpler extraction if the detailed match fails
      const simpleMatch = normalizedUrl.match(/https?:\/\/shdw-drive\.genesysgo\.net\/[^\/\s"']+\/[^\/\s"']+\.\w+/i);
      if (simpleMatch && simpleMatch[0]) {
        normalizedUrl = simpleMatch[0];
        console.log('Extracted Shadow Drive URL directly (simple match):', normalizedUrl);
      }
    }
  }
  
  // 4. Fix double slash after https:// (except the required one in protocol)
  if (normalizedUrl.includes('https://')) {
    normalizedUrl = normalizedUrl.replace(/(https:\/\/[^\/]+)\/\/+/g, '$1/');
  }
  
  // 5. Fix double slashes in other parts of the URL
  normalizedUrl = normalizedUrl.replace(/([^:])\/\/+/g, '$1/');
  
  // 6. Fix IPFS protocol URLs - use a reliable gateway
  if (normalizedUrl.toLowerCase().startsWith('ipfs://')) {
    const ipfsHash = normalizedUrl.replace(/^ipfs:\/\//i, '');
    const path = ipfsHash.includes('/') ? ipfsHash.substring(ipfsHash.indexOf('/')) : '';
    const cid = ipfsHash.includes('/') ? ipfsHash.substring(0, ipfsHash.indexOf('/')) : ipfsHash;
    
    // Use most reliable gateway based on past performance
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}${path}`;
    imageUrlCache.set(cacheKey, ipfsUrl);
    return ipfsUrl;
  }
  
  // 7. Fix Arweave protocol URLs
  if (normalizedUrl.toLowerCase().startsWith('ar://')) {
    const arweaveUrl = normalizedUrl.replace(/^ar:\/\//i, 'https://arweave.net/');
    imageUrlCache.set(cacheKey, arweaveUrl);
    return arweaveUrl;
  }

  // 8. Handle .ipfs.dweb.link URLs which are often problematic
  if (normalizedUrl.toLowerCase().includes('.ipfs.dweb.link/')) {
    const cidMatch = normalizedUrl.match(/([a-z0-9]+)\.ipfs\.dweb\.link\/(.+)/i);
    if (cidMatch && cidMatch[1] && cidMatch[2]) {
      const cid = cidMatch[1];
      const path = cidMatch[2];
      const ipfsUrl = `https://ipfs.io/ipfs/${cid}/${path}`;
      imageUrlCache.set(cacheKey, ipfsUrl);
      return ipfsUrl;
    }
  }
  
  // 9. For Shadow Drive URLs, always use the backend proxy if we have a mint address
  if (normalizedUrl.toLowerCase().includes('shdw-drive.genesysgo.net') && mintAddress) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL || 'http://localhost:3001';
    const endpoint = API_BASE_URL.includes('/api/') ? 'nft/image-proxy' : 'api/nfts/image-proxy';
    const proxyUrl = `${API_BASE_URL}/${endpoint}/${mintAddress}`;
    imageUrlCache.set(cacheKey, proxyUrl);
    return proxyUrl;
  }
  
  // Default case - just return the normalized URL
  imageUrlCache.set(cacheKey, normalizedUrl);
  return normalizedUrl;
};

/**
 * Try to extract the NFT name from its address using the naming convention
 * This is used for placeholder generation when no name is available
 */
function getNFTNameFromAddress(address: string): string | null {
  // Try to extract collection name and number from mint address data attributes
  // Look for the DOM element with this mint address
  if (typeof document !== 'undefined') {
    const element = document.querySelector(`[data-mint-address="${address}"]`);
    if (element) {
      // Try to get collection and alt text data
      const collection = element.getAttribute('data-collection');
      const altText = element instanceof HTMLImageElement ? element.alt : '';
      
      if (collection && altText) {
        return altText; // Complete NFT name
      } else if (collection) {
        return `${collection} NFT`;
      }
    }
  }
  
  return null;
}

/**
 * Creates a data URI for a placeholder image
 * @param text Text to display in the placeholder
 * @returns Data URI string
 */
export const createDataURIPlaceholder = (text: string): string => {
  // Create a simple SVG with the text
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#303050"/>
      <text x="150" y="150" font-family="Arial, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>
  `;
  
  // Convert to a data URI
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
};

/**
 * Enhanced error handler for image loading failures
 * Implements a cascade of fallback options using different gateways/CDNs
 */
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.target as HTMLImageElement;
  const originalSrc = img.src;
  
  // Skip processing for data URIs - they're already our fallbacks
  if (originalSrc.startsWith('data:')) {
    return;
  }
  
  // Record failure for this URL to avoid using it in the future
  if (originalSrc && originalSrc.startsWith('http')) {
    failedImageUrls.add(originalSrc);
  }
  
  // Track image load attempts to prevent infinite loop
  const attempts = parseInt(img.getAttribute('data-load-attempts') || '0');
  const maxAttempts = 3; // Allow original + 2 fallbacks

  // Get mint address if available
  const mintAddress = img.getAttribute('data-mint-address');
  const collection = img.getAttribute('data-collection') || '';
  const nftName = img.alt || (collection ? `${collection} NFT` : 'NFT'); // Use alt text or collection for placeholder

  // Final fallback condition
  if (attempts >= maxAttempts) {
    console.warn(`Final fallback for ${nftName}: Max attempts reached.`);
    img.src = createDataURIPlaceholder(nftName);
    return;
  }
  
  // Update attempt counter
  img.setAttribute('data-load-attempts', (attempts + 1).toString());
  console.warn(`Image load error (attempt ${attempts + 1}/${maxAttempts}): ${originalSrc}`);

  // For placeholder URLs that fail, go straight to data URI
  if (originalSrc.includes('placeholder.com') || 
      originalSrc.match(/placeholder\.(com|io|net)/) ||
      originalSrc.match(/via\.placeholder/) ||
      originalSrc.match(/placehold\.it/)) {
    console.warn(`Placeholder URL failed, using data URI instead: ${originalSrc}`);
    img.src = createDataURIPlaceholder(nftName);
    // Mark attempts as maxed out to prevent further loops
    img.setAttribute('data-load-attempts', maxAttempts.toString());
    return;
  }

  // Try using the image proxy directly if we have a mint address
  // This is often the most reliable approach
  if (mintAddress) {
    // If we're already using the proxy and it failed, go to placeholder
    if (originalSrc.includes('/api/nfts/image-proxy/') || 
        originalSrc.includes('/nft/image-proxy/')) {
      console.warn(`Backend proxy already failed for ${mintAddress}, using placeholder`);
      img.src = createDataURIPlaceholder(nftName);
      // Mark attempts as maxed out to prevent further loops
      img.setAttribute('data-load-attempts', maxAttempts.toString());
      return;
    }
    
    // Use the backend proxy with a cache buster
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL || 'http://localhost:3001';
    const endpoint = API_BASE_URL.includes('/api/') ? 'nft/image-proxy' : 'api/nfts/image-proxy';
    const cacheBuster = Date.now() + Math.floor(Math.random() * 5000);
    const proxyUrl = `${API_BASE_URL}/${endpoint}/${mintAddress}?cb=${cacheBuster}`;
    
    img.src = proxyUrl;
    return;
  }
  
  // If we got here, we don't have a mint address - try some general fallbacks
  
  // Default to placeholder
  img.src = createDataURIPlaceholder(nftName);
};

/**
 * Preload NFT images by creating image objects in memory
 * This helps improve the perceived loading speed for users
 * @param mintAddresses Array of NFT mint addresses to preload
 */
export const preloadNFTImages = (mintAddresses: string[]) => {
  if (typeof window === 'undefined') return; // Only run in browser

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  // Limit to 10 preloads at a time to avoid overwhelming the browser
  const addressesToPreload = mintAddresses.slice(0, 10);
  
  console.log(`Preloading ${addressesToPreload.length} NFT images`);
  
  addressesToPreload.forEach(mintAddress => {
    // Skip if we already have a successful load cached
    if (successfulImageCache.has(mintAddress)) {
      return;
    }
    
    const imageUrl = `${API_BASE_URL}/api/nfts/image-proxy/${mintAddress}`;
    const img = new Image();
    
    img.onload = () => {
      // Cache the successful load
      successfulImageCache.set(mintAddress, { 
        url: imageUrl, 
        timestamp: Date.now() 
      });
      console.log(`Preloaded image for ${mintAddress}`);
    };
    
    img.onerror = () => {
      console.warn(`Failed to preload image for ${mintAddress}`);
    };
    
    // Start the load
    img.src = imageUrl;
  });
};

/**
 * Tracks NFT image loading events for debugging and successful load caching
 */
export const trackNFTImageLoading = () => {
  // Only run in browser environment
  if (typeof window === 'undefined') return;
  
  // Use MutationObserver to detect new NFT images being added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            // Look for NFT images
            const images = element.querySelectorAll('img[data-mint-address]');
            
            const newAddresses: string[] = [];
            
            images.forEach((img) => {
              const mintAddress = img.getAttribute('data-mint-address');
              if (mintAddress) {
                newAddresses.push(mintAddress);
              }
              
              if (!img.hasAttribute('data-tracking-added')) {
                img.setAttribute('data-tracking-added', 'true');
                
                // Track successful loads
                img.addEventListener('load', () => {
                  const mintAddress = img.getAttribute('data-mint-address') || 'unknown';
                  const src = img.getAttribute('src') || 'unknown';
                  
                  // If there's a mint address and this isn't a placeholder, cache the success
                  if (mintAddress !== 'unknown' && src !== 'unknown' && !src.startsWith('data:')) {
                    // Store in our successful load cache
                    successfulImageCache.set(mintAddress, {
                      url: src,
                      timestamp: Date.now()
                    });
                    
                    console.log(`NFT image loaded successfully:`, {
                      mintAddress,
                      source: src
                    });
                  }
                });
                
                // Track failures (most will be caught by handleImageError)
                img.addEventListener('error', (event) => {
                  // Prevent the error handler from running on our data URI placeholders
                  const src = img.getAttribute('src') || '';
                  if (src.startsWith('data:image/svg+xml')) {
                    // Don't log errors for our own fallback images
                    return;
                  }
                  
                  const mintAddress = img.getAttribute('data-mint-address') || 'unknown';
                  
                  // Only log if we have meaningful data and not on placeholder images
                  if (mintAddress !== 'unknown' && src && !src.includes('placeholder')) {
                    console.warn(`NFT image load error:`, {
                      mintAddress,
                      source: src.substring(0, 100) // Limit long URLs in console
                    });
                  }
                });
              }
            });
            
            // Preload newly discovered NFT images
            if (newAddresses.length > 0) {
              // Use requestIdleCallback to avoid impacting performance
              if (window.requestIdleCallback) {
                window.requestIdleCallback(() => preloadNFTImages(newAddresses));
              } else {
                // Fallback to setTimeout for browsers without requestIdleCallback
                setTimeout(() => preloadNFTImages(newAddresses), 1000);
              }
            }
          }
        });
      }
    });
  });
  
  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
};

// Add cleanup of expired cache entries
const cleanupExpiredCacheEntries = () => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  let expiredCount = 0;
  
  successfulImageCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_EXPIRY) {
      successfulImageCache.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    console.log(`Cleaned up ${expiredCount} expired image cache entries`);
  }
};

// Initialize tracking and cache cleanup when this module is imported
if (typeof window !== 'undefined') {
  // Initialize tracking
  setTimeout(() => {
    trackNFTImageLoading();
  }, 1000); // Delay to ensure DOM is fully loaded
  
  // Set up periodic cache cleanup
  setInterval(cleanupExpiredCacheEntries, 1000 * 60 * 5); // Every 5 minutes
}

/**
 * Creates an SVG data URI placeholder for failed images
 */
export const createPlaceholderDataUri = (text: string, id: string = ''): string => {
  // Sanitize text to prevent XSS in SVG
  const sanitizedText = text.replace(/[<>&'"]/g, c => {
    return {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    }[c] || c;
  });

  // Create shortened ID for the placeholder
  const shortId = id ? id.substring(0, 4) + '...' : '';
  
  // Create an SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#303050"/>
      <text x="150" y="140" font-family="Arial, sans-serif" font-size="20" fill="#FFFFFF" text-anchor="middle">${sanitizedText}</text>
      ${shortId ? `<text x="150" y="170" font-family="Arial, sans-serif" font-size="14" fill="#CCCCCC" text-anchor="middle">${shortId}</text>` : ''}
    </svg>
  `;

  // Convert to data URI
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
};

/**
 * Preloads images to improve perceived performance
 * @param mintAddresses Array of mint addresses to preload
 * @param priority Whether to use high priority fetch
 */
export const preloadImages = (mintAddresses: string[], priority: boolean = false): void => {
  if (!mintAddresses || mintAddresses.length === 0) return;
  
  // Schedule preloading after a short delay to not block other important resources
  setTimeout(() => {
    mintAddresses.forEach(mintAddress => {
      // Skip if already preloaded
      if (preloadCache.has(mintAddress)) return;
      
      // Mark as preloaded to prevent duplicate work
      preloadCache.set(mintAddress, true);
      
      const proxyUrl = `${BACKEND_URL}/api/nft/image-proxy/${mintAddress}`;
      
      if ('requestIdleCallback' in window) {
        // Use requestIdleCallback for lower priority preloading
        (window as any).requestIdleCallback(() => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.as = 'image';
          link.href = proxyUrl;
          document.head.appendChild(link);
        }, { timeout: 5000 });
      } else if (priority) {
        // For high priority, use link preload
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = proxyUrl;
        document.head.appendChild(link);
      } else {
        // Fallback to image object preloading
        const img = new Image();
        img.src = proxyUrl;
      }
    });
  }, priority ? 0 : 100);
};

/**
 * Clear image caches - useful when refreshing data
 */
export const clearImageCaches = (): void => {
  imageUrlCache.clear();
  // Don't clear preload cache as those resources may still be useful
};

export default {
  fixImageUrl,
  createPlaceholderDataUri,
  handleImageError,
  preloadImages,
  clearImageCaches
};
