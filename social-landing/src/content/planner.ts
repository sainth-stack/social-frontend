export type Business = "software" | "agency" | "consultancy";
export type Goal = "awareness" | "conversations" | "offer";

export const businesses: { id: Business; label: string }[] = [
  { id: "software", label: "Software startup" },
  { id: "agency", label: "Marketing agency" },
  { id: "consultancy", label: "IT consultancy" },
];

export const goals: { id: Goal; label: string }[] = [
  { id: "awareness", label: "Build awareness" },
  { id: "conversations", label: "Start conversations" },
  { id: "offer", label: "Promote an offer" },
];

export const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const angles = ["Brand story", "Helpful tip", "Product spotlight", "Behind the scenes", "Conversation starter", "Community", "Gentle promotion"];
const times = ["8:30 AM", "12:00 PM", "5:30 PM", "10:00 AM", "4:00 PM", "11:00 AM", "6:00 PM"];

type Base = { ideas: string[]; hooks: string[]; captions: string[]; tags: string[] };

const base: Record<Business, Base> = {
  software: {
    ideas: [
      "Why we are building Northstar",
      "Give every launch task a clear owner",
      "Meet the Northstar launch workspace",
      "From product brief to release checklist",
      "Where does your launch handoff get stuck?",
      "An open discussion for product teams",
      "Explore the Northstar product walkthrough",
    ],
    hooks: ["A clearer path to launch.", "One task. One owner.", "Meet Northstar.", "Inside the launch checklist.", "Where do handoffs stall?", "Let’s compare launch notes.", "Take a closer look."],
    captions: [
      "We are building Northstar to bring launch tasks, owners and decisions into one workspace. Here is the thinking behind the product.",
      "Before your next launch review, give each task one owner, a due date and a clear next step.",
      "Introducing Northstar: a shared workspace for product launches. Plan tasks, assign owners and review release checklists in one place. Explore the product walkthrough.",
      "A look at how we turn a product brief into a release checklist, with space for open questions and review notes.",
      "Unclear owners, scattered feedback or last-minute approvals? Which handoff would you redesign first?",
      "Product, engineering and marketing teams: what belongs in every launch checklist? Share an idea for the discussion.",
      "Planning a release? Explore the Northstar walkthrough and see how a sample launch comes together.",
    ],
    tags: ["#Northstar", "#ProductLaunch", "#B2BSoftware"],
  },
  agency: {
    ideas: [
      "How we approach a B2B launch brief",
      "Write one message for one audience",
      "Inside a Northstar launch campaign concept",
      "From positioning notes to draft creative",
      "What slows down your campaign reviews?",
      "A discussion for B2B marketers",
      "Explore our launch planning approach",
    ],
    hooks: ["Start with the brief.", "One audience. One message.", "A launch campaign, unpacked.", "Before the first draft.", "Where does review slow down?", "Let’s exchange campaign notes.", "Plan your next launch."],
    captions: [
      "Our launch planning starts with three questions: who is this for, what problem matters and what should readers do next?",
      "Choose one buyer role before writing a launch post. Name their problem, explain the product and make the next step clear.",
      "A sample campaign concept for Northstar, a fictional software product: one launch message adapted for a product page, social post and email.",
      "Positioning notes, draft headlines and a review checklist. A look at the working documents behind a launch concept.",
      "Unclear briefs, too many reviewers or late feedback? What would make your next campaign review easier?",
      "B2B marketers: what question do you always ask before a product launch? Add it to the discussion.",
      "Preparing a software launch? Explore a sample brief and the steps we use to shape a campaign.",
    ],
    tags: ["#B2BMarketing", "#LaunchStrategy", "#MarketingAgency"],
  },
  consultancy: {
    ideas: [
      "Why we start with a technical discovery",
      "Map dependencies before a software rollout",
      "A Northstar rollout planning example",
      "Inside a technical readiness checklist",
      "What is your biggest rollout unknown?",
      "An open discussion for IT teams",
      "Explore a technical discovery outline",
    ],
    hooks: ["Understand before implementing.", "Map the dependencies first.", "Plan the rollout.", "Before deployment day.", "What still needs an answer?", "Let’s compare readiness checks.", "Start with discovery."],
    captions: [
      "We begin with your systems, constraints and open questions. That context shapes the implementation plan before any deployment work starts.",
      "List the systems, access requirements and owners involved in a rollout. Review the dependencies before setting a launch date.",
      "Using fictional software Northstar as an example, here is how we would structure access reviews, onboarding and a phased rollout.",
      "Access checks, test scenarios and rollback steps. A look at the questions in a technical readiness review.",
      "Integration scope, access controls or onboarding? Which unknown would you resolve before a rollout?",
      "IT teams: what check belongs in every rollout plan? Share a practical question for the discussion.",
      "Considering a new software rollout? Explore a sample discovery outline to frame the technical questions.",
    ],
    tags: ["#ITConsultancy", "#SoftwareRollout", "#TechnicalPlanning"],
  },
};

const goalCta: Record<Goal, string> = {
  awareness: "Follow along for more.",
  conversations: "Tell us in the comments.",
  offer: "Tap the link to see this week's offer.",
};

const goalTag: Record<Goal, string> = {
  awareness: "#MeetTheBrand",
  conversations: "#LetsTalk",
  offer: "#ThisWeekOnly",
};

export type PlanDay = { day: string; angle: string; idea: string; hook: string; caption: string; hashtags: string[]; time: string };

export function buildPlan(business: Business, goal: Goal): PlanDay[] {
  const b = base[business];
  return days.map((day, i) => ({
    day,
    angle: angles[i]!,
    idea: b.ideas[i]!,
    hook: b.hooks[i]!,
    caption: business === "software" && goal === "awareness" && i === 2 ? b.captions[i]! : `${b.captions[i]!} ${goalCta[goal]}`,
    hashtags: [...b.tags, goalTag[goal]],
    time: times[i]!,
  }));
}
