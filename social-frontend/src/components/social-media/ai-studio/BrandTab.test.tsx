import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { BrandLogo, BrandVoice, BrandVoiceTestResult } from "@/types/social-media.types";
import { BrandTab } from "./AIStudioPage";

const mocks = vi.hoisted(() => ({ saved: vi.fn(), logos: vi.fn(), reload: vi.fn(), success: vi.fn() }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: {
  getBrandVoice: vi.fn(), saveBrandVoice: vi.fn(), testBrandVoice: vi.fn(),
  getAIModels: vi.fn(), listBrandLogos: vi.fn(), uploadLogo: vi.fn(), setDefaultBrandLogo: vi.fn(), deleteBrandLogo: vi.fn(),
} }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("./BrandLogoLibrary", () => ({
  useBrandLogos: () => ({ logos: [], setLogos: mocks.logos, loading: false, error: null, reload: mocks.reload }),
  BrandLogoLibrary: ({ onLogosChange, disabled }: { onLogosChange: (logos: unknown[]) => void; disabled: boolean }) =>
    <button type="button" disabled={disabled} onClick={() => onLogosChange([])}>Update logo immediately</button>,
  BrandLogoPickerDialog: () => null,
}));

const brand: BrandVoice = {
  id: "brand", orgId: "org-a", brandName: "Acme", industry: "Retail", tagline: "Useful everyday essentials",
  targetAudience: "Local businesses", tones: ["Friendly"], wordsToUse: ["quality", "care"],
  wordsToAvoid: ["cheap"], ctaPhrases: ["Learn more", "Contact us"], sentenceLength: "medium",
  emojiUsage: "sometimes", primaryLanguage: "en", systemPromptOverride: "Website: https://acme.test\nKeep it clear",
  logoUrl: "https://acme.test/logo.png", primaryColor: "#123456", accentColor: "#abcdef", updatedAt: "2026-10-22",
};
const previewResult: BrandVoiceTestResult = {
  platform: "linkedin", caption: "Generated caption", hashtags: [], firstComment: "",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(orgId = "org-a") {
  return render(<BrandTab orgId={orgId} brandVersion={0} onSaved={mocks.saved} />);
}
async function ready() {
  return screen.findByRole("textbox", { name: "Business name" });
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function submit() {
  fireEvent.submit(screen.getByRole("button", { name: "Save brand profile" }).closest("form")!);
}
function disabled(name: string) {
  return (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.getBrandVoice).mockResolvedValue(brand);
  vi.mocked(socialMediaApi.saveBrandVoice).mockResolvedValue(brand);
  vi.mocked(socialMediaApi.testBrandVoice).mockResolvedValue(previewResult);
  vi.mocked(socialMediaApi.listBrandLogos).mockResolvedValue([]);
  vi.mocked(socialMediaApi.getAIModels).mockResolvedValue({
    textModels: [{ id: "test-text", label: "Test text", provider: "Test", region: "us-east-1", availability: "catalogued", invokeAccessVerified: false }],
    imageModels: [], defaultTextModelId: null, defaultImageModelId: "test-image", discovery: [],
    cacheTtlSeconds: 300, invokeAccessVerified: false, message: "Test catalog",
  });
});
afterEach(cleanup);

describe("BrandTab", () => {
  it("keeps a single form-bound save/reset action bar reachable on mobile", async () => {
    mount();
    await ready();
    change("Business name", "Mobile Acme");
    const save = screen.getByRole("button", { name: "Save brand profile" });
    expect(save.closest(".mobile-action-bar")).toBeTruthy();
    expect(save.getAttribute("type")).toBe("submit");
    expect(screen.getAllByRole("button", { name: "Save brand profile" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset to saved" }));
    expect((screen.getByRole("textbox", { name: "Business name" }) as HTMLInputElement).value).toBe("Acme");
    expect(socialMediaApi.saveBrandVoice).not.toHaveBeenCalled();
  });

  it("uses Professional/never for missing brand preferences without overwriting saved explicit choices", async () => {
    const missing = { ...brand, id: null, tones: [], emojiUsage: undefined };
    vi.mocked(socialMediaApi.getBrandVoice).mockResolvedValueOnce(missing as unknown as BrandVoice);
    mount();
    await ready();
    change("Business name", "New brand");
    submit();
    await waitFor(() => expect(socialMediaApi.saveBrandVoice).toHaveBeenCalled());
    expect(vi.mocked(socialMediaApi.saveBrandVoice).mock.calls[0][1]).toMatchObject({ tones: ["Professional"], emojiUsage: "never" });
  });

  it("uses server defaults and omits the optional third preview argument", async () => {
    mount();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    await screen.findByText("Generated caption");
    expect(vi.mocked(socialMediaApi.testBrandVoice).mock.calls[0]).toHaveLength(2);
    expect(socialMediaApi.getAIModels).not.toHaveBeenCalled();
  });

  it("organizes essentials, progressive voice preferences and visual identity without a fixed sidebar", async () => {
    mount();
    await ready();
    for (const name of ["Brand essentials", "Voice preferences", "Visual identity", "Voice preview"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.queryByLabelText("Words or topics to avoid")).toBeNull();
    expect(screen.getByRole("button", { name: /Fine-tune/ }).getAttribute("aria-expanded")).toBe("false");
    expect(disabled("Save brand profile")).toBe(true);
    expect(disabled("Reset to saved")).toBe(true);
    expect(screen.queryByText(brand.tagline, { selector: "p" })).toBeNull();
    expect(screen.getByText(/Generate a sample caption/)).toBeTruthy();
  });

  it("resets every draft to the last successful save and preserves existing API mappings", async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    change("Business name", "New Acme");
    change("What you do", "New description");
    change("Website", " https://new.test ");
    await user.click(screen.getByRole("button", { name: /Fine-tune/ }));
    change("Products and keywords", " design, support, , ");
    change("Words or topics to avoid", "cheap, spam, ");
    change("Default call to action", " Book a call ");
    change("Primary", "#654321");
    submit();
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledTimes(1));
    expect(socialMediaApi.saveBrandVoice).toHaveBeenCalledWith("org-a", {
      brandName: "New Acme", industry: "Retail", tagline: "New description", targetAudience: "Local businesses",
      tones: ["Friendly"], wordsToUse: ["design", "support"], wordsToAvoid: ["cheap", "spam"],
      ctaPhrases: ["Book a call", "Contact us"], sentenceLength: "medium", emojiUsage: "sometimes", primaryLanguage: "en",
      systemPromptOverride: "Website: https://new.test\nKeep it clear", logoUrl: undefined,
      primaryColor: "#654321", accentColor: "#abcdef",
    });
    expect(disabled("Save brand profile")).toBe(true);
    change("Business name", "Discard this");
    change("Default call to action", "Discard CTA");
    change("Words or topics to avoid", "Discard avoidance");
    change("Products and keywords", "Discard products");
    change("What you do", "Discard description");
    change("Website", "Discard website");
    change("Primary", "#ffffff");
    await user.click(screen.getByRole("button", { name: "Reset to saved" }));
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("New Acme");
    expect((screen.getByLabelText("Default call to action") as HTMLInputElement).value).toBe(" Book a call ");
    expect((screen.getByLabelText("Words or topics to avoid") as HTMLInputElement).value).toBe("cheap, spam, ");
    expect((screen.getByLabelText("Products and keywords") as HTMLInputElement).value).toBe(" design, support, , ");
    expect((screen.getByLabelText("Website") as HTMLInputElement).value).toBe(" https://new.test ");
    expect((screen.getByLabelText("Primary") as HTMLInputElement).value).toBe("#654321");
    expect(disabled("Reset to saved")).toBe(true);
  });

  it("retains commas and CTA spaces while typing rather than normalizing each keystroke", async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await user.click(screen.getByRole("button", { name: /Fine-tune/ }));
    const avoid = screen.getByLabelText("Words or topics to avoid");
    await user.clear(avoid);
    await user.type(avoid, "spam, hype, ");
    expect((avoid as HTMLInputElement).value).toBe("spam, hype, ");
    const cta = screen.getByLabelText("Default call to action");
    await user.clear(cta);
    await user.type(cta, "Book a call ");
    expect((cta as HTMLInputElement).value).toBe("Book a call ");
    submit();
    await waitFor(() => expect(socialMediaApi.saveBrandVoice).toHaveBeenCalled());
    expect(vi.mocked(socialMediaApi.saveBrandVoice).mock.calls[0][1]).toMatchObject({ wordsToAvoid: ["spam", "hype"], ctaPhrases: ["Book a call", "Contact us"] });
  });

  it("keeps logo CRUD separate from profile dirty state and reset", async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await user.click(screen.getByRole("button", { name: "Update logo immediately" }));
    expect(mocks.logos).toHaveBeenCalledWith([]);
    expect(mocks.saved).toHaveBeenCalledTimes(1);
    expect(disabled("Save brand profile")).toBe(true);
    change("Industry", "New sector");
    await user.click(screen.getByRole("button", { name: "Reset to saved" }));
    expect(socialMediaApi.saveBrandVoice).not.toHaveBeenCalled();
    expect(mocks.logos).toHaveBeenCalledTimes(1);
  });

  it("has an initial load retry and does not display an old workspace after a failed switch", async () => {
    const user = userEvent.setup();
    const view = mount();
    await ready();
    vi.mocked(socialMediaApi.getBrandVoice).mockRejectedValueOnce(new Error("Offline"));
    view.rerender(<BrandTab orgId="org-b" brandVersion={0} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Business name")).toBeNull();
    vi.mocked(socialMediaApi.getBrandVoice).mockResolvedValueOnce({ ...brand, brandName: "Beta" });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await ready() as HTMLInputElement).value).toBe("Beta");
  });

  it("preserves failed save drafts and the prior saved snapshot until retry succeeds", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.saveBrandVoice).mockRejectedValueOnce(new Error("Offline"));
    mount();
    await ready();
    change("Business name", "Keep my draft");
    submit();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Keep my draft");
    expect(disabled("Save brand profile")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Reset to saved" }));
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Acme");
    change("Business name", "Retry draft");
    submit();
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("locks duplicate saves, previews, reset and all editing synchronously during save", async () => {
    const pending = deferred<BrandVoice>();
    vi.mocked(socialMediaApi.saveBrandVoice).mockReturnValue(pending.promise);
    mount();
    await ready();
    change("Business name", "Saved once");
    act(() => { submit(); submit(); fireEvent.click(screen.getByRole("button", { name: "Generate preview" })); });
    expect(socialMediaApi.saveBrandVoice).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.testBrandVoice).not.toHaveBeenCalled();
    expect(disabled("Reset to saved")).toBe(true);
    expect(disabled("Update logo immediately")).toBe(true);
    expect(screen.getByLabelText("Business name").closest("fieldset")!.disabled).toBe(true);
    await act(async () => pending.resolve(brand));
    expect(disabled("Reset to saved")).toBe(true);
  });

  it("generates a real preview independently, retries errors and never saves implicitly", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.testBrandVoice).mockRejectedValueOnce(new Error("Preview offline"));
    mount();
    await ready();
    change("Business name", "Preview draft");
    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(disabled("Save brand profile")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Retry preview" }));
    expect(await screen.findByText("Generated caption")).toBeTruthy();
    expect(screen.getByText("AI-generated from the profile above.")).toBeTruthy();
    expect(socialMediaApi.saveBrandVoice).not.toHaveBeenCalled();
    expect(socialMediaApi.testBrandVoice).toHaveBeenLastCalledWith("org-a", expect.objectContaining({ brandName: "Preview draft", logoUrl: undefined }));
    change("Business name", "Another edit");
    expect(screen.getByText(/Profile changed since this preview/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks saves and duplicate preview requests while preview is pending", async () => {
    const pending = deferred<Awaited<ReturnType<typeof socialMediaApi.testBrandVoice>>>();
    vi.mocked(socialMediaApi.testBrandVoice).mockReturnValue(pending.promise);
    mount();
    await ready();
    change("Business name", "Preview me");
    const button = screen.getByRole("button", { name: "Generate preview" });
    act(() => { fireEvent.click(button); fireEvent.click(button); submit(); });
    expect(socialMediaApi.testBrandVoice).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.saveBrandVoice).not.toHaveBeenCalled();
    expect(disabled("Reset to saved")).toBe(true);
    await act(async () => pending.resolve({ ...previewResult, caption: "Generated once" }));
    expect(await screen.findByText("Generated once")).toBeTruthy();
  });

  it("ignores an old profile load after switching workspaces", async () => {
    const pending = deferred<BrandVoice>();
    vi.mocked(socialMediaApi.getBrandVoice).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ...brand, brandName: "Beta" });
    const view = mount();
    view.rerender(<BrandTab orgId="org-b" brandVersion={0} />);
    expect((await ready() as HTMLInputElement).value).toBe("Beta");
    await act(async () => pending.resolve(brand));
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Beta");
  });

  it.each(["save", "preview"] as const)("ignores a stale %s result after switching workspaces", async (operation) => {
    const pendingSave = deferred<BrandVoice>();
    const pendingPreview = deferred<Awaited<ReturnType<typeof socialMediaApi.testBrandVoice>>>();
    vi.mocked(socialMediaApi.saveBrandVoice).mockReturnValueOnce(pendingSave.promise);
    vi.mocked(socialMediaApi.testBrandVoice).mockReturnValueOnce(pendingPreview.promise);
    const view = mount();
    await ready();
    change("Business name", "Old draft");
    if (operation === "save") submit();
    else fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    vi.mocked(socialMediaApi.getBrandVoice).mockResolvedValueOnce({ ...brand, brandName: "Beta" });
    view.rerender(<BrandTab orgId="org-b" brandVersion={0} onSaved={mocks.saved} />);
    await waitFor(() => expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Beta"));
    await act(async () => {
      pendingSave.resolve(brand);
      pendingPreview.resolve({ ...previewResult, caption: "Old caption" });
    });
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Old caption")).toBeNull();
    expect(disabled("Save brand profile")).toBe(true);
  });

  it("does not announce a late save after unmount", async () => {
    const pending = deferred<BrandVoice>();
    vi.mocked(socialMediaApi.saveBrandVoice).mockReturnValueOnce(pending.promise);
    const view = mount();
    await ready();
    change("Business name", "Unmounted draft");
    submit();
    view.unmount();
    await act(async () => pending.resolve(brand));
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("retains accessible color errors and blocks invalid save and preview payloads", async () => {
    mount();
    await ready();
    change("Primary", "#oops");
    expect(screen.getByLabelText("Primary").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter a six-digit hex color.")).toBeTruthy();
    expect(disabled("Save brand profile")).toBe(true);
    expect(disabled("Generate preview")).toBe(true);
    submit();
    expect(socialMediaApi.saveBrandVoice).not.toHaveBeenCalled();
  });

  it("passes axe with expanded voice preferences", async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await ready();
    await user.click(screen.getByRole("button", { name: /Fine-tune/ }));
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

describe("BrandLogoLibrary", () => {
  const logo: BrandLogo = { id: "logo-a", name: "Acme", url: "https://acme.test/logo.png", isDefault: false, createdAt: "2026-10-22" };

  async function library() {
    return vi.importActual<typeof import("./BrandLogoLibrary")>("./BrandLogoLibrary");
  }

  it("keeps upload, default and delete actions accessible and updates logos immediately", async () => {
    const { BrandLogoLibrary } = await library();
    const onChange = vi.fn();
    vi.mocked(socialMediaApi.setDefaultBrandLogo).mockResolvedValueOnce([{ ...logo, isDefault: true }]);
    vi.mocked(socialMediaApi.deleteBrandLogo).mockResolvedValueOnce([]);
    const { container } = render(<BrandLogoLibrary orgId="org-a" logos={[logo]} loading={false} onLogosChange={onChange} />);
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Set as default logo" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ ...logo, isDefault: true }]));
    await waitFor(() => expect(disabled("Remove logo")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]));
  });

  it("validates uploads and locks duplicate mutations while an upload is pending", async () => {
    const { BrandLogoLibrary } = await library();
    const pending = deferred<Awaited<ReturnType<typeof socialMediaApi.uploadLogo>>>();
    vi.mocked(socialMediaApi.uploadLogo).mockReturnValueOnce(pending.promise);
    vi.mocked(socialMediaApi.listBrandLogos).mockResolvedValueOnce([logo]);
    const onChange = vi.fn();
    render(<BrandLogoLibrary orgId="org-a" logos={[]} loading={false} onLogosChange={onChange} />);
    const input = screen.getByLabelText("Upload brand logo");
    fireEvent.change(input, { target: { files: [new File(["bad"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByRole("alert").textContent).toBe("Use a PNG, JPG or WebP logo");
    expect(socialMediaApi.uploadLogo).not.toHaveBeenCalled();
    const file = new File(["png"], "logo.png", { type: "image/png" });
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(socialMediaApi.uploadLogo).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.uploadLogo).toHaveBeenCalledWith("org-a", file, true);
    await act(async () => pending.resolve({ id: logo.id, logoUrl: logo.url }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([logo]));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["default", "delete"] as const)("ignores stale %s responses when the workspace changes", async (operation) => {
    const { BrandLogoLibrary } = await library();
    const pending = deferred<BrandLogo[]>();
    vi.mocked(operation === "default" ? socialMediaApi.setDefaultBrandLogo : socialMediaApi.deleteBrandLogo).mockReturnValueOnce(pending.promise);
    const onChange = vi.fn();
    const view = render(<BrandLogoLibrary orgId="org-a" logos={[logo]} loading={false} onLogosChange={onChange} />);
    const button = screen.getByRole("button", { name: operation === "default" ? "Set as default logo" : "Remove logo" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(operation === "default" ? socialMediaApi.setDefaultBrandLogo : socialMediaApi.deleteBrandLogo).toHaveBeenCalledTimes(1);
    view.rerender(<BrandLogoLibrary orgId="org-b" logos={[]} loading={false} onLogosChange={onChange} />);
    await act(async () => pending.resolve([]));
    expect(onChange).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(disabled("Upload")).toBe(false);
  });

  it("does not refresh or announce an old upload after unmount", async () => {
    const { BrandLogoLibrary } = await library();
    const pending = deferred<Awaited<ReturnType<typeof socialMediaApi.uploadLogo>>>();
    vi.mocked(socialMediaApi.uploadLogo).mockReturnValueOnce(pending.promise);
    const onChange = vi.fn();
    const view = render(<BrandLogoLibrary orgId="org-a" logos={[]} loading={false} onLogosChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Upload brand logo"), { target: { files: [new File(["png"], "logo.png", { type: "image/png" })] } });
    view.unmount();
    await act(async () => pending.resolve({ id: logo.id, logoUrl: logo.url }));
    expect(socialMediaApi.listBrandLogos).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("ignores stale logo reads and retries a failed current workspace load", async () => {
    const { useBrandLogos } = await library();
    const pending = deferred<BrandLogo[]>();
    vi.mocked(socialMediaApi.listBrandLogos).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("Offline"));
    const { result, rerender } = renderHook(({ orgId }) => useBrandLogos(orgId), { initialProps: { orgId: "org-a" } });
    rerender({ orgId: "org-b" });
    await waitFor(() => expect(result.current.error).toBe("Could not load logos"));
    await act(async () => pending.resolve([logo]));
    expect(result.current.logos).toEqual([]);
    const nextLogo: BrandLogo = { ...logo, id: "logo-b", name: "Beta" };
    vi.mocked(socialMediaApi.listBrandLogos).mockResolvedValueOnce([nextLogo]);
    await act(async () => result.current.reload());
    expect(result.current.error).toBeNull();
    expect(result.current.logos).toEqual([nextLogo]);
  });
});