import axios, { CanceledError, type InternalAxiosRequestConfig } from "axios";

import { clearSession, getStoredAccessToken } from "@/lib/auth/session";
import { MOCK_ACCESS_TOKEN, MOCK_UI_ENABLED } from "@/lib/mock-ui/config";

type RetryConfig = InternalAxiosRequestConfig & {
  apiRetry?: {
    token: string | null;
    attempted: boolean;
    originalError?: unknown;
  };
};

function isPublicAuth(url: string) {
  return ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"].some(
    (path) => url.includes(path),
  );
}

function retryDelay(error: unknown): number | null {
  if (!axios.isAxiosError(error) || axios.isCancel(error) || error.code === "ERR_CANCELED") return null;
  const status = error.response?.status;
  if (status !== undefined && ![408, 429, 500, 502, 503, 504].includes(status)) return null;
  if (status === undefined && !error.request && !["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error.code ?? "")) return null;

  const retryAfter = error.response?.headers?.["retry-after"];
  if (retryAfter === undefined) return status === 429 ? null : 250;
  const value = String(retryAfter).trim();
  const delay = /^\d+(\.\d+)?$/.test(value)
    ? Number(value) * 1000
    : /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)
      ? Math.max(0, Date.parse(value) - Date.now())
      : NaN;
  return Number.isFinite(delay) && delay <= 2000 ? delay : null;
}

function waitForRetry(delay: number, config: RetryConfig) {
  return new Promise<void>((resolve, reject) => {
    const signal = config.signal;
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", abort);
      reject(new CanceledError(undefined, config));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", abort);
      resolve();
    }, delay);
    signal?.addEventListener?.("abort", abort);
    if (signal?.aborted) abort();
  });
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  if (MOCK_UI_ENABLED) {
    config.adapter = async request => (await import("@/lib/mock-ui/adapter")).mockAdapter(request);
  } else if (config.headers.get("Authorization") === `Bearer ${MOCK_ACCESS_TOKEN}` || getStoredAccessToken() === MOCK_ACCESS_TOKEN) {
    throw new CanceledError("Mock UI sessions cannot access the backend.", config);
  }
  const retryConfig = config as RetryConfig;
  const token = getStoredAccessToken();
  if (retryConfig.apiRetry?.attempted) {
    if (token !== retryConfig.apiRetry.token) throw retryConfig.apiRetry.originalError;
    return config;
  }
  retryConfig.apiRetry = { token, attempted: false };
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const status = error.response?.status;
    const config = error.config as RetryConfig | undefined;
    const publicAuth = isPublicAuth(String(config?.url ?? ""));

    if (status === 401 && !publicAuth) {
      const token = getStoredAccessToken();
      if (token && config?.headers.get("Authorization") === `Bearer ${token}`) clearSession();
    }

    if (!config || !config.apiRetry || config.apiRetry.attempted || publicAuth) throw error;
    if (!["get", "head"].includes((config.method ?? "get").toLowerCase())) throw error;
    if (config.signal?.aborted || axios.isCancel(error)) throw error;
    const delay = retryDelay(error);
    if (delay === null || getStoredAccessToken() !== config.apiRetry.token) throw error;
    config.apiRetry.attempted = true;
    config.apiRetry.originalError = error;
    await waitForRetry(delay, config);
    if (getStoredAccessToken() !== config.apiRetry.token) throw error;
    return apiClient.request(config);
  },
);

export default apiClient;
