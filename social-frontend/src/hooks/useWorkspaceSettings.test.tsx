import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { useWorkspaceSettings } from "./useWorkspaceSettings";
import type { SocialSettings } from "@/types/social-media.types";

vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getSettings: vi.fn(), saveSettings: vi.fn() } }));
const fixture: SocialSettings = { id: "settings", orgId: "workspace", timezone: "UTC", defaultLanguage: "en", approvalRequired: false, approverUserIds: [], approvalSlaHours: 24, approvalSlaAction: "none", defaultPostingTimes: { mon: ["09:00"] }, queueGapMinutes: 30, blackoutDates: [], defaultTone: "Friendly", defaultCta: "Learn more", hashtagCount: 5, autoFirstComment: false, imageGenerationStyle: "Photographic", openaiModel: "gpt-4o-mini", systemPromptOverride: null, enabledPlatforms: { facebook: true }, notificationEvents: { post_failed: true }, notificationDelivery: "in_app" };
function setup(level = "admin", workspaceId = "workspace") {
  const store = configureStore({ reducer: { auth: (state = { user: { id: "user", workspaceId, socialPermissionLevel: level, isPlatformAdmin: false } }, action: { type: string; payload?: string }) => action.type === "test/workspace" ? { ...state, user: { ...state.user, workspaceId: action.payload! } } : state } });
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return { ...renderHook(() => useWorkspaceSettings(), { wrapper }), store };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(socialMediaApi.getSettings).mockResolvedValue(structuredClone(fixture));
  vi.mocked(socialMediaApi.saveSettings).mockImplementation(async (_id, payload) => ({ ...fixture, ...payload }));
});
afterEach(cleanup);

describe("useWorkspaceSettings", () => {
  it("loads one workspace and starts clean", async () => {
    const { result } = setup();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.form?.timezone).toBe("UTC"));
    expect(result.current.dirty).toBe(false);
    expect(socialMediaApi.getSettings).toHaveBeenCalledWith("workspace", { force: false });
  });
  it("sends only changed editable fields", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => { result.current.patch("defaultTone", "Warm"); result.current.patch("id", "wrong"); });
    expect(result.current.dirty).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe(true); });
    expect(socialMediaApi.saveSettings).toHaveBeenCalledWith("workspace", { defaultTone: "Warm" });
    expect(result.current.dirty).toBe(false);
    expect(result.current.form?.id).toBe("settings");
  });
  it("does not call save when nothing changed and resets drafts", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    await act(async () => { expect(await result.current.save()).toBe(true); });
    expect(socialMediaApi.saveSettings).not.toHaveBeenCalled();
    act(() => result.current.patch("defaultTone", "Warm"));
    act(() => result.current.reset());
    expect(result.current.form?.defaultTone).toBe("Friendly");
    expect(result.current.dirty).toBe(false);
  });
  it("preserves failed save drafts and allows retry", async () => {
    vi.mocked(socialMediaApi.saveSettings).mockRejectedValueOnce({ response: { data: { detail: { message: "Try later" } } } });
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch("defaultTone", "Warm"));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.saveError).toBe("Try later");
    expect(result.current.dirty).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe(true); });
    expect(result.current.saveError).toBeNull();
  });
  it("recovers from a load failure with a forced read", async () => {
    vi.mocked(socialMediaApi.getSettings).mockRejectedValueOnce(new Error("Offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe("Offline"));
    expect(result.current.loading).toBe(false);
    await act(async () => result.current.reload());
    expect(socialMediaApi.getSettings).toHaveBeenLastCalledWith("workspace", { force: true });
    expect(result.current.error).toBeNull();
  });
  it("does not fetch without a workspace", async () => {
    const { result } = setup("admin", "");
    expect(result.current.loading).toBe(false);
    expect(result.current.form).toBeNull();
    expect(socialMediaApi.getSettings).not.toHaveBeenCalled();
  });
  it("blocks edits and saves for read-only members", async () => {
    const { result } = setup("viewer");
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch("defaultTone", "Warm"));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.form?.defaultTone).toBe("Friendly");
    expect(socialMediaApi.saveSettings).not.toHaveBeenCalled();
  });
  it.each([["queueGapMinutes", 0], ["approvalSlaHours", -1], ["hashtagCount", -1], ["hashtagCount", 1.5], ["hashtagCount", NaN]] as const)("rejects invalid %s values", async (key, value) => {
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch(key, value));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.saveError).toContain("whole number");
    expect(socialMediaApi.saveSettings).not.toHaveBeenCalled();
  });
  it("preserves zero hashtags", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch("hashtagCount", 0));
    await act(async () => { await result.current.save(); });
    expect(result.current.form?.hashtagCount).toBe(0);
  });
  it("prevents overlapping saves, changes and reloads", async () => {
    let finish!: (data: SocialSettings) => void;
    vi.mocked(socialMediaApi.saveSettings).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch("defaultTone", "Warm"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.save(); });
    await act(async () => { expect(await result.current.save()).toBe(false); await result.current.reload(); result.current.patch("defaultTone", "Other"); result.current.reset(); });
    expect(socialMediaApi.saveSettings).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.getSettings).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ...fixture, defaultTone: "Warm" }); await pending; });
    expect(result.current.form?.defaultTone).toBe("Warm");
  });
  it("ignores old workspace loads", async () => {
    let finish!: (data: SocialSettings) => void;
    vi.mocked(socialMediaApi.getSettings).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...fixture, orgId: "other", defaultTone: "New workspace" });
    const { result, store } = setup();
    act(() => { store.dispatch({ type: "test/workspace", payload: "other" }); });
    await waitFor(() => expect(result.current.form?.defaultTone).toBe("New workspace"));
    await act(async () => { finish(fixture); });
    expect(result.current.form?.orgId).toBe("other");
  });
  it("ignores an old workspace save", async () => {
    let finish!: (data: SocialSettings) => void;
    vi.mocked(socialMediaApi.saveSettings).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, store } = setup();
    await waitFor(() => expect(result.current.form).toBeTruthy());
    act(() => result.current.patch("defaultTone", "Old edit"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.save(); });
    act(() => { store.dispatch({ type: "test/workspace", payload: "other" }); });
    await waitFor(() => expect(result.current.saving).toBe(false));
    await act(async () => { finish({ ...fixture, defaultTone: "Old edit" }); expect(await pending).toBe(false); });
    expect(result.current.form?.defaultTone).toBe("Friendly");
  });
});