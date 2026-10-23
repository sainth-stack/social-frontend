export type Business = "cafe" | "fitness" | "store";
export type Goal = "awareness" | "conversations" | "offer";

export const businesses: { id: Business; label: string }[] = [
  { id: "cafe", label: "Café" },
  { id: "fitness", label: "Fitness coach" },
  { id: "store", label: "Online store" },
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
  cafe: {
    ideas: [
      "Meet the people behind your morning coffee",
      "Three ways to make better iced coffee at home",
      "A closer look at our new cold brew",
      "From freshly ground beans to the first pour",
      "How do you take your Friday coffee?",
      "A weekend invitation to your neighbourhood café",
      "Make your Monday easier with a cold brew stop",
    ],
    hooks: ["Say hello to the team.", "Better iced coffee, three steps.", "New on the menu.", "Before the doors open…", "Quick question for you.", "Your weekend spot is ready.", "Monday, sorted."],
    captions: [
      "The faces behind your first cup. Our baristas start before sunrise so your morning starts right.",
      "Brew strong, chill fast, pour over fresh ice. Small steps, much better iced coffee at home.",
      "Your afternoon reset, poured over ice. Meet our new cold brew: slow-steeped, smooth, and ready when you are. Drop by this week and tell us how you take yours.",
      "Grinding, tamping, pouring. A quiet look at how every cup comes together.",
      "Black, oat, iced or extra hot? Tell us how you take your Friday coffee.",
      "Bring a friend, a book or nothing at all. Our tables are waiting this weekend.",
      "Start next week on a smoother note with a cold brew on your way in.",
    ],
    tags: ["#ColdBrew", "#CoffeeBreak", "#LocalCafe"],
  },
  fitness: {
    ideas: [
      "Why I started coaching (and who I help)",
      "Three warm-up moves for desk workers",
      "Inside my 6-week strength programme",
      "A morning in the studio before clients arrive",
      "What is your biggest fitness roadblock?",
      "Saturday community walk: everyone welcome",
      "Start the month with a free form check",
    ],
    hooks: ["How it started.", "Stiff back? Try these.", "Here is what we build.", "5:45 AM in the studio.", "Be honest with me.", "Lace up this weekend.", "Your first step is free."],
    captions: [
      "I coach busy people who want to feel strong without living at the gym. Here's my story.",
      "Hip circles, cat-cow and wall slides. Two minutes that make long desk days easier.",
      "Six weeks, three sessions a week, one clear plan. A look inside the programme.",
      "Mats down, music on, coffee in hand. The quiet hour before the first session.",
      "Time, motivation or knowing where to start? Tell me what gets in your way.",
      "An easy-paced group walk this Saturday. Bring a friend and meet the community.",
      "Book a short form check this month and leave with one thing to improve.",
    ],
    tags: ["#StrengthTraining", "#FitnessCoach", "#MoveDaily"],
  },
  store: {
    ideas: [
      "How our little shop got started",
      "How to style one piece three ways",
      "Spotlight: the bestselling canvas tote",
      "Packing orders on a Thursday afternoon",
      "Which colour should we restock next?",
      "Customer photos from this month",
      "Weekend bundle for first-time customers",
    ],
    hooks: ["It started at a kitchen table.", "One piece, three looks.", "Meet the tote.", "Orders going out!", "You decide.", "Look what you made.", "A small thank-you."],
    captions: [
      "What began as a weekend project is now a shop shipping across the country. Thank you for being here.",
      "Work, weekend, evening. A quick guide to getting more out of one favourite piece.",
      "Sturdy canvas, inside pocket, fits a laptop. Here's why people keep coming back to it.",
      "Tape, tissue and handwritten notes. A peek at how your order gets packed.",
      "Sage, rust or navy? Vote below and help choose our next restock.",
      "We love seeing our pieces in your everyday life. Keep tagging us.",
      "New here? This weekend's bundle is a simple way to try a few favourites.",
    ],
    tags: ["#ShopSmall", "#OnlineStore", "#NewArrivals"],
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
    caption: business === "cafe" && goal === "awareness" && i === 2 ? b.captions[i]! : `${b.captions[i]!} ${goalCta[goal]}`,
    hashtags: [...b.tags, goalTag[goal]],
    time: times[i]!,
  }));
}
