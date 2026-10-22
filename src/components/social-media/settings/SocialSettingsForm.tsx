"use client";

import SettingsPage from "./SettingsPage";

type Section = "general" | "schedule" | "ai" | "approval" | "notifications";

export default function SocialSettingsForm({ section }: { section: Section }) {
  return <SettingsPage section={section} />;
}
