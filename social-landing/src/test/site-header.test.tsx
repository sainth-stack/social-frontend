import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { featureLinks, LOGIN_URL, navLinks, SIGNUP_URL } from "@/content/site";

beforeAll(() => {
  if (!window.PointerEvent) {
    class PointerEvent extends MouseEvent {
      readonly pointerType: string;
      constructor(type: string, properties: PointerEventInit = {}) {
        super(type, properties);
        this.pointerType = properties.pointerType ?? "mouse";
      }
    }
    vi.stubGlobal("PointerEvent", PointerEvent);
  }
  if (!HTMLElement.prototype.hasPointerCapture) HTMLElement.prototype.hasPointerCapture = () => false;
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {};
  if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = () => {};
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Landing header feature navigation", () => {
  it("opens with Enter, exposes the six real feature destinations and planner footer, and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Features" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(7);
    for (const feature of featureLinks) {
      const item = within(menu).getByRole("menuitem", { name: feature.label });
      expect(item).toHaveAttribute("href", feature.href);
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(item.textContent!.length).toBeGreaterThan(feature.label.length);
    }
    expect(within(menu).getByRole("menuitem", { name: "Explore planner" })).toHaveAttribute("href", "#weekly-planner");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: featureLinks[0]!.label })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: featureLinks[1]!.label })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("supports clicking a hovered trigger, selecting a destination, and outside dismissal without blocking page links", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Features" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Analytics" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    const main = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(main).getByRole("link", { name: "Contact" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    for (const link of navLinks) expect(within(main).getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", LOGIN_URL);
    for (const link of screen.getAllByRole("link", { name: "Start free" })) expect(link).toHaveAttribute("href", SIGNUP_URL);
  });

  it("keeps hover travel stable across the portal gap and closes after leaving the panel", () => {
    vi.useFakeTimers();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Features" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    const menu = screen.getByRole("menu");
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerEnter(menu, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerLeave(menu, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not reopen a dismissed hover menu on pointer leave or stale panel entry", () => {
    vi.useFakeTimers();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Features" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    const menu = screen.getByRole("menu");
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    fireEvent.keyDown(menu, { key: "Escape" });
    fireEvent.pointerEnter(menu, { pointerType: "mouse" });
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(250));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("ignores touch hover and clears a pending close on unmount", () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Features" });
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    const closeCall = timeout.mock.calls.findIndex((call) => call[1] === 180);
    expect(closeCall).toBeGreaterThanOrEqual(0);
    const closeTimer = timeout.mock.results[closeCall]!.value;
    unmount();
    expect(clear).toHaveBeenCalledWith(closeTimer);
  });
});

describe("Landing header mobile navigation", () => {
  it("opens the accessible Sheet, preserves destinations and CTAs, and closes on navigation", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /Earned\s*Voice/ });
    const mobile = within(dialog).getByRole("navigation", { name: "Mobile" });
    for (const link of [...featureLinks, ...navLinks]) expect(within(mobile).getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
    for (const feature of featureLinks) expect(within(mobile).getByRole("link", { name: feature.label }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(mobile).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", LOGIN_URL);
    expect(within(mobile).getByRole("link", { name: "Start free" })).toHaveAttribute("href", SIGNUP_URL);
    await user.click(within(mobile).getByRole("link", { name: "Weekly Planner" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Contact" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the labelled button and Escape, restoring focus to the mobile trigger", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});