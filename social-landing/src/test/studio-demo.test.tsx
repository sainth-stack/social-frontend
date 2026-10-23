import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioDemo } from "@/components/landing/StudioDemo";

afterEach(() => vi.unstubAllGlobals());

describe("Studio B2B sample", () => {
  it("defaults to a LinkedIn software launch with an original illustrative creative", () => {
    const { container } = render(<StudioDemo />);

    expect(screen.getByRole("button", { name: "Product launch" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("LinkedIn preview")).toBeInTheDocument();
    expect(screen.getByText("One workspace. A clearer launch.")).toBeInTheDocument();
    const brief = screen.getByText("Content brief · View sample input").closest("details");
    expect(brief).not.toHaveAttribute("open");
    expect(brief).toHaveTextContent("Introduce Northstar");
    const creative = screen.getByRole("img", { name: /Illustrative Northstar software workspace/ });
    expect(within(creative).getByText("Release checklist")).toBeInTheDocument();
    for (const task of ["Product brief", "Release checks", "Launch message"]) {
      expect(within(creative).getByText(task)).toBeInTheDocument();
    }
    expect(container.querySelector("img, video, canvas")).toBeNull();
    expect(container.textContent).not.toMatch(/Form & Field|furniture|photography|homeowner|interior/i);
    expect(screen.getByText(/Fictional Northstar sample copy/)).toHaveTextContent("not live AI generation. Review every draft before publishing.");
  });

  it("switches sample briefs and drafts locally without API calls", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<StudioDemo />);

    const choices = screen.getByRole("group", { name: "Choose a sample brief" });
    for (const [name, title, caption] of [
      ["Practical tip", "Every task needs an owner.", "Give each launch task one owner"],
      ["Brand story", "Built around the handoff.", "We are building Northstar around a simple idea"],
      ["Product launch", "One workspace. A clearer launch.", "Meet Northstar. Bring launch tasks"],
    ] as const) {
      const button = within(choices).getByRole("button", { name });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(within(choices).getAllByRole("button").filter(item => item.getAttribute("aria-pressed") === "true")).toHaveLength(1);
      const preview = document.getElementById(button.getAttribute("aria-controls")!)!;
      expect(preview).toHaveAttribute("aria-live", "polite");
      expect(within(preview).getByText(title)).toBeInTheDocument();
      expect(preview).toHaveTextContent(caption);
      expect(preview).toHaveTextContent("LinkedIn preview");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});