import { MOCK_UI_ENABLED } from "@/lib/mock-ui/config";

export default function MockUiNotice() {
  if (!MOCK_UI_ENABLED) return null;
  return (
    <aside aria-label="Mock UI mode" className="border-b border-primary/25 bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
      <strong>Mock UI mode</strong> · Demo data only. Changes reset on refresh. No real AI, publishing, emails or payments.
      <span className="block sm:inline"> Sign in: admin@gmail.com / Test@123</span>
    </aside>
  );
}