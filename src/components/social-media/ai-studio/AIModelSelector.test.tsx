import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { AIModelCatalog, AIModelSelection } from "@/types/ai-models";
import type { GeneratePostPayload } from "@/types/social-media.types";
import { AIModelSelectionProvider, AIModelSelector, useAIModelSelection } from "./AIModelSelector";

vi.mock("@/api/client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const catalog: AIModelCatalog = {
  textModels: [{ id: "openai.gpt-oss-120b-1:0", label: "GPT-OSS 120B", provider: "OpenAI", region: "us-east-1", availability: "unknown", invokeAccessVerified: false }],
  imageModels: [
    { id: "stability.sd3-5-large-v1:0", label: "Stable Diffusion 3.5 Large", provider: "Stability AI", region: "us-west-2", availability: "catalogued", invokeAccessVerified: false },
    { id: "amazon.nova-canvas-v1:0", label: "Nova Canvas (legacy)", provider: "Amazon", region: "us-east-1", availability: "unknown", invokeAccessVerified: false, warning: "Invocation may fail." },
  ],
  defaultTextModelId: null,
  defaultImageModelId: "stability.sd3-5-large-v1:0",
  discovery: [{ region: "us-east-1", foundationModels: "unavailable", inferenceProfiles: "access_denied" }],
  cacheTtlSeconds: 120,
  invokeAccessVerified: false,
  message: "Catalog presence does not verify account invoke access.",
};
const payload: GeneratePostPayload = { topic: "Launch", tone: "Friendly", platforms: ["linkedin"] };

function Consumer() {
  const selection = useAIModelSelection();
  return <><span aria-label="Selection">{JSON.stringify(selection)}</span><p>Existing generated output</p><button onClick={() => void socialMediaApi.generatePost("org-a", payload, selection)}>Create</button></>;
}

function Studio({ orgId = "org-a" }: { orgId?: string }) {
  return <AIModelSelectionProvider orgId={orgId}><AIModelSelector /><Consumer /></AIModelSelectionProvider>;
}

async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue({ data: catalog });
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AIModelSelector", () => {
  it("loads the exact workspace catalog, labels both controls and keeps server defaults", async () => {
    const view = render(<Studio />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/workspaces/org-a/social/ai-models");
    expect(screen.getByRole("combobox", { name: "Text model" }).textContent).toContain("Server default");
    expect(screen.getByRole("combobox", { name: "Image model" }).textContent).toContain("Server default");
    expect(screen.getByLabelText("Selection").textContent).toBe("{}");
    expect(apiClient.post).not.toHaveBeenCalled();
    expect((await axe(view.container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("shows real labels, provider, region and honest unknown access without generating or clearing output", async () => {
    render(<Studio />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    await choose("Text model", "GPT-OSS 120B · OpenAI");
    expect(screen.getByText(/Region: us-east-1/).textContent).toContain("Availability unknown");
    expect(screen.getByText(/Region: us-east-1/).textContent).toContain("Invocation access not verified");
    await choose("Image model", "Stable Diffusion 3.5 Large · Stability AI");
    expect(screen.getByText(/Region: us-west-2/).textContent).toContain("Listed in regional catalog");
    expect(screen.getByLabelText("Selection").textContent).toBe(JSON.stringify({ textModel: catalog.textModels[0].id, imageModel: catalog.imageModels[0].id }));
    expect(screen.getByText("Existing generated output")).toBeTruthy();
    expect(apiClient.post).not.toHaveBeenCalled();
    await choose("Image model", "Nova Canvas (legacy) · Amazon");
    expect(screen.getByText(/Invocation may fail/)).toBeTruthy();
    await choose("Text model", "Server default");
    await choose("Image model", "Server default");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/workspaces/org-a/social/generate", payload, { timeout: 120_000 });
  });

  it("offers inline retry on failure without disabling Create or the default options", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Offline"));
    render(<Studio />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(false);
    await choose("Text model", "Server default");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/workspaces/org-a/social/generate", payload, { timeout: 120_000 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    await choose("Text model", "GPT-OSS 120B · OpenAI");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("resets selections on org switches without remounting existing output", async () => {
    const view = render(<Studio />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    await choose("Text model", "GPT-OSS 120B · OpenAI");
    const output = screen.getByText("Existing generated output");
    view.rerender(<Studio orgId="org-b" />);
    expect(screen.getByLabelText("Selection").textContent).toBe("{}");
    expect(screen.getByText("Existing generated output")).toBe(output);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/api/v1/workspaces/org-b/social/ai-models"));
    view.rerender(<Studio orgId="org-a" />);
    expect(screen.getByLabelText("Selection").textContent).toBe("{}");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("ignores late catalog responses from a previous scope", async () => {
    let resolve!: (result: { data: AIModelCatalog }) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<Studio />);
    view.rerender(<Studio orgId="org-b" />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    await act(async () => resolve({ data: { ...catalog, textModels: [] } }));
    await choose("Text model", "GPT-OSS 120B · OpenAI");
    expect(screen.getByLabelText("Selection").textContent).toContain(catalog.textModels[0].id);
  });

  it("allows consumers to use server defaults without a provider", () => {
    render(<><AIModelSelector /><Consumer /></>);
    expect(screen.getByLabelText("Selection").textContent).toBe("{}");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

describe("request-local model API headers", () => {
  const selection: AIModelSelection = { textModel: catalog.textModels[0].id, imageModel: catalog.imageModels[0].id };
  const headers = { "X-AI-Text-Model": selection.textModel, "X-AI-Image-Model": selection.imageModel };

  it("snapshots concurrent selections independently and never leaks to defaults", async () => {
    const mutable = { ...selection };
    const first = socialMediaApi.generatePost("org-a", payload, mutable);
    mutable.textModel = "amazon.nova-pro-v1:0";
    const second = socialMediaApi.generateImage("org-b", { topic: "Launch" }, mutable);
    const third = socialMediaApi.generatePost("org-c", payload);
    await Promise.all([first, second, third]);
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ timeout: 120_000, headers });
    expect(vi.mocked(apiClient.post).mock.calls[1][2]).toEqual({ timeout: 150_000, headers: { ...headers, "X-AI-Text-Model": "amazon.nova-pro-v1:0" } });
    expect(vi.mocked(apiClient.post).mock.calls[2][2]).toEqual({ timeout: 120_000 });
  });

  it("passes both headers for art direction and text-only headers without adding image defaults", async () => {
    await socialMediaApi.generateImage("org-a", { topic: "Launch" }, selection);
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/workspaces/org-a/social/generate-image", { topic: "Launch", size: "1024x1024", mode: "create" }, { timeout: 150_000, headers });
    await socialMediaApi.generateImage("org-a", { topic: "Launch" }, { textModel: selection.textModel });
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 150_000, headers: { "X-AI-Text-Model": selection.textModel } });
    await socialMediaApi.generatePost("org-a", payload, { imageModel: selection.imageModel });
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 120_000, headers: { "X-AI-Image-Model": selection.imageModel } });
  });

  it("supports brand tests, slide regeneration and tweet regeneration with unchanged default configs", async () => {
    const slide = { topic: "Launch", tone: "Friendly", slideIndex: 0, totalSlides: 2, existingHeadlines: ["One", "Two"] };
    const tweet = { topic: "Launch", tone: "Friendly", tweetIndex: 0, threadContext: ["One"] };
    await socialMediaApi.testBrandVoice("org-a", undefined, selection);
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 120_000, headers });
    await socialMediaApi.regenerateSlide("org-a", slide, selection);
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 60_000, headers });
    await socialMediaApi.regenerateTweet("org-a", tweet, selection);
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 60_000, headers });
    await socialMediaApi.testBrandVoice("org-a");
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 120_000 });
    await socialMediaApi.regenerateSlide("org-a", slide, {});
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 60_000 });
    await socialMediaApi.regenerateTweet("org-a", tweet, { textModel: "default", imageModel: "default" });
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 60_000 });
    await socialMediaApi.generateImage("org-a", { topic: "Launch" });
    expect(vi.mocked(apiClient.post).mock.lastCall?.[2]).toEqual({ timeout: 150_000 });
  });
});