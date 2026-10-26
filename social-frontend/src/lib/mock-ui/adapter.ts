import { AxiosError, AxiosHeaders, CanceledError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { MOCK_ACCESS_TOKEN } from "./config";
import { handleAdminMock } from "./admin";
import { handleSocialMock } from "./social";
import { handlePlannerMock } from "./planner";

const identity = {
  user: { id: "mock-admin", email: "admin@gmail.com", full_name: "Demo Admin", is_active: true, is_platform_admin: true },
  workspaces: [{ id: "mock-workspace", name: "Demo Northstar Studio", plan: "enterprise", role: "owner", social_level: "admin" }],
};

function failure(config: InternalAxiosRequestConfig, status: number, detail: string): never {
  throw new AxiosError(detail, status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", config, undefined, {
    config, status, statusText: String(status), headers: new AxiosHeaders(), data: { detail },
  });
}

export const mockAdapter: AxiosAdapter = async config => {
  if (config.signal?.aborted) throw new CanceledError(undefined, config);
  const url = new URL(config.url ?? "", "http://mock-ui.invalid");
  const path = url.pathname.replace(/\/$/, "");
  const method = (config.method ?? "get").toUpperCase();
  const params = Object.fromEntries(url.searchParams);
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined && value !== null) params[key] = String(value);
  }
  let body: Record<string, unknown> = {};
  if (typeof config.data === "string") {
    try { body = JSON.parse(config.data); } catch { failure(config, 400, "Mock UI: invalid request body."); }
  } else if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    body = Object.fromEntries(config.data.entries());
  } else if (config.data && typeof config.data === "object") {
    body = config.data;
  }
  let data: unknown;
  if (path === "/api/v1/auth/login" && method === "POST") {
    if (String(body.email ?? "").trim().toLowerCase() !== "admin@gmail.com" || body.password !== "Test@123") {
      failure(config, 401, "Mock UI: sign in with admin@gmail.com and Test@123.");
    }
    data = { ...identity, access_token: MOCK_ACCESS_TOKEN, token_type: "bearer" };
  } else if (path === "/api/v1/auth/google/status" && method === "GET") {
    data = { enabled: false };
  } else if (path.startsWith("/api/v1/auth/") && path !== "/api/v1/auth/me") {
    failure(config, 403, "Mock UI: registration, password emails and external sign-in are disabled. Use the demo login.");
  } else {
    if (config.headers.get("Authorization") !== `Bearer ${MOCK_ACCESS_TOKEN}`) failure(config, 401, "Mock UI: sign in with the demo account.");
    if (path === "/api/v1/auth/me" && method === "GET") {
      data = identity;
    } else {
      try {
        data = handlePlannerMock(path, method, params, body);
        if (data === undefined) data = handleSocialMock(path, method, params, body);
        if (data === undefined) data = handleAdminMock(path, method, params, body);
      } catch (error) {
        failure(config, 400, error instanceof Error ? error.message : "Mock UI: this action is unavailable.");
      }
    }
  }
  if (data === undefined) failure(config, 501, `Mock UI: ${method} ${path} is not simulated. No backend request was sent.`);
  return { config, status: 200, statusText: "OK", headers: new AxiosHeaders({ "X-Mock-UI": "true" }), data: structuredClone(data) };
};