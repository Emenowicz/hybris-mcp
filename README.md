# Hybris MCP Server

MCP (Model Context Protocol) server for SAP Commerce Cloud (Hybris) integration. This server allows AI assistants like Claude to interact with your Hybris instance.

## Features

- **Product Management**: Search products, get product details, browse categories
- **Order Management**: View orders and order details
- **FlexibleSearch**: Execute FlexibleSearch queries directly
- **Groovy Scripts**: Run Groovy scripts via the scripting console
- **ImpEx**: Import and export data using ImpEx format
- **Cron Jobs**: List and trigger cron jobs
- **Cache Management**: Clear Hybris caches
- **Catalog Sync**: Trigger catalog synchronization
- **Health Checks**: Monitor system health

## Installation

```bash
git clone <repository-url>
cd hybris-mcp
npm install
npm run build
```

## Configuration

Configure via environment variables:

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `HYBRIS_BASE_URL` | **Yes** | Base URL of your Hybris instance | - |
| `HYBRIS_USERNAME` | **Yes** | Admin username (HAC access required) | - |
| `HYBRIS_PASSWORD` | **Yes** | Admin password | - |
| `HYBRIS_BASE_SITE_ID` | No | OCC base site ID | `electronics` |
| `HYBRIS_CATALOG_ID` | No | Product catalog ID | `electronicsProductCatalog` |
| `HYBRIS_CATALOG_VERSION` | No | Catalog version | `Online` |
| `HYBRIS_HAC_PATH` | No | HAC path prefix | `/hac` |

### Common Configurations

**Standard Hybris (localhost):**
```bash
HYBRIS_BASE_URL=https://localhost:9002
HYBRIS_USERNAME=admin
HYBRIS_PASSWORD=nimda
```

**SAP Commerce Cloud (CCv2):**
```bash
HYBRIS_BASE_URL=https://backoffice.your-environment.model-t.cc.commerce.ondemand.com
HYBRIS_USERNAME=admin
HYBRIS_PASSWORD=your-password
HYBRIS_HAC_PATH=/hac
```

**Custom Site Configuration:**
```bash
HYBRIS_BASE_URL=https://localhost:9002
HYBRIS_USERNAME=admin
HYBRIS_PASSWORD=nimda
HYBRIS_BASE_SITE_ID=yoursite
HYBRIS_CATALOG_ID=yourProductCatalog
HYBRIS_CATALOG_VERSION=Online
```

## Usage with Claude Code

Add the MCP server using the CLI:

```bash
claude mcp add hybris \
  -e HYBRIS_BASE_URL=https://localhost:9002 \
  -e HYBRIS_USERNAME=admin \
  -e HYBRIS_PASSWORD=nimda \
  -- node /path/to/hybris-mcp/dist/index.js
```

Or manually add to your Claude Code MCP settings (`~/.claude.json` or project config):

```json
{
  "mcpServers": {
    "hybris": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/hybris-mcp/dist/index.js"],
      "env": {
        "HYBRIS_BASE_URL": "https://localhost:9002",
        "HYBRIS_USERNAME": "admin",
        "HYBRIS_PASSWORD": "nimda"
      }
    }
  }
}
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "hybris": {
      "command": "node",
      "args": ["/path/to/hybris-mcp/dist/index.js"],
      "env": {
        "HYBRIS_BASE_URL": "https://localhost:9002",
        "HYBRIS_USERNAME": "admin",
        "HYBRIS_PASSWORD": "nimda"
      }
    }
  }
}
```

## Available Tools

### Product & Catalog (OCC API)

| Tool | Description |
|------|-------------|
| `search_products` | Search for products in the catalog |
| `get_product` | Get detailed product information by code |
| `get_categories` | List all categories in the catalog |
| `get_category` | Get category details by code |

### Orders (OCC API)

| Tool | Description |
|------|-------------|
| `get_orders` | Get orders for a user |
| `get_order` | Get specific order details |

### Administration (HAC)

| Tool | Description |
|------|-------------|
| `flexible_search` | Execute FlexibleSearch queries |
| `execute_groovy` | Run Groovy scripts |
| `import_impex` | Import ImpEx data |
| `export_impex` | Export data to ImpEx format |
| `get_cronjobs` | List cron jobs and their status |
| `trigger_cronjob` | Trigger a cron job to run |
| `clear_cache` | Clear Hybris caches |
| `get_system_info` | Get system information |
| `trigger_catalog_sync` | Sync catalog versions |
| `health_check` | Check system health |

## Example Prompts

### Search Products
```
Search for "camera" products in Hybris
```

### FlexibleSearch
```
Run a FlexibleSearch query: SELECT {pk}, {code}, {name[en]} FROM {Product} WHERE {code} LIKE '%camera%'
```

### Execute Groovy
```
Execute this Groovy script to count products:
import de.hybris.platform.core.Registry
def ctx = Registry.getApplicationContext()
def flexibleSearchService = ctx.getBean("flexibleSearchService")
def query = "SELECT COUNT(*) FROM {Product}"
def result = flexibleSearchService.search(query)
println "Total products: ${result.result[0]}"
```

### Import ImpEx
```
Import this ImpEx to create a product:
INSERT_UPDATE Product; code[unique=true]; name[lang=en]; catalogVersion(catalog(id),version)
; testProduct001 ; Test Product ; electronicsProductCatalog:Online
```

### Trigger Catalog Sync
```
Sync the electronics catalog from Staged to Online
```

## Security Notes

- Store credentials securely - never commit them to version control
- Use environment variables or secure secret management
- The server requires HAC admin access for administrative tools
- Consider using read-only credentials if you only need OCC API access

## Development

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Run directly
HYBRIS_BASE_URL=https://localhost:9002 \
HYBRIS_USERNAME=admin \
HYBRIS_PASSWORD=nimda \
npm start
```

## Troubleshooting

### Connection Issues

1. Verify your Hybris instance is running and accessible
2. Check if HAC is enabled and accessible at the configured path
3. Ensure credentials have admin access to HAC

### SSL Certificate Errors

For local development with self-signed certificates:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/index.js
```

### CSRF Token Errors

The server handles CSRF tokens automatically. If you see CSRF errors:
1. Check that HAC login is working manually
2. Verify the HAC path is correct
3. Try restarting the MCP server to get a fresh session

## License

MIT
