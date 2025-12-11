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

    const response = await fetch(url, {
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

    return response.text() as unknown as T;
  }

  // HAC Session Management

  private extractCsrfToken(html: string): string | null {
    // Look for CSRF token in meta tag
    const metaMatch = html.match(/name="_csrf"\s+content="([^"]+)"/);
    if (metaMatch) return metaMatch[1];

    // Look for CSRF token in hidden input
    const inputMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
    if (inputMatch) return inputMatch[1];

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
    let loginPageResponse = await fetch(loginPageUrl, {
      method: 'GET',
      redirect: 'manual',
    });

    let cookies = this.extractCookies(loginPageResponse);

    // Follow redirect to login.jsp if needed
    if (loginPageResponse.status === 302) {
      const location = loginPageResponse.headers.get('location');
      if (location) {
        loginPageUrl = location.startsWith('http') ? location : `${this.config.baseUrl}${location}`;
        loginPageResponse = await fetch(loginPageUrl, {
          method: 'GET',
          headers: {
            'Cookie': cookies.join('; '),
          },
          redirect: 'manual',
        });
        // Merge cookies
        const newCookies = this.extractCookies(loginPageResponse);
        if (newCookies.length > 0) {
          const cookieMap = new Map<string, string>();
          for (const cookie of [...cookies, ...newCookies]) {
            const [name] = cookie.split('=');
            cookieMap.set(name, cookie);
          }
          cookies = Array.from(cookieMap.values());
        }
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

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
      },
      body: loginBody,
      redirect: 'manual',
    });

    // Merge cookies from login response
    const newCookies = this.extractCookies(loginResponse);
    if (newCookies.length > 0) {
      // Replace or add new cookies
      const cookieMap = new Map<string, string>();
      for (const cookie of [...cookies, ...newCookies]) {
        const [name] = cookie.split('=');
        cookieMap.set(name, cookie);
      }
      cookies = Array.from(cookieMap.values());
    }

    // Check if login was successful (should redirect to HAC home)
    const location = loginResponse.headers.get('location');
    if (loginResponse.status !== 302 || !location || location.includes('error')) {
      throw new Error('HAC login failed - check credentials');
    }

    // Step 3: Follow redirect to get new CSRF token for authenticated session
    const homeUrl = location.startsWith('http') ? location : `${this.config.baseUrl}${location}`;
    const homeResponse = await fetch(homeUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies.join('; '),
      },
      redirect: 'manual',
    });

    // Merge any new cookies
    const homeCookies = this.extractCookies(homeResponse);
    if (homeCookies.length > 0) {
      const cookieMap = new Map<string, string>();
      for (const cookie of [...cookies, ...homeCookies]) {
        const [name] = cookie.split('=');
        cookieMap.set(name, cookie);
      }
      cookies = Array.from(cookieMap.values());
    }

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
    options: RequestInit = {}
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

    const response = await fetch(url, {
      ...options,
      headers,
      body,
      redirect: 'manual',
    });

    // If we get a redirect to login, session expired - retry once
    const location = response.headers.get('location');
    if (response.status === 302 && location?.includes('login')) {
      this.hacSession = null;
      return this.hacRequest<T>(endpoint, options);
    }

    if (!response.ok && response.status !== 302) {
      const errorText = await response.text();
      throw new Error(`HAC API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
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
      `/rest/v2/${this.config.baseSiteId}/products/search?${params}`
    );
  }

  async getProduct(productCode: string): Promise<Product> {
    return this.request<Product>(
      `/rest/v2/${this.config.baseSiteId}/products/${productCode}?fields=FULL`
    );
  }

  async getCategories(): Promise<Category[]> {
    const result = await this.request<{ subcategories: Category[] }>(
      `/rest/v2/${this.config.baseSiteId}/catalogs/${this.config.catalogId}/${this.config.catalogVersion}/categories`
    );
    return result.subcategories || [];
  }

  async getCategory(categoryCode: string): Promise<Category> {
    return this.request<Category>(
      `/rest/v2/${this.config.baseSiteId}/catalogs/${this.config.catalogId}/${this.config.catalogVersion}/categories/${categoryCode}`
    );
  }

  async getOrders(userId: string): Promise<{ orders: Order[] }> {
    return this.request<{ orders: Order[] }>(
      `/rest/v2/${this.config.baseSiteId}/users/${userId}/orders?fields=FULL`
    );
  }

  async getOrder(userId: string, orderCode: string): Promise<Order> {
    return this.request<Order>(
      `/rest/v2/${this.config.baseSiteId}/users/${userId}/orders/${orderCode}?fields=FULL`
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

  async executeGroovyScript(script: string): Promise<{ output: string; result: unknown }> {
    const formData = new URLSearchParams({
      script,
      scriptType: 'groovy',
    });

    return this.hacRequest<{ output: string; result: unknown }>(
      `${this.hacPrefix}/console/scripting/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
  }

  async importImpex(impexContent: string): Promise<ImpexResult> {
    const formData = new URLSearchParams({
      scriptContent: impexContent,
    });

    const result = await this.hacRequest<{ success: boolean; output: string; errors?: string[] }>(
      `${this.hacPrefix}/console/impex/import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );

    return {
      success: result.success,
      message: result.output,
      errors: result.errors,
    };
  }

  async exportImpex(flexQuery: string): Promise<string> {
    const formData = new URLSearchParams({
      flexibleSearchQuery: flexQuery,
    });

    return this.hacRequest<string>(
      `${this.hacPrefix}/console/impex/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
  }

  // Backoffice / Admin API Methods

  async getCronJobs(): Promise<{ cronJobs: { code: string; active: boolean; status: string }[] }> {
    return this.hacRequest<{ cronJobs: { code: string; active: boolean; status: string }[] }>(
      `${this.hacPrefix}/monitoring/cronjobs`,
      { method: 'GET' }
    );
  }

  async triggerCronJob(cronJobCode: string): Promise<{ success: boolean; message: string }> {
    const formData = new URLSearchParams();

    return this.hacRequest<{ success: boolean; message: string }>(
      `${this.hacPrefix}/monitoring/cronjobs/${cronJobCode}/trigger`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
  }

  async clearCache(cacheType?: string): Promise<{ success: boolean; message: string }> {
    const endpoint = cacheType
      ? `${this.hacPrefix}/monitoring/cache/clear/${cacheType}`
      : `${this.hacPrefix}/monitoring/cache/clear`;

    const formData = new URLSearchParams();

    return this.hacRequest<{ success: boolean; message: string }>(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
  }

  async getSystemInfo(): Promise<Record<string, unknown>> {
    return this.hacRequest<Record<string, unknown>>(
      `${this.hacPrefix}/monitoring/system`,
      { method: 'GET' }
    );
  }

  // Catalog Synchronization

  async triggerCatalogSync(
    catalogId: string,
    sourceVersion: string,
    targetVersion: string
  ): Promise<{ success: boolean; message: string }> {
    const formData = new URLSearchParams({
      catalogId,
      sourceVersion,
      targetVersion,
    });

    return this.hacRequest<{ success: boolean; message: string }>(
      `${this.hacPrefix}/console/sync/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
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