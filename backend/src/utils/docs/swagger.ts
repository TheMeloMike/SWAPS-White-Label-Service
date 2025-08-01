/**
 * OpenAPI/Swagger Documentation for SWAPS White Label API
 * Generates comprehensive API documentation for enterprise clients
 */

import { Options } from 'swagger-jsdoc';

export const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SWAPS White Label API',
    version: '1.0.0',
    description: `
# SWAPS White Label API

The SWAPS White Label API enables partners to integrate advanced multi-party NFT trading capabilities into their platforms. 

## Key Features
- **Multi-party Bartering**: Discover complex trade loops (A→B→C→A) that increase liquidity
- **Blockchain Agnostic**: Support for Ethereum, Solana, Polygon, and custom platforms
- **Real-time Discovery**: Immediate trade loop identification upon NFT/want submission
- **Enterprise Security**: API key authentication, rate limiting, tenant isolation

## Getting Started
1. Contact us to obtain API credentials
2. Use the tenant management endpoints to configure your integration
3. Submit NFT inventory and user wants via our ingestion endpoints
4. Retrieve discovered trade loops via the trades endpoint

## Support
- Documentation: https://desert-adjustment-111.notion.site/SWAPS-White-Label-Documentation-2409b1fc08278068a469c60e33a105d8
- Technical Support: Available through your enterprise agreement
    `,
    contact: {
      name: 'SWAPS API Support',
      url: 'https://desert-adjustment-111.notion.site/SWAPS-White-Label-Documentation-2409b1fc08278068a469c60e33a105d8'
    },
    license: {
      name: 'Commercial License',
      url: 'https://example.com/license'
    }
  },
  servers: [
    {
      url: 'https://swaps-93hu.onrender.com/api/v1',
      description: 'Production API Server'
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development Server'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for tenant authentication. Format: swaps_[64-character-key]'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Legacy bearer token authentication (deprecated, use X-API-Key)'
      }
    },
    schemas: {
      AbstractNFT: {
        type: 'object',
        required: ['id', 'metadata', 'ownership'],
        properties: {
          id: {
            type: 'string',
            description: 'Platform-agnostic unique identifier for the NFT',
            example: 'nft-ethereum-0x123...abc'
          },
          metadata: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
                description: 'Human-readable name of the NFT',
                example: 'CryptoPunk #1234'
              },
              description: {
                type: 'string',
                description: 'Description of the NFT',
                example: 'A rare CryptoPunk with alien attributes'
              },
              image: {
                type: 'string',
                format: 'uri',
                description: 'URL to the NFT image',
                example: 'https://example.com/nft-image.png'
              },
              attributes: {
                type: 'object',
                description: 'NFT attributes/traits',
                example: { rarity: 'legendary', color: 'blue' }
              }
            }
          },
          ownership: {
            type: 'object',
            required: ['ownerId'],
            properties: {
              ownerId: {
                type: 'string',
                description: 'Platform-agnostic owner identifier',
                example: 'user-123'
              },
              acquiredAt: {
                type: 'string',
                format: 'date-time',
                description: 'When the NFT was acquired',
                example: '2024-01-15T10:30:00Z'
              }
            }
          },
          valuation: {
            type: 'object',
            properties: {
              estimatedValue: {
                type: 'number',
                description: 'Estimated value of the NFT',
                example: 1.5
              },
              currency: {
                type: 'string',
                description: 'Currency for the valuation',
                example: 'SOL'
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score for the valuation (0-1)',
                example: 0.85
              }
            }
          },
          collection: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Collection identifier',
                example: 'cryptopunks'
              },
              name: {
                type: 'string',
                description: 'Collection name',
                example: 'CryptoPunks'
              },
              family: {
                type: 'string',
                description: 'Collection family/creator',
                example: 'Larva Labs'
              }
            }
          },
          platformData: {
            type: 'object',
            description: 'Platform-specific data (blockchain addresses, etc.)',
            example: {
              contractAddress: '0x123...abc',
              tokenId: '1234',
              blockchain: 'ethereum'
            }
          }
        }
      },
      TradeLoop: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the trade loop',
            example: 'loop-abc123'
          },
          participants: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of wallet/user IDs participating in the trade',
            example: ['user-1', 'user-2', 'user-3']
          },
          nfts: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of NFT IDs involved in the trade',
            example: ['nft-1', 'nft-2', 'nft-3']
          },
          tradeSequence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                nftId: { type: 'string' }
              }
            },
            description: 'Sequence of trades to execute',
            example: [
              { from: 'user-1', to: 'user-2', nftId: 'nft-1' },
              { from: 'user-2', to: 'user-3', nftId: 'nft-2' },
              { from: 'user-3', to: 'user-1', nftId: 'nft-3' }
            ]
          },
          qualityScore: {
            type: 'number',
            description: 'Quality score for the trade loop (0-1)',
            example: 0.92
          },
          fairnessMetrics: {
            type: 'object',
            description: 'Fairness analysis for the trade',
            properties: {
              valueVariance: { type: 'number' },
              rarityBalance: { type: 'number' },
              collectionDiversity: { type: 'number' }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the trade loop was discovered',
            example: '2024-01-15T10:30:00Z'
          }
        }
      },
      TenantStatus: {
        type: 'object',
        properties: {
          tenantId: {
            type: 'string',
            description: 'Tenant identifier',
            example: 'tenant-123'
          },
          name: {
            type: 'string',
            description: 'Tenant name',
            example: 'Courtyard Trading Platform'
          },
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'trial'],
            description: 'Current tenant status'
          },
          usage: {
            type: 'object',
            properties: {
              nftsSubmitted: { type: 'integer' },
              wantsSubmitted: { type: 'integer' },
              tradesDiscovered: { type: 'integer' },
              apiCallsToday: { type: 'integer' }
            }
          },
          limits: {
            type: 'object',
            properties: {
              maxNFTsPerWallet: { type: 'integer' },
              maxWantsPerWallet: { type: 'integer' },
              requestsPerMinute: { type: 'integer' }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type or category'
          },
          message: {
            type: 'string',
            description: 'Human-readable error message'
          },
          code: {
            type: 'string',
            description: 'Machine-readable error code'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'When the error occurred'
          }
        }
      }
    }
  },
  security: [
    { ApiKeyAuth: [] }
  ]
};

export const swaggerOptions: Options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

/**
 * Path definitions for each endpoint
 */
export const apiPaths = {
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check if the API is operational',
      security: [],
      responses: {
        200: {
          description: 'API is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  message: { type: 'string', example: 'SWAPS White Label API is healthy' },
                  timestamp: { type: 'string', format: 'date-time' },
                  service: { type: 'string', example: 'SWAPS White Label API' },
                  version: { type: 'string', example: '1.0.0' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/inventory/submit': {
    post: {
      tags: ['NFT Management'],
      summary: 'Submit NFT inventory',
      description: 'Submit NFTs owned by a wallet for trade discovery',
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletId', 'nfts'],
              properties: {
                walletId: {
                  type: 'string',
                  description: 'Platform-agnostic wallet/user identifier',
                  example: 'user-123'
                },
                nfts: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AbstractNFT' },
                  description: 'Array of NFTs owned by the wallet'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'NFTs processed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  nftsProcessed: { type: 'integer', example: 5 },
                  newLoopsDiscovered: { type: 'integer', example: 2 },
                  loops: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TradeLoop' }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request format or NFT data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        401: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  },
  '/wants/submit': {
    post: {
      tags: ['Trading Preferences'],
      summary: 'Submit wanted NFTs',
      description: 'Submit NFTs that a wallet wants to acquire',
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletId', 'wantedNFTs'],
              properties: {
                walletId: {
                  type: 'string',
                  description: 'Platform-agnostic wallet/user identifier',
                  example: 'user-123'
                },
                wantedNFTs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of NFT IDs that the wallet wants',
                  example: ['nft-456', 'nft-789']
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wants processed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  wantsProcessed: { type: 'integer', example: 3 },
                  newLoopsDiscovered: { type: 'integer', example: 1 },
                  loops: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TradeLoop' }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request or too many wants',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  },
  '/trades/active': {
    get: {
      tags: ['Trade Discovery'],
      summary: 'Get active trade loops',
      description: 'Retrieve all active trade loops for the tenant',
      security: [{ ApiKeyAuth: [] }],
      parameters: [
        {
          name: 'walletId',
          in: 'query',
          description: 'Filter trades for a specific wallet',
          schema: { type: 'string' },
          example: 'user-123'
        },
        {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of trades to return',
          schema: { type: 'integer', default: 100, maximum: 1000 },
          example: 50
        }
      ],
      responses: {
        200: {
          description: 'Active trades retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  trades: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TradeLoop' }
                  },
                  totalCount: { type: 'integer', example: 25 },
                  tenantId: { type: 'string', example: 'tenant-123' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/status': {
    get: {
      tags: ['Tenant Management'],
      summary: 'Get tenant status',
      description: 'Retrieve current tenant status and usage statistics',
      security: [{ ApiKeyAuth: [] }],
      responses: {
        200: {
          description: 'Tenant status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  tenant: { $ref: '#/components/schemas/TenantStatus' }
                }
              }
            }
          }
        }
      }
    }
  }
}; 