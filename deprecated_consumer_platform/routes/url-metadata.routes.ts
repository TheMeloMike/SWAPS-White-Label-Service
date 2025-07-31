import { Router } from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const router = Router();

interface URLMetadata {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
  favicon: string;
}

/**
 * Fetch URL metadata (Open Graph tags, title, etc.)
 * This bypasses CORS restrictions by running server-side
 */
router.get('/metadata', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Security: Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
    }

    console.log(`Fetching metadata for: ${url}`);

    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SWAPS-Bot/1.0; +https://swaps.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata using Open Graph tags and fallbacks
    const metadata: URLMetadata = {
      title: 
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() ||
        validUrl.hostname,
      
      description:
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '',
      
      image:
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('meta[name="twitter:image:src"]').attr('content') ||
        '',
      
      siteName:
        $('meta[property="og:site_name"]').attr('content') ||
        validUrl.hostname.replace('www.', ''),
      
      url: url,
      
      favicon:
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') ||
        `${validUrl.protocol}//${validUrl.hostname}/favicon.ico`
    };

    // Resolve relative URLs to absolute URLs
    if (metadata.image && !metadata.image.startsWith('http')) {
      metadata.image = new URL(metadata.image, url).toString();
    }
    
    if (metadata.favicon && !metadata.favicon.startsWith('http')) {
      metadata.favicon = new URL(metadata.favicon, url).toString();
    }

    // Clean up text content
    metadata.title = metadata.title.trim();
    metadata.description = metadata.description.trim();

    console.log(`Successfully fetched metadata for: ${url}`, {
      title: metadata.title,
      hasImage: !!metadata.image,
      hasFavicon: !!metadata.favicon
    });

    res.json({ success: true, metadata });

  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    
    // Return a fallback response instead of an error
    const fallbackUrl = req.query.url as string;
    const domain = new URL(fallbackUrl).hostname;
    
    res.json({
      success: false,
      metadata: {
        title: domain,
        description: `Visit ${domain}`,
        image: '',
        siteName: domain,
        url: fallbackUrl,
        favicon: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 