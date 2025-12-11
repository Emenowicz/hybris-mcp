# Hybris MCP Roadmap

## Current Features (v1.0.0)

### Product & Catalog (OCC API)
- [x] `search_products` - Search for products in the catalog
- [x] `get_product` - Get detailed product information
- [x] `get_categories` - List category tree
- [x] `get_category` - Get category details

### Orders (OCC API)
- [x] `get_orders` - Get orders for a user
- [x] `get_order` - Get specific order details

### Administration (HAC)
- [x] `flexible_search` - Execute FlexibleSearch queries
- [x] `execute_groovy` - Run Groovy scripts
- [x] `import_impex` - Import ImpEx data
- [x] `export_impex` - Export data to ImpEx
- [x] `get_cronjobs` - List cron jobs
- [x] `trigger_cronjob` - Trigger a cron job
- [x] `clear_cache` - Clear caches
- [x] `get_system_info` - Get system information
- [x] `trigger_catalog_sync` - Sync catalog versions
- [x] `health_check` - Check system health

---

## Planned Features

### Priority 1: Type System Introspection

Essential for developers to understand and work with the Hybris data model.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `get_type_definition` | Get full type definition including attributes, relations, and metadata | HAC/Groovy |
| `list_types` | List all types matching a pattern (e.g., `*Product*`) | HAC/Groovy |
| `get_type_attributes` | Get all attributes for a type including inherited ones | HAC/Groovy |
| `get_type_relations` | Get all relations for a type | HAC/Groovy |

**Example use cases:**
- "What attributes does the Product type have?"
- "Show me all types related to Order"
- "What's the relation between Cart and CartEntry?"

---

### Priority 2: Solr/Search Management

Critical for debugging search issues and managing indexes.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `list_solr_indexes` | List all Solr facet search configs and their status | HAC |
| `get_index_status` | Get detailed indexing status (last run, items indexed, errors) | HAC |
| `trigger_full_index` | Trigger full indexing for a facet search config | HAC |
| `trigger_update_index` | Trigger incremental/update indexing | HAC |
| `get_indexed_properties` | List all indexed properties for a search config | HAC/Groovy |

**Example use cases:**
- "What's the status of the product index?"
- "Trigger a full reindex of the product catalog"
- "Why isn't my product appearing in search?"

---

### Priority 3: Business Process Management

Essential for debugging order flows and async processes.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `list_business_processes` | List processes by state (running, failed, waiting) | FlexibleSearch |
| `get_process_details` | Get full details of a business process including context | HAC/Groovy |
| `get_process_logs` | Get log entries for a specific process | FlexibleSearch |
| `restart_process` | Restart a failed business process | HAC/Groovy |
| `list_process_definitions` | List available process definitions | FlexibleSearch |

**Example use cases:**
- "Show me all failed order processes"
- "Why did order 12345's fulfillment process fail?"
- "Restart the consignment process for order 12345"

---

### Priority 4: Configuration & Properties

Essential for debugging configuration issues.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `get_property` | Get a specific Hybris property value | HAC/Groovy |
| `search_properties` | Search properties by pattern | HAC/Groovy |
| `get_cluster_info` | Get cluster nodes, status, and configuration | HAC |
| `get_extensions` | List installed extensions and their status | HAC |
| `get_tenant_info` | Get current tenant configuration | HAC/Groovy |

**Example use cases:**
- "What's the value of cronjob.timertask.loadonstartup?"
- "Show me all properties containing 'solr'"
- "What extensions are installed?"

---

### Priority 5: Log Analysis

Quick access to logs for troubleshooting.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `search_logs` | Search logs by pattern, level, and time range | HAC |
| `get_recent_errors` | Get recent ERROR level log entries | HAC |
| `get_log_files` | List available log files | HAC |
| `tail_log` | Get last N lines from a specific log file | HAC |

**Example use cases:**
- "Show me errors from the last hour"
- "Search logs for 'OutOfMemory'"
- "What exceptions occurred during the last import?"

---

### Priority 6: CMS & Content Management

Useful for frontend debugging and content management.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `get_cms_page` | Get CMS page structure with all slots and components | OCC/FlexibleSearch |
| `list_cms_pages` | List CMS pages by template or catalog version | FlexibleSearch |
| `get_content_slot` | Get components in a specific content slot | FlexibleSearch |
| `get_cms_component` | Get component details by UID | FlexibleSearch |
| `list_page_templates` | List available page templates | FlexibleSearch |

**Example use cases:**
- "What components are on the homepage?"
- "Show me all ProductDetailPage templates"
- "What's in the Section1 slot on the cart page?"

---

### Priority 7: Stock & Inventory

Essential for e-commerce operations.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `get_stock_levels` | Get stock for a product across all warehouses | OCC/FlexibleSearch |
| `get_warehouse_stock` | Get all stock levels for a warehouse | FlexibleSearch |
| `update_stock_level` | Update stock for a product at a warehouse | ImpEx |
| `get_atp` | Get Available-to-Promise for a product | OCC/Groovy |
| `reserve_stock` | Create a stock reservation | Groovy |

**Example use cases:**
- "What's the stock level for product ABC123?"
- "Show me all products with low stock"
- "Update stock for product XYZ to 100 units"

---

### Priority 8: Promotions & Pricing

Marketing and pricing management.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `list_promotions` | List promotions (active, scheduled, expired) | FlexibleSearch |
| `get_promotion_details` | Get full promotion configuration | FlexibleSearch/Groovy |
| `evaluate_promotion` | Test a promotion against a cart | Groovy |
| `get_price_rows` | Get price rows for a product | FlexibleSearch |
| `list_price_groups` | List user price groups | FlexibleSearch |

**Example use cases:**
- "What promotions are currently active?"
- "Why isn't promotion XYZ applying to this cart?"
- "Show me all prices for product ABC123"

---

### Priority 9: Data Export & Comparison

Enhanced data management capabilities.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `export_to_csv` | Export FlexibleSearch results as CSV | HAC |
| `compare_catalog_versions` | Compare items between Staged and Online | Groovy |
| `get_modification_history` | Get change history for an item | FlexibleSearch |
| `count_items` | Count items matching a FlexibleSearch query | FlexibleSearch |
| `bulk_export` | Export large datasets with pagination | HAC |

**Example use cases:**
- "Export all products modified in the last week"
- "What changed between Staged and Online?"
- "How many products are in the catalog?"

---

### Priority 10: User & Session Management

B2B and customer management.

| Tool | Description | Implementation |
|------|-------------|----------------|
| `search_customers` | Search customers by email, name, or UID | FlexibleSearch |
| `get_customer_details` | Get full customer profile | OCC/FlexibleSearch |
| `list_user_groups` | List user groups and members | FlexibleSearch |
| `get_active_sessions` | Get active user sessions | HAC |
| `invalidate_session` | Invalidate a user session | Groovy |

**Example use cases:**
- "Find customer with email john@example.com"
- "What user groups does customer X belong to?"
- "How many active sessions are there?"

---

## Implementation Notes

### HAC Endpoints Used

Most admin features leverage HAC console endpoints:
- `/hac/console/flexsearch/execute` - FlexibleSearch
- `/hac/console/scripting/execute` - Groovy scripts
- `/hac/console/impex/import` - ImpEx import
- `/hac/console/impex/export` - ImpEx export
- `/hac/monitoring/*` - System monitoring

### Groovy Script Patterns

For complex operations, Groovy scripts provide the most flexibility:

```groovy
// Example: Get type definition
import de.hybris.platform.core.Registry
def typeService = Registry.getApplicationContext().getBean("typeService")
def type = typeService.getComposedTypeForCode("Product")
return [
  code: type.code,
  attributes: type.declaredattributedescriptors.collect { [name: it.qualifier, type: it.attributeType.code] }
]
```

### Authentication

All HAC operations require:
1. Session cookie management
2. CSRF token handling
3. Form-based authentication

The current implementation handles this automatically.

---

## Contributing

When adding new tools:

1. Add the tool definition to `src/index.ts`
2. Implement the method in `src/hybris-client.ts`
3. Use `hacRequest()` for HAC endpoints or `request()` for OCC API
4. Add documentation to README.md
5. Add example use cases

---

## Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** (planned) - Type system introspection
- **v1.2.0** (planned) - Solr/Search management
- **v1.3.0** (planned) - Business process management
