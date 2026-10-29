import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowProgress } from "./WorkflowProgress";

afterEach(cleanup);

describe("WorkflowProgress", () => {
  it("announces the current stage and explicit completion without locking navigation", async () => {
    const change = vi.fn();
    render(<WorkflowProgress steps={[{ id: "brief", label: "Brief", complete: true }, { id: "text", label: "Text" }, { id: "visuals", label: "Visuals" }, { id: "finish", label: "Finish" }]} activeStep="text" onStepChange={change} />);
    expect(screen.getByRole("button", { name: /Text/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: /Brief.*complete/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Finish/ }));
    expect(change).toHaveBeenCalledExactlyOnceWith("finish");
  });

  it("supports keyboard navigation with no side effects on mount", async () => {
    const change = vi.fn();
    render(<WorkflowProgress steps={[{ id: "brief", label: "Brief" }, { id: "text", label: "Text" }]} activeStep="brief" onStepChange={change} />);
    expect(change).not.toHaveBeenCalled();
    screen.getByRole("button", { name: /Text/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(change).toHaveBeenCalledExactlyOnceWith("text");
  });
});