import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export interface HttpClientOptions {
  proxies?: string[];
  caCert?: string;
  userAgent?: string;
  retries?: number;
  retryDelay?: number;
  retryBackoff?: "linear" | "exponential";
  retryMaxDelay?: number;
  timeout?: number;
  /** Minimum delay between requests in seconds (rate limiting) */
  rateDelayMin?: number;
  /** Maximum delay between requests in seconds (rate limiting) */
  rateDelayMax?: number;
}

/**
 * HTTP client with rotating proxy support and rate limiting.
 * Replaces Python's RotatingProxySession / RequestsRotating / TLSRotating.
 */
@Injectable()
export class HttpClient {
  private readonly logger = new Logger(HttpClient.name);
  private readonly client: AxiosInstance;
  private readonly proxies: string[];
  private proxyIndex = 0;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly retryBackoff: "linear" | "exponential";
  private readonly retryMaxDelay: number;
  private readonly rateDelayMin: number;
  private readonly rateDelayMax: number;
  private lastRequestTime = 0;

  constructor(options: HttpClientOptions = {}) {
    this.proxies = options.proxies ?? [];
    this.maxRetries = options.retries ?? 3;
    this.retryDelay = options.retryDelay ?? 10000;
    this.retryBackoff = options.retryBackoff ?? "exponential";
    this.retryMaxDelay = options.retryMaxDelay ?? 30000;
    this.rateDelayMin = (options.rateDelayMin ?? 0) * 1000; // convert to ms
    this.rateDelayMax = (options.rateDelayMax ?? 0) * 1000;

    this.client = axios.create({
      timeout: (options.timeout ?? 60) * 1000,
      headers: {
        "User-Agent":
          options.userAgent ??
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      // Accept self-signed certs if caCert is configured
      ...(options.caCert
        ? {
            httpsAgent: new (require("https").Agent)({
              rejectUnauthorized: false,
            }),
          }
        : {}),
    });
  }

  private getNextProxy(): string | null {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.proxyIndex % this.proxies.length];
    this.proxyIndex++;
    return proxy;
  }

  private createAgent(
    proxy: string,
  ): HttpsProxyAgent<string> | SocksProxyAgent {
    if (proxy.startsWith("socks5://") || proxy.startsWith("socks4://")) {
      return new SocksProxyAgent(proxy);
    }
    const proxyUrl = proxy.startsWith("http") ? proxy : `http://${proxy}`;
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Enforce rate limiting delay before making a request.
   * Uses monotonic timestamps to avoid being affected by system time changes.
   */
  private async enforceRateDelay(): Promise<void> {
    if (this.rateDelayMin <= 0) return;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delay =
      this.rateDelayMax > this.rateDelayMin
        ? this.rateDelayMin +
          Math.random() * (this.rateDelayMax - this.rateDelayMin)
        : this.rateDelayMin;

    if (this.lastRequestTime > 0 && elapsed < delay) {
      const wait = delay - elapsed;
      this.logger.debug(`Rate limiting: waiting ${(wait / 1000).toFixed(1)}s`);
      await this.sleep(wait);
    }

    this.lastRequestTime = Date.now();
  }

  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  async request<T = any>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    // Enforce rate limiting before making the request
    await this.enforceRateDelay();

    const proxy = this.getNextProxy();
    if (proxy && proxy !== "localhost") {
      const agent = this.createAgent(proxy);
      config.httpAgent = agent;
      config.httpsAgent = agent;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.client.request<T>(config);
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        if (
          status &&
          [500, 502, 503, 504, 429].includes(status) &&
          attempt < this.maxRetries
        ) {
          const retryAfterMs =
            status === 429
              ? this.parseRetryAfter(error.response?.headers?.["retry-after"])
              : null;
          const backoffDelay =
            this.retryBackoff === "exponential"
              ? Math.min(
                  this.retryMaxDelay,
                  this.retryDelay * Math.pow(2, attempt),
                )
              : Math.min(this.retryMaxDelay, this.retryDelay * (attempt + 1));
          const delay =
            retryAfterMs !== null
              ? Math.min(retryAfterMs, this.retryMaxDelay)
              : backoffDelay;

          this.logger.warn(
            `Request failed with ${status}, retrying (${attempt + 1}/${this.maxRetries}) in ${delay}ms...`,
          );
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Parse a Retry-After header value (seconds or HTTP-date) into a millisecond delay.
   * Returns null if the header is absent or unparseable.
   */
  private parseRetryAfter(header: unknown): number | null {
    if (!header) return null;
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== "string" || value.trim() === "") return null;

    const seconds = Number(value);
    if (!Number.isNaN(seconds)) {
      return Math.max(0, seconds * 1000);
    }

    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }

    return null;
  }

  /** Update default headers for this client instance */
  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.client.defaults.headers.common, headers);
  }

  /** Get the underlying Axios instance for low-level access */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory to create HttpClient instances with options.
 */
/**
 * Factory to create HttpClient instances with options.
 * Can accept either HttpClientOptions or ScraperInputDto.
 */
export function createHttpClient(
  options?: HttpClientOptions | any,
): HttpClient {
  if (
    options &&
    (options.requestTimeout !== undefined || options.proxies !== undefined)
  ) {
    // It's likely a ScraperInputDto or a similar object from a scraper
    return new HttpClient({
      proxies: options.proxies,
      caCert: options.caCert,
      userAgent: options.userAgent,
      timeout: options.requestTimeout,
      retries: options.retries,
      retryDelay: options.retryDelay,
      retryBackoff: options.retryBackoff,
      retryMaxDelay: options.retryMaxDelay,
      rateDelayMin: options.rateDelayMin,
      rateDelayMax: options.rateDelayMax,
    });
  }
  return new HttpClient(options as HttpClientOptions);
}
