import axios, { AxiosError, AxiosHeaders, CanceledError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, getStoredAccessToken } from "@/lib/auth/session";
import apiClient from "./client";

vi.mock("@/lib/auth/session", () => ({
  clearSession: vi.fn(),
  getStoredAccessToken: vi.fn(),
}));

const originalAdapter = apiClient.defaults.adapter;
let token: string | null;

function response(config: InternalAxiosRequestConfig, status = 200, headers = {}): AxiosResponse {
  return { config, status, statusText: String(status), headers: new AxiosHeaders(headers), data: { ok: true } };
}

function failure(config: InternalAxiosRequestConfig, status?: number, headers = {}, code = AxiosError.ERR_NETWORK) {
  return new AxiosError("Request failed", code, config, {}, status === undefined ? undefined : response(config, status, headers));
}

function transient(status?: number, headers = {}, code = AxiosError.ERR_NETWORK) {
  let firstError: AxiosError;
  const adapter = vi.fn<AxiosAdapter>().mockImplementationOnce(async (config) => {
    firstError = failure(config, status, headers, code);
    throw firstError;
  }).mockImplementation(async (config) => response(config));
  apiClient.defaults.adapter = adapter;
  return { adapter, error: () => firstError };
}

function observed(request: Promise<unknown>) {
  return request.then((value) => ({ value, error: undefined }), (error: unknown) => ({ value: undefined, error }));
}

beforeEach(() => {
  vi.useFakeTimers();
  token = "old-token";
  vi.mocked(getStoredAccessToken).mockImplementation(() => token);
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

describe("bounded safe-read retries", () => {
  it.each([undefined, 408, 500, 502, 503, 504])("retries transient %s once after 250ms", async (status) => {
    const { adapter } = transient(status);
    const request = apiClient.get("/workspaces/one/social/posts");
    await vi.advanceTimersByTimeAsync(249);
    expect(adapter).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await request).status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].headers.get("Authorization")).toBe("Bearer old-token");
  });

  it.each(["ECONNABORTED", "ETIMEDOUT"])("retries HEAD timeout %s", async (code) => {
    const { adapter } = transient(undefined, {}, code);
    const request = apiClient.head("/health");
    await vi.runAllTimersAsync();
    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("preserves request headers, params, and timeout on retry", async () => {
    const { adapter } = transient(503);
    const request = apiClient.get("/posts", {
      headers: { "X-Workspace-Id": "workspace-one" },
      params: { page: 2 },
    });
    await vi.runAllTimersAsync();
    await request;
    const config = adapter.mock.calls[1][0];
    expect(config.headers.get("X-Workspace-Id")).toBe("workspace-one");
    expect(config.params).toEqual({ page: 2 });
    expect(config.timeout).toBe(30_000);
  });

  it("rejects the second failure without a third attempt", async () => {
    const errors: AxiosError[] = [];
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(async (config) => {
      const error = failure(config, 503);
      errors.push(error);
      throw error;
    });
    apiClient.defaults.adapter = adapter;
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(errors[1]);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["post", "put", "patch", "delete", "options"])("never replays %s", async (method) => {
    const { adapter, error } = transient(503);
    const request = observed(apiClient.request({ method, url: "/posts" }));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 404, 409, 422, 501])("does not retry HTTP %s", async (status) => {
    const { adapter, error } = transient(status);
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each(["login", "register", "forgot-password", "reset-password"])("never retries public auth %s, even GET", async (path) => {
    const { adapter } = transient(503);
    const request = observed(apiClient.get(`/auth/${path}`));
    await vi.runAllTimersAsync();
    expect((await request).error).toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does not retry Axios setup errors", async () => {
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(async (config) => {
      throw new AxiosError("Bad option", "ERR_BAD_OPTION", config);
    });
    apiClient.defaults.adapter = adapter;
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe("Retry-After", () => {
  it.each(["0", "1", "2", "0.5"])("honors %s seconds", async (value) => {
    const { adapter } = transient(429, { "retry-after": value });
    const request = apiClient.get("/posts");
    const delay = Number(value) * 1000;
    if (delay > 0) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(adapter).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
    } else await vi.runAllTimersAsync();
    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("honors an HTTP-date", async () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const { adapter } = transient(429, { "retry-after": "Thu, 22 Oct 2026 12:00:02 GMT" });
    const request = apiClient.get("/posts");
    await vi.advanceTimersByTimeAsync(1999);
    expect(adapter).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, "3", "2.001", "200", "nonsense", "", "-1"])("does not retry 429 with Retry-After %s", async (value) => {
    const { adapter, error } = transient(429, value === undefined ? {} : { "retry-after": value });
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does not retry an excessive HTTP-date", async () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const { adapter, error } = transient(429, { "retry-after": "Thu, 22 Oct 2026 12:00:03 GMT" });
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe("cancellation", () => {
  it("does not dispatch an already aborted request", async () => {
    const { adapter } = transient();
    const controller = new AbortController();
    controller.abort();
    const result = await observed(apiClient.get("/posts", { signal: controller.signal }));
    expect(axios.isCancel(result.error)).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
  });

  it("does not retry a canceled adapter request", async () => {
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(async (config) => { throw new CanceledError("Canceled", config); });
    apiClient.defaults.adapter = adapter;
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect(axios.isCancel((await request).error)).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does not retry an AxiosError with the cancellation code", async () => {
    const { adapter, error } = transient(undefined, {}, "ERR_CANCELED");
    const request = observed(apiClient.get("/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("honors abort before entering the delay", async () => {
    const controller = new AbortController();
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(async (config) => {
      controller.abort();
      throw failure(config, 503);
    });
    apiClient.defaults.adapter = adapter;
    const request = observed(apiClient.get("/posts", { signal: controller.signal }));
    await vi.runAllTimersAsync();
    expect(axios.isCancel((await request).error)).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts during the delay and removes its timer", async () => {
    const { adapter } = transient();
    const controller = new AbortController();
    const request = observed(apiClient.get("/posts", { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    expect(axios.isCancel((await request).error)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.runAllTimersAsync();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("passes the same signal to the retry and honors in-flight abort", async () => {
    const { adapter } = transient();
    const controller = new AbortController();
    adapter.mockImplementation(async (config) => new Promise((_resolve, reject) => {
      expect(config.signal).toBe(controller.signal);
      config.signal?.addEventListener?.("abort", () => reject(new CanceledError(undefined, config)));
    }));
    const request = observed(apiClient.get("/posts", { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(250);
    expect(adapter).toHaveBeenCalledTimes(2);
    controller.abort();
    expect(axios.isCancel((await request).error)).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(2);
  });
});

describe("session isolation", () => {
  it("guards a session change at the retry request interceptor", async () => {
    const { adapter, error } = transient(503);
    vi.mocked(getStoredAccessToken)
      .mockReturnValueOnce("old-token")
      .mockReturnValueOnce("old-token")
      .mockReturnValueOnce("old-token")
      .mockReturnValueOnce("new-token");
    const request = observed(apiClient.get("/workspaces/old/posts"));
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("does not replay an anonymous request after login", async () => {
    token = null;
    const { adapter, error } = transient(503);
    const request = observed(apiClient.get("/posts"));
    await vi.advanceTimersByTimeAsync(100);
    token = "new-token";
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each(["new-token", null])("rejects the original failure if session becomes %s during retry delay", async (nextToken) => {
    const { adapter, error } = transient(503);
    const request = observed(apiClient.get("/workspaces/old/posts"));
    await vi.advanceTimersByTimeAsync(100);
    token = nextToken;
    await vi.runAllTimersAsync();
    expect((await request).error).toBe(error());
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("rejects without delay when the session changed during the first request", async () => {
    let originalError: AxiosError;
    const adapter = vi.fn<AxiosAdapter>().mockImplementation(async (config) => {
      token = "new-token";
      originalError = failure(config, 503);
      throw originalError;
    });
    apiClient.defaults.adapter = adapter;
    const result = await observed(apiClient.get("/posts"));
    expect(result.error).toBe(originalError!);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["new-token", null])("does not clear session on stale 401 when current token is %s", async (nextToken) => {
    apiClient.defaults.adapter = async (config) => {
      token = nextToken;
      throw failure(config, 401);
    };
    await observed(apiClient.get("/posts"));
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("clears the session on a matching current-token 401", async () => {
    const { adapter } = transient(401);
    await observed(apiClient.get("/posts"));
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does not clear a current session for an unauthenticated old request", async () => {
    token = null;
    apiClient.defaults.adapter = async (config) => {
      token = "new-token";
      throw failure(config, 401);
    };
    await observed(apiClient.get("/posts"));
    expect(clearSession).not.toHaveBeenCalled();
  });

  it.each(["login", "register", "forgot-password", "reset-password"])("preserves the public %s 401 exclusion", async (path) => {
    const { adapter } = transient(401);
    await observed(apiClient.post(`/auth/${path}`));
    expect(clearSession).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});