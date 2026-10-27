import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FirstCommentDelivery } from "./FirstCommentDelivery";

afterEach(cleanup);
describe("independent first-comment outcomes", () => {
  it.each([
    ["pending", "pending"], ["succeeded", "published successfully"],
    ["failed", "Do not republish"], ["unknown", "Check the platform"],
    ["unsupported", "Manual copy only"],
  ] as const)("shows %s without claiming comment delivery succeeded", (status, message) => {
    render(<FirstCommentDelivery platform="facebook" state={{ status, attemptCount: 1 }} />);
    expect(screen.getByRole("status").textContent).toContain(message);
  });
  it("labels LinkedIn as manual-only and Facebook as an independent delivery attempt", () => {
    const { rerender } = render(<FirstCommentDelivery platform="linkedin" />);
    expect(screen.getByRole("status").textContent).toContain("will not be published automatically");
    rerender(<FirstCommentDelivery platform="facebook" />);
    expect(screen.getByRole("status").textContent).toContain("attempted separately");
  });
});