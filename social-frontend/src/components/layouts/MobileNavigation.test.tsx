import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import MobileNavigation from "./MobileNavigation";
import { adminNavSections, dashboardNavSections } from "./nav-config";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard/posts/one" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
afterEach(cleanup);

function navigation({ admin = false, viewer = false, open = false } = {}) {
  const onMenuClick = vi.fn();
  const store = configureStore({ reducer: { auth: () => ({ user: { id: "u", name: "User", socialPermissionLevel: viewer ? "viewer" : "admin", isPlatformAdmin: admin } }) } });
  render(<Provider store={store}><MobileNavigation sections={admin ? adminNavSections : dashboardNavSections} isAdmin={admin} onMenuClick={onMenuClick} menuOpen={open} /></Provider>);
  return onMenuClick;
}

describe("Mobile destination navigation", () => {
  it.each([false, true])("uses consistent decorative Lucide icons for admin=%s", (admin) => {
    navigation({ admin });
    const nav = screen.getByRole("navigation", { name: admin ? "Mobile admin navigation" : "Mobile workspace navigation" });
    const sections = admin ? adminNavSections : dashboardNavSections;
    for (const link of within(nav).getAllByRole("link")) {
      const item = sections.flatMap((section) => section.items).find((item) => item.href === link.getAttribute("href"))!;
      const { container, unmount } = render(<item.icon />);
      expect(link.querySelector("svg")?.innerHTML).toBe(container.querySelector("svg")?.innerHTML);
      unmount();
    }
    for (const icon of nav.querySelectorAll("svg")) {
      expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.classList.contains("size-5")).toBe(true);
      expect(icon.classList.contains("shrink-0")).toBe(true);
    }
  });

  it("keeps frequent destinations and marks the parent of a nested route", () => {
    mocks.pathname = "/dashboard/posts/one";
    navigation();
    const nav = screen.getByRole("navigation", { name: "Mobile workspace navigation" });
    expect(within(nav).getByRole("link", { name: "Posts" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/dashboard");
    expect(within(nav).getByRole("link", { name: "Studio" }).getAttribute("href")).toBe("/dashboard/content-studio");
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("preserves permission filtering", () => {
    navigation({ viewer: true });
    expect(screen.queryByRole("link", { name: "Studio" })).toBeNull();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeTruthy();
  });

  it("opens the complete menu and exposes its state", async () => {
    mocks.pathname = "/dashboard/settings";
    const onMenuClick = navigation({ open: true });
    const more = screen.getByRole("button", { name: "More navigation" });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.getAttribute("aria-controls")).toBe("mobile-navigation");
    await userEvent.click(more);
    expect(onMenuClick).toHaveBeenCalledOnce();
  });

  it("provides separate admin destinations", () => {
    mocks.pathname = "/admin/ai-usage";
    navigation({ admin: true });
    expect(screen.getByRole("navigation", { name: "Mobile admin navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "AI costs" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Studio" })).toBeNull();
  });
});