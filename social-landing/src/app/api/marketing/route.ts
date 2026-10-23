import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const payloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contact"),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).nullish(),
    message: z.string().trim().min(10).max(5000),
    website: z.string().trim().max(2048).nullish(),
  }).strict(),
  z.object({
    kind: z.literal("event"),
    event: z.enum(["page_view", "signup_click", "contact_click"]),
  }).strict(),
]);

function unavailable() {
  return NextResponse.json({ detail: "Service unavailable. Please try again." }, { status: 503 });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ detail: "Expected JSON." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 16000) {
    return NextResponse.json({ detail: "Request too large." }, { status: 413 });
  }

  let input: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 16000) return NextResponse.json({ detail: "Request too large." }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ detail: "Invalid request." }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ detail: "Check your details and try again." }, { status: 422 });

  try {
    const configuredBackend = process.env.MARKETING_API_URL?.trim();
    if (!configuredBackend && process.env.NODE_ENV === "production") return unavailable();
    const backend = new URL(configuredBackend || "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.pathname !== "/" || backend.search || backend.hash) return unavailable();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const trustedHeader = process.env.MARKETING_TRUSTED_IP_HEADER?.trim();
    if (trustedHeader) {
      if (!/^[a-z0-9-]+$/i.test(trustedHeader)) return unavailable();
      const ip = request.headers.get(trustedHeader)?.trim();
      if (!ip || !isIP(ip)) return unavailable();
      headers["X-Forwarded-For"] = ip;
    }
    const payload = parsed.data;
    const endpoint = payload.kind === "contact" ? "contact" : "events";
    const body = payload.kind === "contact"
      ? { name: payload.name, email: payload.email, company: payload.company, message: payload.message, website: payload.website }
      : { event: payload.event, path: "/" };
    const response = await fetch(new URL(`/api/v1/public/${endpoint}`, backend), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      const status = [422, 429].includes(response.status) ? response.status : 503;
      return NextResponse.json({ detail: status === 429 ? "Too many requests. Please try again shortly." : status === 422 ? "Check your details and try again." : "We could not save your request. Please try again." }, { status });
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== "received") return unavailable();
    return NextResponse.json({ status: "received" });
  } catch {
    return unavailable();
  }
}