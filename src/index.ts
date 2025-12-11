#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HybrisClient, HybrisConfig } from './hybris-client.js';

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
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

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
            args?.query as string,
            args?.pageSize as number,
            args?.currentPage as number
          );
          break;

        case 'get_product':
          result = await hybrisClient.getProduct(args?.productCode as string);
          break;

        case 'get_categories':
          result = await hybrisClient.getCategories();
          break;

        case 'get_category':
          result = await hybrisClient.getCategory(args?.categoryCode as string);
          break;

        case 'get_orders':
          result = await hybrisClient.getOrders(args?.userId as string);
          break;

        case 'get_order':
          result = await hybrisClient.getOrder(
            args?.userId as string,
            args?.orderCode as string
          );
          break;

        case 'flexible_search':
          result = await hybrisClient.executeFlexibleSearch(
            args?.query as string,
            args?.maxCount as number
          );
          break;

        case 'execute_groovy':
          result = await hybrisClient.executeGroovyScript(args?.script as string);
          break;

        case 'import_impex':
          result = await hybrisClient.importImpex(args?.impexContent as string);
          break;

        case 'export_impex':
          result = await hybrisClient.exportImpex(args?.flexQuery as string);
          break;

        case 'get_cronjobs':
          result = await hybrisClient.getCronJobs();
          break;

        case 'trigger_cronjob':
          result = await hybrisClient.triggerCronJob(args?.cronJobCode as string);
          break;

        case 'clear_cache':
          result = await hybrisClient.clearCache(args?.cacheType as string | undefined);
          break;

        case 'get_system_info':
          result = await hybrisClient.getSystemInfo();
          break;

        case 'trigger_catalog_sync':
          result = await hybrisClient.triggerCatalogSync(
            args?.catalogId as string,
            args?.sourceVersion as string,
            args?.targetVersion as string
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
