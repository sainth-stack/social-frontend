import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import NotificationsPage from "./NotificationsPage";

afterEach(cleanup);

it("leads with an honest empty state and a working activity destination", async () => {
  const { container } = render(<NotificationsPage />);
  expect(screen.getByRole("heading", { name: "Notifications", level: 1 })).toBeTruthy();
  expect(screen.getByRole("link", { name: "View dashboard activity" }).getAttribute("href")).toBe("/dashboard");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
});