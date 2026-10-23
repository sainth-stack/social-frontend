import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/marketing/route";

const origin = "https://marketing.example.com";
const contact = { kind: "contact", name: "Alex Example", email: "alex@example.com", company: "Example Team", message: "We would like to discuss the Scale plan.", website: "" };
const event = { kind: "event", event: "page_view" };
const fetchMock = vi.fn<typeof fetch>();

function request(body: unknown = contact, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/marketing`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARKETING_API_URL", "https://backend.example.com");
  vi.stubEnv("MARKETING_TRUSTED_IP_HEADER", "");
  fetchMock.mockReset().mockResolvedValue(Response.json({ status: "received", id: "private-backend-id" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Marketing proxy origin and input", () => {
  it.each(["", "null", "https://attacker.example", "https://marketing.example.com.attacker.example"])("rejects origin %s", async value => {
    expect((await POST(request(contact, { origin: value }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing Origin even with spoofed forwarding headers", async () => {
    const input = request(contact, { "x-forwarded-host": "marketing.example.com", "x-forwarded-proto": "https" });
    input.headers.delete("origin");
    expect((await POST(input)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", ""])("rejects content type %s", async value => {
    expect((await POST(request(contact, { "content-type": value }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized declared or actual bodies, including multibyte text", async () => {
    expect((await POST(request(contact, { "content-length": "16001" }))).status).toBe(413);
    expect((await POST(request(" ".repeat(16001)))).status).toBe(413);
    expect((await POST(request({ ...contact, message: "界".repeat(5400) }))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON separately from upstream JSON errors", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: "Invalid request." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { label: "null", body: null },
    { label: "array", body: [] },
    { label: "unknown kind", body: { kind: "other" } },
    { label: "unknown event", body: { kind: "event", event: "form_contents" } },
    { label: "URL data", body: { ...event, path: "/?email=private@example.com" } },
    { label: "extra identifier", body: { ...event, visitorId: "secret" } },
    { label: "empty name", body: { ...contact, name: "  " } },
    { label: "invalid email", body: { ...contact, email: "not-email" } },
    { label: "short message", body: { ...contact, message: "short" } },
    { label: "non-string company", body: { ...contact, company: 42 } },
    { label: "long name", body: { ...contact, name: "a".repeat(101) } },
    { label: "long message", body: { ...contact, message: "a".repeat(5001) } },
    { label: "long company", body: { ...contact, company: "a".repeat(161) } },
    { label: "long honeypot", body: { ...contact, website: "a".repeat(2049) } },
  ])("rejects $label without contacting backend", async ({ body }) => {
    expect((await POST(request(body))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Marketing proxy forwarding and deployment trust", () => {
  it("forwards trimmed contact fields but no cookies, authorization or untrusted IP headers", async () => {
    const response = await POST(request({ ...contact, name: "  Alex Example  ", company: "  Example Team  " }, {
      cookie: "session=secret", authorization: "Bearer secret", "x-forwarded-for": "198.51.100.9", "x-real-ip": "203.0.113.5", "cf-connecting-ip": "203.0.113.6",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "received" });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://backend.example.com/api/v1/public/contact");
    expect(options).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" }, signal: expect.anything(), cache: "no-store", redirect: "error" });
    expect(options!.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(options!.body as string)).toEqual({ name: contact.name, email: contact.email, company: contact.company, message: contact.message, website: contact.website });
  });

  it.each(["page_view", "signup_click", "contact_click"])("forwards %s with a fixed privacy-preserving path", async name => {
    expect((await POST(request({ kind: "event", event: name }))).status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://backend.example.com/api/v1/public/events");
    expect(JSON.parse(options!.body as string)).toEqual({ event: name, path: "/" });
  });

  it.each(["", "not-a-url", "ftp://backend.example.com", "https://user:password@backend.example.com", "https://backend.example.com/api", "https://backend.example.com/?token=secret", "https://backend.example.com/#secret"])("fails closed for missing or invalid production origin %s", async config => {
    vi.stubEnv("MARKETING_API_URL", config);
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permits the localhost default only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MARKETING_API_URL", "");
    expect((await POST(request())).status).toBe(200);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("http://127.0.0.1:8000/api/v1/public/contact");
  });

  it.each(["198.51.100.4", "2001:db8::4"])("forwards a single verified %s only after explicit operator configuration", async ip => {
    vi.stubEnv("MARKETING_TRUSTED_IP_HEADER", "x-verified-client-ip");
    expect((await POST(request(contact, { "x-verified-client-ip": ip, "x-forwarded-for": "203.0.113.99", "x-real-ip": "203.0.113.98" }))).status).toBe(200);
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ "Content-Type": "application/json", "X-Forwarded-For": ip });
  });

  it.each(["", "unknown", "198.51.100.4, 203.0.113.5", "198.51.100.4:1234", "999.1.2.3"])("fails closed for missing or invalid configured IP %s", async ip => {
    vi.stubEnv("MARKETING_TRUSTED_IP_HEADER", "x-verified-client-ip");
    expect((await POST(request(contact, ip ? { "x-verified-client-ip": ip } : {}))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid trusted header configuration", async () => {
    vi.stubEnv("MARKETING_TRUSTED_IP_HEADER", "invalid header");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Marketing proxy backend handling", () => {
  it.each([
    { upstream: 422, expected: 422, detail: "Check your details and try again." },
    { upstream: 429, expected: 429, detail: "Too many requests. Please try again shortly." },
    { upstream: 400, expected: 503, detail: "We could not save your request. Please try again." },
    { upstream: 401, expected: 503, detail: "We could not save your request. Please try again." },
    { upstream: 500, expected: 503, detail: "We could not save your request. Please try again." },
  ])("maps backend $upstream to $expected without leaking backend details", async ({ upstream, expected, detail }) => {
    fetchMock.mockResolvedValue(Response.json({ detail: "private database credentials" }, { status: upstream }));
    const response = await POST(request());
    expect(response.status).toBe(expected);
    expect(await response.json()).toEqual({ detail });
  });

  it.each([
    { label: "non-JSON success", response: new Response("<html>private upstream page</html>") },
    { label: "unexpected JSON", response: Response.json({ secret: "private" }) },
    { label: "null JSON", response: Response.json(null) },
    { label: "empty success", response: new Response(null, { status: 204 }) },
  ])("returns 503 for $label", async ({ response }) => {
    fetchMock.mockResolvedValue(response);
    const result = await POST(request());
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ detail: "Service unavailable. Please try again." });
  });

  it.each([
    { label: "network failure", reason: new TypeError("Private network address") },
    { label: "timeout", reason: new DOMException("Private upstream URL", "TimeoutError") },
  ])("returns sanitized 503 on $label", async ({ reason }) => {
    fetchMock.mockRejectedValue(reason);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: "Service unavailable. Please try again." });
  });
});