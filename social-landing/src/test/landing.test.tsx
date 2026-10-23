import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { WeeklyPlannerDemo } from "@/components/landing/WeeklyPlannerDemo";
import { buildPlan } from "@/content/planner";
import { CONTACT_SALES_URL, faqs, plans, platforms, seo, SIGNUP_URL, SITE_URL } from "@/content/site";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("Landing page structure and search content", () => {
  it("renders one useful H1, all section destinations and four INR plans", () => {
    const { container } = render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your next week of social content");
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(container.querySelector(link.getAttribute("href")!)).not.toBeNull();
    }
    const pricing = container.querySelector("#pricing")! as HTMLElement;
    for (const price of ["₹0", "₹499", "₹999", "₹4,999"]) expect(within(pricing).getAllByText(price).length).toBeGreaterThan(0);
    expect(container.querySelector(`a[href="${SIGNUP_URL}"]`)).not.toBeNull();
  });

  it("renders valid structured data without invented reviews or offers", () => {
    const { container } = render(<HomePage />);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(data["@graph"].map((item: { "@type": string }) => item["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|reviewCount/);
    const application = data["@graph"].find((item: { "@type": string }) => item["@type"] === "SoftwareApplication");
    expect(application.description).toBe(seo.description);
    expect(seo.description).toContain("Instagram, Facebook and LinkedIn");
    expect(seo.description).toContain("coming soon");
    expect(JSON.stringify(data)).not.toMatch(/nine|9 social/i);
  });

  it("keeps FAQ answers and comparison details in the initial document", () => {
    const { container } = render(<HomePage />);
    const question = screen.getByText("Does the planner publish posts automatically?");
    const details = question.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(details.textContent).toContain("Generating a plan does not publish it");
    expect(container.querySelector("table caption")?.textContent).toContain("monthly plan comparison");
  });

  it("distinguishes the three live integrations from six non-interactive coming-soon platforms", () => {
    expect(platforms).toHaveLength(9);
    expect(platforms.filter(platform => platform.status === "available").map(platform => platform.name)).toEqual(["Instagram", "Facebook", "LinkedIn"]);
    expect(platforms.filter(platform => platform.status === "coming-soon").map(platform => platform.name)).toEqual(["X", "Threads", "YouTube", "TikTok", "Pinterest", "Bluesky"]);
    render(<HomePage />);
    const integrationSection = document.getElementById("platforms")!;
    for (const platform of platforms) {
      const item = within(integrationSection).getByText(platform.name).closest("li")!;
      expect(item).toHaveTextContent(platform.status === "available" ? "Available now" : "Coming soon");
      expect(item.querySelector("a, button")).toBeNull();
    }
    const answer = faqs.find(faq => faq.q === "Which platforms can I use?")!.a;
    expect(answer).toContain("Instagram, Facebook and LinkedIn are available now");
    expect(answer).toContain("X, Threads, YouTube, TikTok, Pinterest and Bluesky are coming soon and cannot be connected yet");
    expect(document.body.textContent).not.toMatch(/nine social|nine channels|9 social|9 live/i);
  });

  it("routes Scale only to sales and preserves its price and tailored content allowances", () => {
    const { container } = render(<HomePage />);
    expect(plans.map(plan => plan.name)).toEqual(["Free", "Pro", "Growth", "Scale"]);
    expect(plans.map(plan => plan.price)).toEqual([0, 499, 999, 4999]);
    expect(CONTACT_SALES_URL).toBe("mailto:founder@opsbrainai.com");
    const scale = screen.getByRole("heading", { name: "Scale", level: 3 }).closest("article")!;
    expect(within(scale).getByRole("link", { name: "Contact sales" })).toHaveAttribute("href", CONTACT_SALES_URL);
    expect(scale.querySelectorAll("a")).toHaveLength(1);
    expect(scale).toHaveTextContent("no self-service checkout");
    expect(scale).toHaveTextContent("Unlimited social accounts");
    for (const allowance of ["Content allowance for your workflow", "Tailored text generation allowance", "Tailored image generation allowance"]) expect(scale).toHaveTextContent(allowance);
    expect(plans[3]).toMatchObject({ posts: "Tailored to your team", textGen: "Tailored to your team", images: "Tailored to your team" });
    const pricing = container.querySelector("#pricing")! as HTMLElement;
    for (const name of ["Start free", "Choose Pro", "Choose Growth"]) expect(within(pricing).getByRole("link", { name })).toHaveAttribute("href", SIGNUP_URL);
    expect(container.textContent).not.toMatch(/Agency|planned package|proposed package/i);
    expect(container.querySelectorAll('.lucide-sparkles, .lucide-wand, .lucide-wand-sparkles')).toHaveLength(0);
  });

  it("shows unlimited accounts in every card and comparison column without changing other allowances", () => {
    render(<HomePage />);
    expect(plans.every(plan => plan.accounts === "Unlimited")).toBe(true);
    expect(screen.getAllByText("Unlimited social accounts", { exact: true })).toHaveLength(4);
    const accountsRow = screen.getByRole("rowheader", { name: "Connected social accounts", hidden: true }).closest("tr")!;
    expect(within(accountsRow).getAllByRole("cell", { hidden: true }).map(cell => cell.textContent)).toEqual(["Unlimited", "Unlimited", "Unlimited", "Unlimited"]);
    expect(plans.slice(0, 3).map(({ posts, textGen, images, approvals }) => ({ posts, textGen, images, approvals }))).toEqual([
      { posts: "10", textGen: "30", images: "5", approvals: "Not included" },
      { posts: "100", textGen: "300", images: "50", approvals: "Included" },
      { posts: "500", textGen: "1,500", images: "200", approvals: "Included" },
    ]);
    expect(faqs.find(faq => faq.q === "How many social accounts can I connect?")!.a).toContain("Every plan includes unlimited social accounts, including Free and Scale");
  });

  it("renders local photographic previews with descriptive alternatives", () => {
    render(<HomePage />);
    for (const name of ["Friends sharing freshly prepared coffee", "Fresh coffee prepared for a café's product post"]) {
      const image = screen.getByRole("img", { name });
      expect(image).toHaveAttribute("width", "320");
      expect(image).toHaveAttribute("height", "400");
      expect(image.getAttribute("src")).toContain("images");
    }
  });

  it("generates canonical sitemap and robots URLs", () => {
    expect(sitemap()[0]?.url).toBe(SITE_URL);
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("Weekly planner behavior", () => {
  it("only offers available integrations as selectable sample channels", () => {
    const { container } = render(<WeeklyPlannerDemo />);
    const channels = container.querySelector("fieldset")!;
    expect(within(channels).getAllByRole("button").map(button => button.textContent)).toEqual(["Instagram", "Facebook", "LinkedIn"]);
    fireEvent.click(within(channels).getByRole("button", { name: "Instagram" }));
    fireEvent.click(within(channels).getByRole("button", { name: "Facebook" }));
    fireEvent.click(within(channels).getByRole("button", { name: "LinkedIn" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview my week" }));
    expect(screen.getByRole("region", { name: "Wednesday sample post" })).toHaveTextContent("LinkedIn");
  });

  it("changes the business and goal and renders the new seven-day plan", () => {
    render(<WeeklyPlannerDemo />);
    fireEvent.change(screen.getByLabelText("Your business"), { target: { value: "store" } });
    fireEvent.change(screen.getByLabelText("Your goal"), { target: { value: "conversations" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview my week" }));
    expect(screen.getByLabelText("Caption (editable)")).toHaveValue(buildPlan("store", "conversations")[2]!.caption);
    expect(screen.getByRole("status")).toHaveTextContent("Online store");
    expect(screen.getByRole("group", { name: "Days of the week" }).querySelectorAll("button")).toHaveLength(7);
  });

  it("validates empty channel selection while preserving the current plan", () => {
    render(<WeeklyPlannerDemo />);
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Facebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview my week" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one channel");
    expect(screen.getByRole("region", { name: "Wednesday sample post" })).toBeInTheDocument();
  });

  it("keeps day-specific edits and protects them on apply and reset", () => {
    render(<WeeklyPlannerDemo />);
    fireEvent.change(screen.getByLabelText("Caption (editable)"), { target: { value: "My own caption" } });
    fireEvent.click(screen.getByRole("button", { name: /Monday Brand story/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wednesday Product spotlight/ }));
    expect(screen.getByLabelText("Caption (editable)")).toHaveValue("My own caption");
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Discard");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Caption (editable)")).toHaveValue("My own caption");
    fireEvent.click(screen.getByRole("button", { name: "Preview my week" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard edits" }));
    expect(screen.getByLabelText("Caption (editable)")).toHaveValue(buildPlan("cafe", "awareness")[2]!.caption);
  });
});