import { describe, expect, it } from "vitest";
import { resolveStartArguments } from "../../scripts/start.mjs";

const emptyEnv = { LANDING_PORT: undefined, PORT: undefined };

describe("Cross-platform landing start command", () => {
  it("keeps the production default", () => {
    expect(resolveStartArguments([], emptyEnv)).toEqual(["start", "--port", "5002"]);
  });
  it("honors LANDING_PORT before PORT", () => {
    expect(resolveStartArguments([], { LANDING_PORT: "5007", PORT: "8000" })).toEqual(["start", "--port", "5007"]);
    expect(resolveStartArguments([], { ...emptyEnv, PORT: "5008" })).toEqual(["start", "--port", "5008"]);
  });
  it.each([["--port", "3007"], ["-p", "3007"], ["--port=3007"], ["-p3007"]])("forwards an explicit port %s", (...args) => {
    expect(resolveStartArguments(args, emptyEnv)).toEqual(["start", ...args]);
  });
  it.each(["abc", "0", "65536", "3000; echo bad"])("rejects an invalid environment port %s", LANDING_PORT => {
    expect(() => resolveStartArguments([], { ...emptyEnv, LANDING_PORT })).toThrow(/integer between/);
  });
});