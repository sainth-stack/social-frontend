import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResponsivePhonePreview from "./ResponsivePhonePreview";

vi.mock("@/components/social-media/content-studio/PhoneFrame", () => ({ default: ({ width, children }: { width: number; children: React.ReactNode }) => <div data-testid="phone" data-width={width}>{children}</div> }));

let available = 600;
let resize: ResizeObserverCallback;
const disconnect = vi.fn();

beforeEach(() => {
  available = 600;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width: available }) as DOMRect);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("responsive phone preview", () => {
  it("uses a full 390px screen on desktop instead of a miniature phone", () => {
    render(<ResponsivePhonePreview>Readable post</ResponsivePhonePreview>);
    expect(screen.getByTestId("phone").getAttribute("data-width")).toBe("390");
    expect(screen.getByText("Readable post")).toBeTruthy();
  });

  it("fits the entire phone including bezel and side buttons in narrow columns", () => {
    available = 260;
    render(<ResponsivePhonePreview>Post</ResponsivePhonePreview>);
    const width = Number(screen.getByTestId("phone").getAttribute("data-width"));
    expect(width).toBeGreaterThan(220);
    expect(width * 1.082 + 16).toBeLessThanOrEqual(available);
  });

  it("grows when the available column grows without losing the content", () => {
    available = 280;
    render(<ResponsivePhonePreview><input aria-label="Preview content" defaultValue="Keep this" /></ResponsivePhonePreview>);
    const content = screen.getByLabelText("Preview content");
    available = 700;
    act(() => resize([], {} as ResizeObserver));
    expect(screen.getByTestId("phone").getAttribute("data-width")).toBe("390");
    expect(screen.getByLabelText("Preview content")).toBe(content);
  });

  it("waits until a hidden panel has a measurable width", () => {
    available = 0;
    render(<ResponsivePhonePreview>Post</ResponsivePhonePreview>);
    expect(screen.queryByTestId("phone")).toBeNull();
    available = 500;
    act(() => resize([], {} as ResizeObserver));
    expect(screen.getByTestId("phone")).toBeTruthy();
  });

  it("disconnects its observer on unmount", () => {
    const view = render(<ResponsivePhonePreview>Post</ResponsivePhonePreview>);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});