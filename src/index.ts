#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HybrisClient, HybrisConfig } from './hybris-client.js';

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

// Input validation helpers
function validateString(
  args: Record<string, unknown> | undefined,
  key: string,
  required: true
): string;
function validateString(
  args: Record<string, unknown> | undefined,
  key: string,
  required: false
): string | undefined;
function validateString(
  args: Record<string, unknown> | undefined,
  key: string,
  required: boolean
): string | undefined {
  const value = args?.[key];
  if (required && (value === undefined || value === null)) {
    throw new Error(`${key} is required`);
  }
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }
  return value as string | undefined;
}

function validateNumber(
  args: Record<string, unknown> | undefined,
  key: string,
  opts?: { min?: number; max?: number }
): number | undefined {
  const value = args?.[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number') {
    throw new Error(`${key} must be a number`);
  }
  if (opts?.min !== undefined && value < opts.min) {
    throw new Error(`${key} must be at least ${opts.min}`);
  }
  if (opts?.max !== undefined && value > opts.max) {
    throw new Error(`${key} must be at most ${opts.max}`);
  }
  return value;
}

// Load configuration from environment variables
function getConfig(): HybrisConfig {
  const baseUrl = process.env.HYBRIS_BASE_URL;
  const username = process.env.HYBRIS_USERNAME;
  const password = process.env.HYBRIS_PASSWORD;

  if (!baseUrl || !username || !password) {
    console.error('Missing required environment variables:');
    console.error('  HYBRIS_BASE_URL - Base URL of your Hybris instance (e.g., https://localhost:9002)');
    console.error('  HYBRIS_USERNAME - Admin username');
    console.error('  HYBRIS_PASSWORD - Admin password');
    process.exit(1);
  }

  return {
    baseUrl,
    username,
    password,
    baseSiteId: process.env.HYBRIS_BASE_SITE_ID || 'electronics',
    catalogId: process.env.HYBRIS_CATALOG_ID || 'electronicsProductCatalog',
    catalogVersion: process.env.HYBRIS_CATALOG_VERSION || 'Online',
    hacPath: process.env.HYBRIS_HAC_PATH || '/hac',
  };
}

// Define all available tools
const tools: Tool[] = [
  {
    name: 'search_products',
    description: 'Search for products in the Hybris catalog using a query string',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for products',
        },
        pageSize: {
          type: 'number',
          description: 'Number of results per page (default: 20)',
        },
        currentPage: {
          type: 'number',
          description: 'Page number to retrieve (0-indexed, default: 0)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Get detailed information about a specific product by its code',
    inputSchema: {
      type: 'object',
      properties: {
        productCode: {
          type: 'string',
          description: 'The product code/SKU',
        },
      },
      required: ['productCode'],
    },
  },
  {
    name: 'get_categories',
    description: 'Get the category tree from the product catalog',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_category',
    description: 'Get details about a specific category',
    inputSchema: {
      type: 'object',
      properties: {
        categoryCode: {
          type: 'string',
          description: 'The category code',
        },
      },
      required: ['categoryCode'],
    },
  },
  {
    name: 'get_orders',
    description: 'Get orders for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID or email',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_order',
    description: 'Get details of a specific order',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID or email',
        },
        orderCode: {
          type: 'string',
          description: 'Order code/number',
        },
      },
      required: ['userId', 'orderCode'],
    },
  },
  {
    name: 'flexible_search',
    description: 'Execute a FlexibleSearch query against the Hybris database. Use FlexibleSearch syntax.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'FlexibleSearch query (e.g., "SELECT {pk}, {code} FROM {Product}")',
        },
        maxCount: {
          type: 'number',
          description: 'Maximum number of results (default: 100)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'execute_groovy',
    description: 'Execute a Groovy script in the Hybris scripting console',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'Groovy script to execute',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'import_impex',
    description: 'Import data using ImpEx format',
    inputSchema: {
      type: 'object',
      properties: {
        impexContent: {
          type: 'string',
          description: 'ImpEx content to import',
        },
      },
      required: ['impexContent'],
    },
  },
  {
    name: 'export_impex',
    description: 'Export data to ImpEx format using a FlexibleSearch query',
    inputSchema: {
      type: 'object',
      properties: {
        flexQuery: {
          type: 'string',
          description: 'FlexibleSearch query for data to export',
        },
      },
      required: ['flexQuery'],
    },
  },
  {
    name: 'get_cronjobs',
    description: 'List all cron jobs and their status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'trigger_cronjob',
    description: 'Trigger a cron job to run',
    inputSchema: {
      type: 'object',
      properties: {
        cronJobCode: {
          type: 'string',
          description: 'Code of the cron job to trigger',
        },
      },
      required: ['cronJobCode'],
    },
  },
  {
    name: 'clear_cache',
    description: 'Clear the Hybris cache',
    inputSchema: {
      type: 'object',
      properties: {
        cacheType: {
          type: 'string',
          description: 'Specific cache type to clear (optional, clears all if not specified)',
        },
      },
    },
  },
  {
    name: 'get_system_info',
    description: 'Get Hybris system information and health status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'trigger_catalog_sync',
    description: 'Trigger a catalog synchronization between versions',
    inputSchema: {
      type: 'object',
      properties: {
        catalogId: {
          type: 'string',
          description: 'Catalog ID to sync',
        },
        sourceVersion: {
          type: 'string',
          description: 'Source catalog version (e.g., "Staged")',
        },
        targetVersion: {
          type: 'string',
          description: 'Target catalog version (e.g., "Online")',
        },
      },
      required: ['catalogId', 'sourceVersion', 'targetVersion'],
    },
  },
  {
    name: 'health_check',
    description: 'Check if the Hybris instance is healthy and reachable',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function main() {
  const config = getConfig();
  const hybrisClient = new HybrisClient(config);

  const server = new Server(
    {
      name: 'hybris-mcp',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Graceful shutdown handlers
  const shutdown = async () => {
    console.error('Shutting down Hybris MCP server...');
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_products':
          result = await hybrisClient.searchProducts(
            validateString(args, 'query', true),
            validateNumber(args, 'pageSize', { min: 1, max: 100 }),
            validateNumber(args, 'currentPage', { min: 0 })
          );
          break;

        case 'get_product':
          result = await hybrisClient.getProduct(
            validateString(args, 'productCode', true)
          );
          break;

        case 'get_categories':
          result = await hybrisClient.getCategories();
          break;

        case 'get_category':
          result = await hybrisClient.getCategory(
            validateString(args, 'categoryCode', true)
          );
          break;

        case 'get_orders':
          result = await hybrisClient.getOrders(
            validateString(args, 'userId', true)
          );
          break;

        case 'get_order':
          result = await hybrisClient.getOrder(
            validateString(args, 'userId', true),
            validateString(args, 'orderCode', true)
          );
          break;

        case 'flexible_search':
          result = await hybrisClient.executeFlexibleSearch(
            validateString(args, 'query', true),
            validateNumber(args, 'maxCount', { min: 1, max: 10000 })
          );
          break;

        case 'execute_groovy':
          result = await hybrisClient.executeGroovyScript(
            validateString(args, 'script', true)
          );
          break;

        case 'import_impex':
          result = await hybrisClient.importImpex(
            validateString(args, 'impexContent', true)
          );
          break;

        case 'export_impex':
          result = await hybrisClient.exportImpex(
            validateString(args, 'flexQuery', true)
          );
          break;

        case 'get_cronjobs':
          result = await hybrisClient.getCronJobs();
          break;

        case 'trigger_cronjob':
          result = await hybrisClient.triggerCronJob(
            validateString(args, 'cronJobCode', true)
          );
          break;

        case 'clear_cache':
          result = await hybrisClient.clearCache(
            validateString(args, 'cacheType', false)
          );
          break;

        case 'get_system_info':
          result = await hybrisClient.getSystemInfo();
          break;

        case 'trigger_catalog_sync':
          result = await hybrisClient.triggerCatalogSync(
            validateString(args, 'catalogId', true),
            validateString(args, 'sourceVersion', true),
            validateString(args, 'targetVersion', true)
          );
          break;

        case 'health_check':
          result = await hybrisClient.healthCheck();
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hybris MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
