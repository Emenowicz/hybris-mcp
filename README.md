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

## Usage with Cursor

Add to your Cursor MCP configuration (`~/.cursor/mcp.json`):

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

## Usage with Windsurf

Add to your Windsurf MCP configuration (`~/.codeium/windsurf/mcp_config.json`):

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

## Usage with VS Code (Copilot/Continue/Cline)

For VS Code extensions that support MCP, add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
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

## Usage with Zed

Add to your Zed settings (`~/.config/zed/settings.json`):

```json
{
  "context_servers": {
    "hybris": {
      "command": {
        "path": "node",
        "args": ["/path/to/hybris-mcp/dist/index.js"],
        "env": {
          "HYBRIS_BASE_URL": "https://localhost:9002",
          "HYBRIS_USERNAME": "admin",
          "HYBRIS_PASSWORD": "nimda"
        }
      }
    }
  }
}
```

## Usage with JetBrains IDEs

For IntelliJ IDEA, WebStorm, PyCharm, and other JetBrains IDEs with AI Assistant, add to your MCP configuration:

**macOS/Linux:** `~/.config/JetBrains/mcp.json`
**Windows:** `%APPDATA%\JetBrains\mcp.json`

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

## Usage with Sourcegraph Cody

Add to your Cody MCP configuration (`~/.config/cody/mcp.json`):

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

## Usage with Raycast

Add to your Raycast AI extension MCP settings (`~/.config/raycast/mcp.json`):

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

## Generic MCP Configuration

For any other MCP-compatible client, the server uses **stdio transport**. Run with:

```bash
node /path/to/hybris-mcp/dist/index.js
```

Required environment variables:
- `HYBRIS_BASE_URL`
- `HYBRIS_USERNAME`
- `HYBRIS_PASSWORD`

## Available Tools

### Administration (HAC) - Full Support

All HAC-based tools work reliably with Basic authentication:

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

### Product & Catalog (OCC API)

| Tool | Description | Notes |
|------|-------------|-------|
| `health_check` | Check system health | Always works |
| `get_product` | Get detailed product information by code | Works with Basic auth |
| `get_category` | Get category details by code | Works with Basic auth |
| `search_products` | Search for products in the catalog | Requires Solr indexing* |
| `get_categories` | List all categories in the catalog | Endpoint may not be exposed* |

### Orders (OCC API)

| Tool | Description | Notes |
|------|-------------|-------|
| `get_orders` | Get orders for a user | Requires OAuth* |
| `get_order` | Get specific order details | Requires OAuth* |

*See [Known Limitations](#known-limitations) below.

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

## Known Limitations

### OCC Order Endpoints Require OAuth

The `get_orders` and `get_order` tools require OAuth user authentication, not just Basic auth. These endpoints need a user-specific OAuth token obtained via the password grant flow:

```bash
POST /authorizationserver/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=user@example.com&password=secret&client_id=mobile_android&client_secret=secret
```

**Workaround**: Use `flexible_search` to query orders directly:
```sql
SELECT {pk}, {code}, {user}, {totalPrice} FROM {Order} WHERE {user} = ?user
```

### Product Search Requires Solr

The `search_products` tool uses the OCC search endpoint which requires Solr indexing. If your instance uses a different search provider (e.g., Algolia), this endpoint may return empty results.

**Workaround**: Use `flexible_search` to query products:
```sql
SELECT {pk}, {code}, {name[en]} FROM {Product} WHERE {name[en]} LIKE '%search_term%'
```

### Categories Endpoint May Not Be Exposed

The `get_categories` tool uses an OCC endpoint that may not be exposed in all Hybris configurations.

**Workaround**: Use `flexible_search` to query categories:
```sql
SELECT {pk}, {code}, {name[en]} FROM {Category} WHERE {catalogVersion} IN (
  {{ SELECT {pk} FROM {CatalogVersion} WHERE {version} = 'Online' }}
)
```

## Security Notes

- Store credentials securely - never commit them to version control
- Use environment variables or secure secret management
- The server requires HAC admin access for administrative tools
- Consider using read-only credentials if you only need OCC API access

## Security Considerations

This MCP server provides powerful administrative access to your Hybris instance:

- **FlexibleSearch**: Can query any data including sensitive tables (users, passwords, tokens)
- **Groovy Scripts**: Execute arbitrary code with full system access (file system, network, processes)
- **ImpEx**: Can modify any data in the system including user accounts and permissions

**Recommendations:**
1. Use dedicated service accounts with minimal required permissions
2. Enable audit logging on your Hybris instance to track all operations
3. Never expose the MCP server to untrusted networks or users
4. Review all Groovy scripts before execution in production environments
5. Consider network segmentation to restrict access to HAC endpoints

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

> **WARNING:** Never use `NODE_TLS_REJECT_UNAUTHORIZED=0` in production environments. This disables TLS certificate validation and exposes you to man-in-the-middle attacks. For production, configure proper SSL certificates.

### CSRF Token Errors

The server handles CSRF tokens automatically. If you see CSRF errors:
1. Check that HAC login is working manually
2. Verify the HAC path is correct
3. Try restarting the MCP server to get a fresh session

## License

MIT
