import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/landing/ContactForm";

const fetchMock = vi.fn<typeof fetch>();

function fillForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Example" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText(/Company/), { target: { value: "Example Team" } });
  fireEvent.change(screen.getByLabelText("How can we help?"), { target: { value: "We would like to discuss the Scale plan." } });
  return screen.getByRole("button", { name: "Send enquiry" }).closest("form")!;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("Contact form", () => {
  it("submits only form fields, locks duplicate submits, and resets after success", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ContactForm />);
    const form = fillForm();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/marketing");
    expect(options).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" }, signal: expect.anything() });
    expect(JSON.parse(options!.body as string)).toEqual({ kind: "contact", name: "Alex Example", email: "alex@example.com", company: "Example Team", message: "We would like to discuss the Scale plan.", website: "" });
    finish(Response.json({ status: "received" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your message has been received.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Work email")).toHaveValue("");
    expect(screen.getByLabelText("How can we help?")).toHaveValue("");
  });

  it.each([429, 503])("retains the enquiry on HTTP %s and allows a successful retry", async status => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Please try again shortly." }, { status }))
      .mockResolvedValueOnce(Response.json({ status: "received" }));
    render(<ContactForm />);
    const form = fillForm();
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(screen.getByLabelText("Name")).toHaveValue("Alex Example");
    expect(screen.getByLabelText("How can we help?")).toHaveValue("We would like to discuss the Scale plan.");
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeEnabled();
    fireEvent.submit(form);
    expect(await screen.findByRole("status")).toHaveTextContent("Your message has been received.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a useful fallback for non-JSON errors rather than a parser error", async () => {
    fetchMock.mockResolvedValue(new Response("<html>upstream failure</html>", { status: 502 }));
    render(<ContactForm />);
    fireEvent.submit(fillForm());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your message could not be saved. Please try again.");
    expect(screen.getByLabelText("Work email")).toHaveValue("alex@example.com");
  });

  it.each([
    { reason: new TypeError("Network unavailable"), message: "Network unavailable" },
    { reason: new DOMException("Timeout", "TimeoutError"), message: "The request timed out. Please try again." },
  ])("recovers from $reason.name without clearing input", async ({ reason, message }) => {
    fetchMock.mockRejectedValue(reason);
    render(<ContactForm />);
    fireEvent.submit(fillForm());
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(screen.getByRole("button", { name: "Send enquiry" })).toBeEnabled());
    expect(screen.getByLabelText("Work email")).toHaveValue("alex@example.com");
  });
});