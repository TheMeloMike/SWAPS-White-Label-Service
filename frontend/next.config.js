/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  images: {
    domains: [
      'nftstorage.link', 
      'arweave.net', 
      'ipfs.io',
      'bafybeiayniocuajgugm24b5evtvxcgjmi4gyjwodedxhqyqe3gsj5qmopi.ipfs.dweb.link',
      'dweb.link',
      'ipfs.dweb.link',
      'we-assets.pinit.io',
      'shdw-drive.genesysgo.net',
      'cdn1849274925.com',
      'solana-cdn.com',
      'arweave.cache.io',
      'metadata.degods.com',
      'metadata.y00ts.com',
      'madlads.s3.us-east-2.amazonaws.com',
      'gateway.pinata.cloud',
      'pinata.cloud',
      'pinata-cdn.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ipfs.dweb.link',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.nftstorage.link',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.w3s.link',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.cf-ipfs.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.pinata.cloud',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'cdn**.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.solana.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'metadata.**.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.arweave.net',
        pathname: '**',
      }
    ],
    unoptimized: process.env.NODE_ENV === 'development',
    minimumCacheTTL: 600
  },
  webpack: (config, { dev, isServer }) => {
    // Configure path aliases to match tsconfig.json
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    
    // Add environment-specific optimizations
    if (!dev && !isServer) {
      // Production client-side optimizations
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      };
    }
    
    return config;
  }
}

module.exports = nextConfig
