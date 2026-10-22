import { useEffect, useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudioRouteWorkspace from "./StudioRouteWorkspace";

const context = vi.hoisted(() => ({ pathname: "/dashboard/content-studio", mounted: vi.fn(), unmounted: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => context.pathname }));
vi.mock("@/components/social-media/ai-studio/AIStudioPage", () => ({
  default: function Studio({ initialTab }: { initialTab: string }) {
    const [draft, setDraft] = useState("");
    useEffect(() => {
      context.mounted();
      return () => { context.unmounted(); };
    }, []);
    return (
      <section aria-label="AI Studio">
        <output aria-label="Initial tab">{initialTab}</output>
        <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      </section>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  context.pathname = "/dashboard/content-studio";
});
afterEach(cleanup);

function renderWorkspace() {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: "user-1", workspaceId: "workspace-1" } }, action) =>
        action.type === "test/identity" ? { user: action.payload } : state,
    },
  });
  const tree = () => (
    <Provider store={store}>
      <StudioRouteWorkspace><div>Original route content</div></StudioRouteWorkspace>
    </Provider>
  );
  const view = render(tree());
  return { ...view, store, navigate: (path: string) => { context.pathname = path; view.rerender(tree()); } };
}

describe("StudioRouteWorkspace", () => {
  it("preserves one studio instance and its draft across all four studio routes", () => {
    const { navigate } = renderWorkspace();
    const input = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(input, { target: { value: "Keep my generated draft" } });

    for (const [path, tab] of [
      ["/dashboard/content-studio/generate", "generate"],
      ["/dashboard/content-studio/brand-voice", "brand"],
      ["/dashboard/content-studio/media", "media"],
      ["/dashboard/content-studio", "generate"],
    ]) {
      navigate(path);
      expect(screen.getByLabelText("Initial tab").textContent).toBe(tab);
      expect(screen.getAllByRole("region", { name: "AI Studio" })).toHaveLength(1);
      expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
      expect((input as HTMLInputElement).value).toBe("Keep my generated draft");
      expect(screen.queryByText("Original route content")).toBeNull();
    }

    expect(context.mounted).toHaveBeenCalledTimes(1);
    expect(context.unmounted).not.toHaveBeenCalled();
  });

  it.each([
    ["/dashboard/content-studio", "generate"],
    ["/dashboard/content-studio/generate", "generate"],
    ["/dashboard/content-studio/brand-voice", "brand"],
    ["/dashboard/content-studio/media", "media"],
  ])("opens %s directly with the %s tab", (path, tab) => {
    context.pathname = path;
    renderWorkspace();
    expect(screen.getByLabelText("Initial tab").textContent).toBe(tab);
    expect(context.mounted).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/dashboard/content-studio/templates",
    "/dashboard/content-studio/drafts",
    "/dashboard/content-studio/templates/template-1",
    "/dashboard/content-studio/generate/details",
    "/dashboard/content-studio/media/asset-1",
    "/dashboard/content-studio/brand-voice/details",
  ])("renders original children without a studio at %s", (path) => {
    const { navigate } = renderWorkspace();
    navigate(path);
    expect(screen.getByText("Original route content")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "AI Studio" })).toBeNull();
    expect(context.mounted).toHaveBeenCalledTimes(1);
    expect(context.unmounted).toHaveBeenCalledTimes(1);
  });

  it.each([
    { id: "user-1", workspaceId: "workspace-2" },
    { id: "user-2", workspaceId: "workspace-1" },
  ])("resets studio state when identity changes to $id/$workspaceId", (identity) => {
    const { store } = renderWorkspace();
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Private draft" } });
    act(() => { store.dispatch({ type: "test/identity", payload: identity }); });
    expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("");
    expect(context.mounted).toHaveBeenCalledTimes(2);
    expect(context.unmounted).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("region", { name: "AI Studio" })).toHaveLength(1);
  });

  it("keeps draft state when the user object changes without an identity change", () => {
    const { store } = renderWorkspace();
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Keep this draft" } });
    act(() => { store.dispatch({ type: "test/identity", payload: { id: "user-1", workspaceId: "workspace-1", name: "Updated name" } }); });
    expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("Keep this draft");
    expect(context.mounted).toHaveBeenCalledTimes(1);
    expect(context.unmounted).not.toHaveBeenCalled();
  });
});