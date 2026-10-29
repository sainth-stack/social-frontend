import { afterEach, beforeEach, expect, vi } from "vitest";

const attempts: string[] = [];
const blocked = (transport: string): never => {
  attempts.push(transport);
  throw new Error(`Unmocked ${transport} is forbidden in planner tests`);
};

beforeEach(() => {
  attempts.length = 0;
  vi.stubGlobal("fetch", vi.fn(() => blocked("fetch")));
  vi.stubGlobal("WebSocket", class { constructor() { blocked("WebSocket"); } });
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => blocked("XMLHttpRequest"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(XMLHttpRequest.prototype.send).mockRestore();
  expect(attempts, "Planner tests must use mocked APIs only").toEqual([]);
});