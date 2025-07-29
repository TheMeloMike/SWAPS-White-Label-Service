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
const failedImageUrls = new Map<string, number>(); // Store URL and timestamp of failure
const FAILED_URL_RETRY_TIMEOUT = 1000 * 60 * 2; // Reduced to 2 minutes to allow more retries

// Import any required modules for type check in case file is empty
import React from 'react';

// Fallback image for when loading fails
export const DEFAULT_IMAGE_PLACEHOLDER = '/images/placeholder.png';
export const SVG_PLACEHOLDER_PREFIX = 'data:image/svg+xml'; // To identify our SVG placeholders

/**
 * Create a data URI for a placeholder image with text
 * @param text Text to display on placeholder
 * @param id Optional identifier for more uniqueness
 * @returns Data URI string
 */
export const createDataURIPlaceholder = (text: string = 'NFT', id: string = ''): string => {
  // Generate color based on text for consistency
  const hash = Array.from(text + id).reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  const hue = hash % 360;
  const bgColor = `hsl(${hue}, 55%, 25%)`; // Slightly more saturated for better visual
  const textColor = `hsl(${hue}, 20%, 90%)`; // Brighter text for better contrast
  const borderColor = `hsl(${hue}, 60%, 40%)`; // Brighter border

  // Sanitize text to prevent XSS in SVG
  const sanitizedText = (text || 'NFT').replace(/[<>&'"]/g, c => {
    return ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    }[c] || c);
  });
  
  const shortIdText = id ? id.substring(0,6) + (id.length > 6 ? '...' : '') : '';

  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColor}" stop-opacity="1" />
          <stop offset="100%" stop-color="hsl(${(hue + 30) % 360}, 55%, 20%)" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      <rect x="3" y="3" width="194" height="194" fill="none" stroke="${borderColor}" stroke-width="2" rx="10" ry="10" />
      <text 
        x="50%" 
        y="${shortIdText ? '45%' : '50%'}"
        font-family="Roboto Mono, monospace" 
        font-size="18" 
        fill="${textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-weight="500"
      >
        ${sanitizedText.slice(0, 15)}${sanitizedText.length > 15 ? '...' : ''}
      </text>
      ${shortIdText ? `<text x="50%" y="60%" font-family="Roboto Mono, monospace" font-size="12" fill="${textColor}99" text-anchor="middle" dominant-baseline="middle">${shortIdText}</text>` : ''}
    </svg>
  `;
  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
};

/**
 * Fixes issues with IPFS and Arweave URLs by converting them to HTTP gateways
 * or suggests using the backend proxy for complex cases.
 * @param url Original URL string
 * @param mintAddress NFT mint address, used for proxy and placeholder generation
 * @returns Fixed URL string or a placeholder
 */
export const fixImageUrl = (url?: string | null, mintAddress?: string): string => {
  const originalUrl = url;

  // Check cache for successfully loaded URL first
  if (mintAddress && successfulImageCache.has(mintAddress)) {
    const cached = successfulImageCache.get(mintAddress)!;
    if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
      // console.log(`Using cached successful image for ${mintAddress}: ${cached.url}`);
      return cached.url;
    } else {
      successfulImageCache.delete(mintAddress); // Cache expired
    }
  }

  // If URL has previously failed and timeout hasn't passed, return placeholder immediately
  // But only do this if we don't have a mint address to try other alternatives
  if (originalUrl && failedImageUrls.has(originalUrl) && !mintAddress) {
    const failureTimestamp = failedImageUrls.get(originalUrl)!;
    if (Date.now() - failureTimestamp < FAILED_URL_RETRY_TIMEOUT) {
      // console.warn(`Returning placeholder for previously failed URL (timeout not expired): ${originalUrl}`);
      return createDataURIPlaceholder('Error', undefined);
    } else {
      failedImageUrls.delete(originalUrl); // Retry timeout expired
    }
  }
  
  if (!url) {
    // console.warn('fixImageUrl: URL is null or empty, returning placeholder.');
    return createDataURIPlaceholder(mintAddress || 'No Image', mintAddress);
  }

  // Try to fix known URL patterns first, without immediately using the proxy
  try {
    // Handle IPFS and Arweave URLs directly if possible
    if (url.startsWith('ipfs://')) {
      url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (url.startsWith('ar://')) {
      url = url.replace('ar://', 'https://arweave.net/');
    }

    // If we have a mint address, ALSO provide the proxy URL as a fallback
    if (mintAddress) {
      // Use the proxy as the primary source for NFTs with mintAddress
      return `${BACKEND_URL}/api/nfts/image-proxy/${mintAddress}`;
    }

    // If URL is already a full HTTP/HTTPS URL and no mintAddress, return it directly
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Handle relative URLs - this should ideally be avoided for NFT metadata
    if (url.startsWith('/')) {
      // console.warn(`fixImageUrl: Relative URL "${url}" found. This might not work SSR.`);
      return `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`;
    }
    
    // If URL looks like a CID, use IPFS gateway
    if ((url.length === 46 || url.length === 59) && !url.includes('.')) {
        return `https://ipfs.io/ipfs/${url}`;
    }

    // Return the transformed URL, or a placeholder if no URL was provided
    return url || createDataURIPlaceholder('No URL', undefined);

  } catch (error) {
    console.warn('Error in fixImageUrl for URL:', originalUrl, error);
    return mintAddress ? 
              `${BACKEND_URL}/api/nfts/image-proxy/${mintAddress}` : 
      createDataURIPlaceholder('Error', undefined);
  }
};

/**
 * Handles image loading errors by setting a final placeholder.
 * This function is designed to be used as an onError handler for <img> tags.
 * @param event Image error event
 * @param originalSrc The src that failed, to add to failedImageUrls
 * @param nftName Optional name for placeholder text
 * @param mintAddress Optional mint for placeholder text and caching
 */
export const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  originalSrc?: string,
  nftName?: string,
  mintAddress?: string
): void => {
  const imgElement = event.currentTarget;

  // Prevent error loops if the placeholder itself fails, though SVG data URIs shouldn't.
  if (imgElement.src.startsWith(SVG_PLACEHOLDER_PREFIX) || imgElement.src.endsWith(DEFAULT_IMAGE_PLACEHOLDER)) {
    return;
  }
  
  // console.warn(`Image load failed for: ${originalSrc || imgElement.src}`);

  // Add to failed URLs list to prevent immediate retries of the same bad URL by fixImageUrl
  if (originalSrc && !originalSrc.startsWith(SVG_PLACEHOLDER_PREFIX)) {
    failedImageUrls.set(originalSrc, Date.now());
    // Removed pattern matching as it's causing too many false negatives
  }
  
  // Also mark the current imgElement.src as failed if different and not a placeholder
  if (imgElement.src && !imgElement.src.startsWith(SVG_PLACEHOLDER_PREFIX) && imgElement.src !== originalSrc) {
    failedImageUrls.set(imgElement.src, Date.now());
    // Removed pattern matching as it's causing too many false negatives
  }

  // Try one additional approach if we have a mintAddress - use proxy with forced refresh
  if (mintAddress && !imgElement.src.includes('/api/nfts/image-proxy/')) {
    const proxyUrl = `${BACKEND_URL}/api/nfts/image-proxy/${mintAddress}?refresh=true&t=${Date.now()}`;
    imgElement.src = proxyUrl;
    return;
  }
  
  // If we already tried the proxy or don't have a mintAddress, use a placeholder
  const placeholderText = nftName || (mintAddress ? mintAddress.substring(0, 6) + '...' : 'Error');
  imgElement.src = createDataURIPlaceholder(placeholderText, mintAddress);
  imgElement.alt = `${nftName || 'NFT'} (Error Loading)`;
};

/**
 * Preload NFT images by creating image objects in memory
 * This helps improve the perceived loading speed for users
 * @param mintAddresses Array of NFT mint addresses to preload
 */
export const preloadNFTImages = (mintAddresses: string[]) => {
  if (typeof window === 'undefined') return; // Only run in browser
  
  // Limit to 10 preloads at a time to avoid overwhelming the browser
  const addressesToPreload = mintAddresses.slice(0, 10);
  
  // console.log(`Preloading ${addressesToPreload.length} NFT images`);
  
  addressesToPreload.forEach(mintAddress => {
    if (preloadCache.has(mintAddress) || successfulImageCache.has(mintAddress)) {
      return;
    }
    preloadCache.set(mintAddress, true); // Mark as attempt to preload
    
    // Use fixImageUrl to get the best URL, which might be the proxy
    const imageUrl = fixImageUrl(undefined, mintAddress); // Pass undefined for URL to force proxy via mintAddress if possible
    
    if (imageUrl.startsWith(SVG_PLACEHOLDER_PREFIX) || imageUrl.endsWith(DEFAULT_IMAGE_PLACEHOLDER)) { // Don't preload placeholders
        // console.log(`Skipping preload for placeholder: ${mintAddress}`);
        return;
    }

    const img = new Image();
    
    img.onload = () => {
      successfulImageCache.set(mintAddress, { 
        url: img.src, // Use img.src as it might have resolved redirects
        timestamp: Date.now() 
      });
      // console.log(`Preloaded image for ${mintAddress} from ${img.src}`);
    };
    
    img.onerror = () => {
      // console.warn(`Failed to preload image for ${mintAddress} from ${imageUrl}`);
      // Add to failedImageUrls so fixImageUrl can return placeholder quickly next time
      failedImageUrls.set(imageUrl, Date.now());
    };
    
    img.src = imageUrl;
  });
};

/**
 * Tracks NFT image loading events for debugging and successful load caching
 */
export const trackNFTImageLoading = () => {
  if (typeof window === 'undefined') return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { 
            const element = node as Element;
            const images = element.querySelectorAll('img[data-mint-address]');
            
            const newAddressesToPreload: string[] = [];
            
            images.forEach((imgEl) => {
              const img = imgEl as HTMLImageElement;
              const mintAddress = img.getAttribute('data-mint-address');
              const nftName = img.alt || (mintAddress ? `NFT ${mintAddress.slice(0,6)}...` : 'NFT');
              const originalSrc = img.getAttribute('src'); // Capture src before error handler might change it

              if (mintAddress && !preloadCache.has(mintAddress) && !successfulImageCache.has(mintAddress)) {
                newAddressesToPreload.push(mintAddress);
              }
              
              if (!img.hasAttribute('data-tracking-added')) {
                img.setAttribute('data-tracking-added', 'true');
                
                img.addEventListener('load', () => {
                  const loadedSrc = img.getAttribute('src');
                  if (mintAddress && loadedSrc && !loadedSrc.startsWith(SVG_PLACEHOLDER_PREFIX) && !loadedSrc.endsWith(DEFAULT_IMAGE_PLACEHOLDER)) {
                    successfulImageCache.set(mintAddress, {
                      url: loadedSrc,
                      timestamp: Date.now()
                    });
                    // console.log(`NFT image loaded successfully (tracked): ${mintAddress} from ${loadedSrc}`);
                  }
                });
                
                img.addEventListener('error', (event) => {
                  // Pass originalSrc, nftName, and mintAddress to handleImageError
                  // Create a simplified event object that handleImageError can use
                  const syntheticEventMock = {
                    currentTarget: event.currentTarget as HTMLImageElement,
                    // Add other properties if handleImageError uses them, though it primarily uses currentTarget
                  } as React.SyntheticEvent<HTMLImageElement, Event>;
                  handleImageError(syntheticEventMock, originalSrc || undefined, nftName, mintAddress || undefined);
                });
              }
            });
            
            if (newAddressesToPreload.length > 0) {
              if (window.requestIdleCallback) {
                window.requestIdleCallback(() => preloadNFTImages(newAddressesToPreload), { timeout: 2000 });
              } else {
                setTimeout(() => preloadNFTImages(newAddressesToPreload), 500);
              }
            }
          }
        });
      }
    });
  });
  
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

  failedImageUrls.forEach((timestamp, key) => {
    if (now - timestamp > FAILED_URL_RETRY_TIMEOUT) {
        failedImageUrls.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    // console.log(`Cleaned up ${expiredCount} expired image cache entries (successful & failed)`);
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
 * Preloads images to improve perceived performance
 * @param mintAddresses Array of mint addresses to preload
 * @param priority Whether to use high priority fetch
 */
export const preloadImages = (mintAddresses: string[], priority: boolean = false): void => {
  if (!mintAddresses || mintAddresses.length === 0) return;
  
  // Schedule preloading after a short delay to not block other important resources
  setTimeout(() => {
    mintAddresses.forEach(mintAddress => {
      // Skip if already preloaded or successfully loaded
      if (preloadCache.has(mintAddress) || successfulImageCache.has(mintAddress)) return;
      
      // Mark as preloaded to prevent duplicate work
      preloadCache.set(mintAddress, true);
      
      const proxyUrl = `${BACKEND_URL}/api/nfts/image-proxy/${mintAddress}`;
      
      // Only attempt to preload if it's not already a placeholder
      if (proxyUrl.startsWith(SVG_PLACEHOLDER_PREFIX) || proxyUrl.endsWith(DEFAULT_IMAGE_PLACEHOLDER)) return;
      
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
        img.onload = () => { successfulImageCache.set(mintAddress, { url: img.src, timestamp: Date.now() }); };
        img.onerror = () => { failedImageUrls.set(proxyUrl, Date.now()); };
      }
    });
  }, priority ? 0 : 100);
};

/**
 * Clear image caches - useful when refreshing data
 */
export const clearImageCaches = (): void => {
  imageUrlCache.clear();
  successfulImageCache.clear();
  failedImageUrls.clear();
  preloadCache.clear();
  // Remove pattern clearing since we removed patterns
  console.log('All image caches cleared.');
};

export default {
  fixImageUrl,
  createDataURIPlaceholder,
  handleImageError,
  preloadNFTImages,
  preloadImages,
  clearImageCaches
};
