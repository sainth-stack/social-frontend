import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingAnalytics } from "@/components/landing/MarketingAnalytics";
import { SIGNUP_URL } from "@/content/site";

const fetchMock = vi.fn<typeof fetch>();
const originalDnt = Object.getOwnPropertyDescriptor(navigator, "doNotTrack");
const originalGpc = Object.getOwnPropertyDescriptor(navigator, "globalPrivacyControl");

function privacy(dnt: string, gpc: boolean) {
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: dnt });
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: gpc });
}

function Links() {
  return <div onClick={event => event.preventDefault()}>
    <a href={SIGNUP_URL}><span>Sign up</span></a>
    <a href="#contact"><span>Contact sales</span></a>
    <a href="#pricing">Pricing</a>
    <a href={`${SIGNUP_URL}?email=private@example.com`}>Other registration URL</a>
    <button type="button">Not a link</button>
  </div>;
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(Response.json({ status: "received" }));
  vi.stubGlobal("fetch", fetchMock);
  privacy("0", false);
});

afterEach(() => {
  for (const [key, descriptor] of [["doNotTrack", originalDnt], ["globalPrivacyControl", originalGpc]] as const) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else Reflect.deleteProperty(navigator, key);
  }
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Marketing analytics", () => {
  it("sends one Strict Mode page view and one event for each matching nested link click", () => {
    const view = render(<StrictMode><MarketingAnalytics /><Links /></StrictMode>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Sign up"));
    fireEvent.click(screen.getByText("Contact sales"));
    fireEvent.click(screen.getByText("Pricing"));
    fireEvent.click(screen.getByText("Other registration URL"));
    fireEvent.click(screen.getByText("Not a link"));
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options!.body as string))).toEqual([
      { kind: "event", event: "page_view" },
      { kind: "event", event: "signup_click" },
      { kind: "event", event: "contact_click" },
    ]);
    view.rerender(<StrictMode><MarketingAnalytics /><Links /></StrictMode>);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    { dnt: "1", gpc: false },
    { dnt: "0", gpc: true },
    { dnt: "1", gpc: true },
  ])("honors DNT=$dnt and GPC=$gpc for views and clicks", ({ dnt, gpc }) => {
    privacy(dnt, gpc);
    render(<StrictMode><MarketingAnalytics /><Links /></StrictMode>);
    fireEvent.click(screen.getByText("Sign up"));
    fireEvent.click(screen.getByText("Contact sales"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send URLs, query data, form contents, cookies or browser identifiers", () => {
    window.history.replaceState({}, "", "/?email=private@example.com#secret");
    const localRead = vi.spyOn(Storage.prototype, "getItem");
    const localWrite = vi.spyOn(Storage.prototype, "setItem");
    render(<><MarketingAnalytics /><input aria-label="Private enquiry" defaultValue="confidential customer data" /><Links /></>);
    fireEvent.click(screen.getByText("Contact sales"));
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toBe("/api/marketing");
      expect(options).toEqual({ method: "POST", headers: { "Content-Type": "application/json" }, body: expect.any(String), credentials: "omit", referrerPolicy: "no-referrer", keepalive: true });
      expect(Object.keys(JSON.parse(options!.body as string))).toEqual(["kind", "event"]);
      expect(options!.body).not.toMatch(/private|secret|confidential/);
    }
    expect(localRead).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
  });

  it("removes the document listener on unmount", () => {
    const view = render(<MarketingAnalytics />);
    view.unmount();
    const links = render(<Links />);
    fireEvent.click(screen.getByText("Sign up"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    links.unmount();
  });

  it("ignores analytics network failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Offline"));
    render(<><MarketingAnalytics /><Links /></>);
    fireEvent.click(screen.getByText("Contact sales"));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});