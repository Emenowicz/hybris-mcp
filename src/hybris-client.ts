/**
 * Hybris API Client for interacting with SAP Commerce Cloud
 */

export interface HybrisConfig {
  baseUrl: string;
  username: string;
  password: string;
  baseSiteId?: string;
  catalogId?: string;
  catalogVersion?: string;
  hacPath?: string; // HAC path prefix, defaults to '/hac'
}

export interface ProductSearchResult {
  products: Product[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalResults: number;
  };
}

export interface Product {
  code: string;
  name: string;
  description?: string;
  price?: {
    value: number;
    currencyIso: string;
    formattedValue: string;
  };
  stock?: {
    stockLevel: number;
    stockLevelStatus: string;
  };
  categories?: { code: string; name: string }[];
  images?: { url: string; format: string }[];
}

export interface Category {
  id: string;
  name: string;
  subcategories?: Category[];
}

export interface Order {
  code: string;
  status: string;
  created: string;
  totalPrice: {
    value: number;
    currencyIso: string;
    formattedValue: string;
  };
  entries: OrderEntry[];
}

export interface OrderEntry {
  entryNumber: number;
  quantity: number;
  product: {
    code: string;
    name: string;
  };
  totalPrice: {
    value: number;
    formattedValue: string;
  };
}

export interface FlexibleSearchResult {
  results: Record<string, unknown>[];
  count: number;
}

export interface ImpexResult {
  success: boolean;
  message: string;
  errors?: string[];
}

interface HacSession {
  cookies: string[];
  csrfToken: string;
}

export class HybrisClient {
  private static readonly REQUEST_TIMEOUT_MS = 30000;

  private config: HybrisConfig;
  private hacSession: HacSession | null = null;

  constructor(config: HybrisConfig) {
    this.config = {
      baseSiteId: 'electronics',
      catalogId: 'electronicsProductCatalog',
      catalogVersion: 'Online',
      hacPath: '/hac',
      ...config,
    };
  }

  private get hacPrefix(): string {
    return this.config.hacPath || '/hac';
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HybrisClient.REQUEST_TIMEOUT_MS
    );
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${HybrisClient.REQUEST_TIMEOUT_MS}ms: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mergeCookies(existing: string[], incoming: string[]): string[] {
    const cookieMap = new Map<string, string>();
    for (const cookie of [...existing, ...incoming]) {
      const [name] = cookie.split('=');
      cookieMap.set(name, cookie);
    }
    return Array.from(cookieMap.values());
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await this.fetchWithTimeout(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hybris API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    if (contentType?.includes('text/html') && text.includes('<html')) {
      throw new Error(
        `Unexpected HTML response (possible auth failure): ${text.substring(0, 200)}...`
      );
    }
    return text as unknown as T;
  }

  // HAC Session Management

  private extractCsrfToken(html: string): string | null {
    // Handle various attribute orderings and quote styles
    const patterns = [
      /name=["']_csrf["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*name=["']_csrf["']/i,
      /name=["']_csrf["'][^>]*value=["']([^"']+)["']/i,
      /value=["']([^"']+)["'][^>]*name=["']_csrf["']/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private extractCookies(response: Response): string[] {
    const cookies: string[] = [];
    const setCookieHeaders = response.headers.getSetCookie?.() || [];

    for (const cookie of setCookieHeaders) {
      // Extract just the cookie name=value part
      const cookiePart = cookie.split(';')[0];
      if (cookiePart) {
        cookies.push(cookiePart);
      }
    }

    return cookies;
  }

  private async ensureHacSession(): Promise<HacSession> {
    if (this.hacSession) {
      return this.hacSession;
    }

    // Step 1: Get the login page to obtain initial CSRF token and cookies
    // First request to / may redirect to /login.jsp
    let loginPageUrl = `${this.config.baseUrl}${this.hacPrefix}/`;
    let loginPageResponse = await this.fetchWithTimeout(loginPageUrl, {
      method: 'GET',
      redirect: 'manual',
    });

    let cookies = this.extractCookies(loginPageResponse);

    // Follow redirect to login.jsp if needed
    if (loginPageResponse.status === 302) {
      const location = loginPageResponse.headers.get('location');
      if (location) {
        loginPageUrl = location.startsWith('http') ? location : `${this.config.baseUrl}${location}`;
        loginPageResponse = await this.fetchWithTimeout(loginPageUrl, {
          method: 'GET',
          headers: {
            'Cookie': cookies.join('; '),
          },
          redirect: 'manual',
        });
        cookies = this.mergeCookies(cookies, this.extractCookies(loginPageResponse));
      }
    }

    const loginPageHtml = await loginPageResponse.text();
    const csrfToken = this.extractCsrfToken(loginPageHtml);

    if (!csrfToken) {
      throw new Error('Failed to extract CSRF token from HAC login page');
    }

    // Step 2: Submit login form
    const loginUrl = `${this.config.baseUrl}${this.hacPrefix}/j_spring_security_check`;
    const loginBody = new URLSearchParams({
      j_username: this.config.username,
      j_password: this.config.password,
      _csrf: csrfToken,
    });

    const loginResponse = await this.fetchWithTimeout(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
      },
      body: loginBody,
      redirect: 'manual',
    });

    cookies = this.mergeCookies(cookies, this.extractCookies(loginResponse));

    // Check if login was successful (should redirect to HAC home)
    const location = loginResponse.headers.get('location');
    if (loginResponse.status !== 302 || !location || location.includes('error')) {
      throw new Error('HAC login failed - check credentials');
    }

    // Step 3: Follow redirect to get new CSRF token for authenticated session
    const homeUrl = location.startsWith('http') ? location : `${this.config.baseUrl}${location}`;
    const homeResponse = await this.fetchWithTimeout(homeUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies.join('; '),
      },
      redirect: 'manual',
    });

    cookies = this.mergeCookies(cookies, this.extractCookies(homeResponse));

    const homeHtml = await homeResponse.text();
    const newCsrfToken = this.extractCsrfToken(homeHtml);

    if (!newCsrfToken) {
      throw new Error('Failed to extract CSRF token after HAC login');
    }

    this.hacSession = {
      cookies,
      csrfToken: newCsrfToken,
    };

    return this.hacSession;
  }

  private async hacRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const session = await this.ensureHacSession();
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Cookie': session.cookies.join('; '),
      'X-CSRF-TOKEN': session.csrfToken,
      ...(options.headers as Record<string, string>),
    };

    // Add CSRF token to form data if it's a POST with form data
    let body = options.body;
    if (options.method === 'POST' && body instanceof URLSearchParams) {
      body.set('_csrf', session.csrfToken);
    }

    const response = await this.fetchWithTimeout(url, {
      ...options,
      headers,
      body,
      redirect: 'manual',
    });

    // If we get a redirect to login, session expired - retry once
    const location = response.headers.get('location');
    if (response.status === 302 && location?.includes('login')) {
      if (retryCount >= 1) {
        throw new Error('HAC session expired and re-authentication failed');
      }
      this.hacSession = null;
      return this.hacRequest<T>(endpoint, options, retryCount + 1);
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text();
      throw new Error(`HAC API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    if (contentType?.includes('text/html') && text.includes('<html')) {
      throw new Error(
        `Unexpected HTML response (possible auth failure): ${text.substring(0, 200)}...`
      );
    }
    return text as unknown as T;
  }

  // OCC API Methods (Omni Commerce Connect)

  async searchProducts(query: string, pageSize = 20, currentPage = 0): Promise<ProductSearchResult> {
    const params = new URLSearchParams({
      query,
      pageSize: pageSize.toString(),
      currentPage: currentPage.toString(),
      fields: 'products(code,name,description,price,stock,categories,images),pagination',
    });

    return this.request<ProductSearchResult>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/products/search?${params}`
    );
  }

  async getProduct(productCode: string): Promise<Product> {
    return this.request<Product>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/products/${encodeURIComponent(productCode)}?fields=FULL`
    );
  }

  async getCategories(): Promise<Category[]> {
    const result = await this.request<{ subcategories: Category[] }>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/catalogs/${encodeURIComponent(this.config.catalogId!)}/${encodeURIComponent(this.config.catalogVersion!)}/categories`
    );
    return result.subcategories || [];
  }

  async getCategory(categoryCode: string): Promise<Category> {
    return this.request<Category>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/catalogs/${encodeURIComponent(this.config.catalogId!)}/${encodeURIComponent(this.config.catalogVersion!)}/categories/${encodeURIComponent(categoryCode)}`
    );
  }

  async getOrders(userId: string): Promise<{ orders: Order[] }> {
    return this.request<{ orders: Order[] }>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/users/${encodeURIComponent(userId)}/orders?fields=FULL`
    );
  }

  async getOrder(userId: string, orderCode: string): Promise<Order> {
    return this.request<Order>(
      `/rest/v2/${encodeURIComponent(this.config.baseSiteId!)}/users/${encodeURIComponent(userId)}/orders/${encodeURIComponent(orderCode)}?fields=FULL`
    );
  }

  // HAC (Hybris Administration Console) Methods

  async executeFlexibleSearch(query: string, maxCount = 100): Promise<FlexibleSearchResult> {
    const formData = new URLSearchParams({
      flexibleSearchQuery: query,
      maxCount: maxCount.toString(),
    });

    return this.hacRequest<FlexibleSearchResult>(
      `${this.hacPrefix}/console/flexsearch/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
  }

  async executeGroovyScript(script: string, commit = false): Promise<{ output: string; result: unknown }> {
    const formData = new URLSearchParams({
      script,
      scriptType: 'groovy',
      commit: commit.toString(),
    });

    const response = await this.hacRequest<{
      outputText?: string;
      executionResult?: unknown;
      stacktraceText?: string;
    }>(
      `${this.hacPrefix}/console/scripting/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );

    // Map HAC response fields to our expected format
    return {
      output: response.outputText || '',
      result: response.executionResult,
    };
  }

  async importImpex(impexContent: string): Promise<ImpexResult> {
    // Use Groovy script for ImpEx import with ImportService
    const escapedContent = impexContent
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    const script = `
import de.hybris.platform.servicelayer.impex.ImportService
import de.hybris.platform.servicelayer.impex.ImportConfig
import de.hybris.platform.servicelayer.impex.impl.StreamBasedImpExResource

try {
    def impexContent = "${escapedContent}"
    def importService = spring.getBean("importService")

    def config = new ImportConfig()
    def resource = new StreamBasedImpExResource(
        new ByteArrayInputStream(impexContent.getBytes("UTF-8")),
        "UTF-8"
    )
    config.setScript(resource)
    config.setEnableCodeExecution(true)

    def importResult = importService.importData(config)

    if (importResult.hasUnresolvedLines()) {
        println "WARNING: Import completed with unresolved lines"
        importResult.unresolvedLines.allLines.each { line ->
            println "  Unresolved: " + line
        }
    }

    if (importResult.isError()) {
        println "ERROR: Import failed"
        if (importResult.unresolvedLines?.allLines) {
            importResult.unresolvedLines.allLines.each { line ->
                println "  Error: " + line
            }
        }
        return "ERROR"
    }

    println "SUCCESS: ImpEx import completed"
    return "SUCCESS"
} catch (Exception e) {
    println "ERROR: " + e.getMessage()
    e.printStackTrace()
    return "ERROR: " + e.getMessage()
}
`;
    const result = await this.executeGroovyScript(script, true); // commit=true for imports
    const output = result.output || '';
    const execResult = String(result.result || '');
    const success = output.includes('SUCCESS:') || execResult === 'SUCCESS';
    const errors: string[] = [];

    // Extract unresolved lines as errors
    const unresolvedMatch = output.match(/Unresolved: (.+)/g);
    if (unresolvedMatch) {
      errors.push(...unresolvedMatch);
    }

    const errorMatch = output.match(/ERROR: (.+)/);
    if (errorMatch) {
      errors.push(errorMatch[1]);
    }

    return {
      success,
      message: output || execResult,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async exportImpex(flexQuery: string): Promise<string> {
    // Use Groovy script for ImpEx export
    const escapedQuery = flexQuery.replace(/"/g, '\\"');

    const script = `
try {
    def flexibleSearchService = spring.getBean("flexibleSearchService")
    def query = "${escapedQuery}"
    def searchResult = flexibleSearchService.search(query)

    if (searchResult.result.isEmpty()) {
        println "No results found for query"
        return "# No results found"
    }

    // Build ImpEx header from first item
    def firstItem = searchResult.result[0]
    def itemType = firstItem.itemtype  // Use lowercase 'itemtype' property

    def sb = new StringBuilder()
    sb.append("# Exported from FlexibleSearch: ").append(query).append("\\n")
    sb.append("# Result count: ").append(searchResult.totalCount).append("\\n\\n")

    // Simple export format
    sb.append("INSERT_UPDATE ").append(itemType).append(";pk[unique=true]\\n")
    searchResult.result.each { item ->
        sb.append(";").append(item.PK.toString()).append("\\n")
    }

    println "SUCCESS: Exported " + searchResult.result.size() + " items"
    return sb.toString()
} catch (Exception e) {
    println "ERROR: " + e.getMessage()
    e.printStackTrace()
    return "# Error: " + e.getMessage()
}
`;
    const result = await this.executeGroovyScript(script);
    const execResult = String(result.result || '');

    // If result looks like ImpEx content, return it
    if (execResult.includes('INSERT_UPDATE') || execResult.includes('# ')) {
      return execResult;
    }

    return result.output || execResult || '# Export failed';
  }

  // Backoffice / Admin API Methods

  async getCronJobs(): Promise<{ cronJobs: { code: string; active: boolean; status: string }[] }> {
    // Use FlexibleSearch to get cron jobs as HAC doesn't have a direct API
    const result = await this.executeFlexibleSearch(
      "SELECT {code}, {active}, {status} FROM {CronJob} ORDER BY {code}",
      1000
    );

    // FlexibleSearch returns resultList as array of arrays, with headers
    const resultList = (result as unknown as { resultList?: unknown[][] }).resultList || [];
    const headers = (result as unknown as { headers?: string[] }).headers || ['code', 'active', 'status'];

    const codeIdx = headers.findIndex(h => h.toLowerCase().includes('code'));
    const activeIdx = headers.findIndex(h => h.toLowerCase().includes('active'));
    const statusIdx = headers.findIndex(h => h.toLowerCase().includes('status'));

    return {
      cronJobs: resultList.map((row) => ({
        code: String(row[codeIdx >= 0 ? codeIdx : 0] || ''),
        active: row[activeIdx >= 0 ? activeIdx : 1] === true || row[activeIdx >= 0 ? activeIdx : 1] === 'true',
        status: String(row[statusIdx >= 0 ? statusIdx : 2] || ''),
      })),
    };
  }

  async triggerCronJob(cronJobCode: string): Promise<{ success: boolean; message: string }> {
    // Use Groovy script to trigger cron job
    const escapedCode = cronJobCode.replace(/"/g, '\\"');
    const script = `
import de.hybris.platform.servicelayer.cronjob.CronJobService

def cronJobService = spring.getBean("cronJobService")
def cronJob = cronJobService.getCronJob("${escapedCode}")
if (cronJob == null) {
    println "CronJob not found: ${escapedCode}"
    return "NOT_FOUND"
}
cronJobService.performCronJob(cronJob, true)
println "CronJob triggered: ${escapedCode}"
return "SUCCESS"
`;
    const result = await this.executeGroovyScript(script);
    const output = result.output || '';
    const execResult = String(result.result || '');
    const success = output.includes('triggered') || execResult === 'SUCCESS';
    return {
      success,
      message: success
        ? `CronJob ${cronJobCode} triggered`
        : `Failed to trigger ${cronJobCode}: ${output || execResult || 'Unknown error'}`,
    };
  }

  async clearCache(cacheType?: string): Promise<{ success: boolean; message: string }> {
    // Use Groovy script to clear cache
    const escapedType = cacheType ? cacheType.replace(/"/g, '\\"') : '';
    const script = `
import de.hybris.platform.core.Registry

def cacheType = "${escapedType}"

if (cacheType == "all" || cacheType == "") {
    Registry.getCurrentTenant().getCache().clear()
    println "All caches cleared"
    return "SUCCESS"
} else {
    // Clear specific cache region if supported
    try {
        def cacheController = spring.getBean("cacheController")
        cacheController.clearCache()
        println "Cache cleared: " + cacheType
        return "SUCCESS"
    } catch (Exception e) {
        Registry.getCurrentTenant().getCache().clear()
        println "Cleared all caches (specific cache type not supported)"
        return "SUCCESS"
    }
}
`;
    const result = await this.executeGroovyScript(script);
    const output = result.output || '';
    const execResult = String(result.result || '');
    const success = output.includes('cleared') || execResult === 'SUCCESS';
    return {
      success,
      message: success ? 'Cache cleared successfully' : `Failed to clear cache: ${output || execResult || 'Unknown error'}`,
    };
  }

  async getSystemInfo(): Promise<Record<string, unknown>> {
    // Use Groovy script to get system info
    const script = `
import de.hybris.platform.core.Registry
import de.hybris.platform.util.Config

def tenant = Registry.getCurrentTenant()
def runtime = Runtime.getRuntime()

def info = [
    hybrisVersion: Config.getString("build.version", "unknown"),
    buildNumber: Config.getString("build.number", "unknown"),
    tenantId: tenant.getTenantID(),
    clusterId: Config.getInt("cluster.id", 0),
    clusterIsland: Config.getInt("cluster.island.id", 0),
    javaVersion: System.getProperty("java.version"),
    javaVendor: System.getProperty("java.vendor"),
    osName: System.getProperty("os.name"),
    osArch: System.getProperty("os.arch"),
    maxMemoryMB: (runtime.maxMemory() / 1024 / 1024) as int,
    totalMemoryMB: (runtime.totalMemory() / 1024 / 1024) as int,
    freeMemoryMB: (runtime.freeMemory() / 1024 / 1024) as int,
    availableProcessors: runtime.availableProcessors()
]

return groovy.json.JsonOutput.toJson(info)
`;
    const result = await this.executeGroovyScript(script);
    try {
      // Parse the JSON result - executionResult contains the returned value
      const jsonStr = String(result.result || '');
      if (jsonStr && jsonStr.startsWith('{')) {
        return JSON.parse(jsonStr);
      }
      // If result is not JSON, return what we have
      return {
        output: result.output,
        result: result.result,
      };
    } catch {
      return {
        output: result.output,
        result: result.result,
        parseError: 'Failed to parse system info JSON',
      };
    }
  }

  // Catalog Synchronization

  async triggerCatalogSync(
    catalogId: string,
    sourceVersion: string,
    targetVersion: string
  ): Promise<{ success: boolean; message: string }> {
    // Use Groovy script to trigger catalog sync by creating a properly configured CronJob
    const escapedCatalogId = catalogId.replace(/"/g, '\\"');
    const escapedSource = sourceVersion.replace(/"/g, '\\"');
    const escapedTarget = targetVersion.replace(/"/g, '\\"');
    const script = `
import de.hybris.platform.catalog.model.synchronization.CatalogVersionSyncCronJobModel
import de.hybris.platform.cronjob.enums.JobLogLevel

try {
    def catalogVersionService = spring.getBean("catalogVersionService")
    def modelService = spring.getBean("modelService")
    def cronJobService = spring.getBean("cronJobService")
    def flexibleSearchService = spring.getBean("flexibleSearchService")

    def sourceCatalogVersion = catalogVersionService.getCatalogVersion("${escapedCatalogId}", "${escapedSource}")
    def targetCatalogVersion = catalogVersionService.getCatalogVersion("${escapedCatalogId}", "${escapedTarget}")

    if (sourceCatalogVersion == null) {
        println "ERROR: Source catalog version not found: ${escapedCatalogId}:${escapedSource}"
        return "SOURCE_NOT_FOUND"
    }
    if (targetCatalogVersion == null) {
        println "ERROR: Target catalog version not found: ${escapedCatalogId}:${escapedTarget}"
        return "TARGET_NOT_FOUND"
    }

    // Find sync job using flexible search
    def query = "SELECT {pk} FROM {CatalogVersionSyncJob} WHERE {sourceVersion} = ?source AND {targetVersion} = ?target"
    def params = [source: sourceCatalogVersion, target: targetCatalogVersion]
    def searchResult = flexibleSearchService.search(query, params)

    if (searchResult.result.isEmpty()) {
        println "ERROR: No sync job found for ${escapedCatalogId} ${escapedSource} -> ${escapedTarget}"
        println "Available sync jobs:"
        def allJobs = flexibleSearchService.search("SELECT {pk}, {code} FROM {CatalogVersionSyncJob}").result
        allJobs.each { job -> println "  - " + job.code }
        return "SYNC_JOB_NOT_FOUND"
    }

    def syncJob = searchResult.result[0]
    println "Found sync job: " + syncJob.code

    // Create a new CronJob with all mandatory attributes
    def syncCronJob = modelService.create(CatalogVersionSyncCronJobModel.class)
    syncCronJob.setJob(syncJob)
    syncCronJob.setCode("mcp_sync_" + System.currentTimeMillis())

    // Set all mandatory attributes
    syncCronJob.setCreateSavedValues(false)
    syncCronJob.setForceUpdate(false)
    syncCronJob.setLogToDatabase(false)
    syncCronJob.setLogToFile(false)
    syncCronJob.setLogLevelDatabase(JobLogLevel.WARNING)
    syncCronJob.setLogLevelFile(JobLogLevel.WARNING)

    modelService.save(syncCronJob)
    println "Created sync cronjob: " + syncCronJob.code

    // Trigger the cronjob
    cronJobService.performCronJob(syncCronJob, true)

    println "SUCCESS: Catalog sync triggered: ${escapedCatalogId} ${escapedSource} -> ${escapedTarget}"
    return "SUCCESS"
} catch (Exception e) {
    println "ERROR: " + e.getMessage()
    e.printStackTrace()
    return "ERROR: " + e.getMessage()
}
`;
    const result = await this.executeGroovyScript(script);
    const output = result.output || '';
    const execResult = String(result.result || '');
    const success = output.includes('SUCCESS:') || execResult === 'SUCCESS';
    const errorMatch = output.match(/ERROR: (.+)/);
    return {
      success,
      message: success
        ? `Catalog sync triggered: ${catalogId} ${sourceVersion} -> ${targetVersion}`
        : errorMatch ? errorMatch[1] : `Failed to sync: ${output || execResult || 'Unknown error'}`,
    };
  }

  // Health check - uses OCC API since HAC may not be deployed
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      // Test connectivity via a simple product search
      const result = await this.searchProducts('', 1, 0);
      return {
        healthy: true,
        details: {
          baseSiteId: this.config.baseSiteId,
          totalProducts: result.pagination?.totalResults ?? 'unknown',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}