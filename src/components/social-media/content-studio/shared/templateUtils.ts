export function fillTemplatePrompt(template: string, topic: string): string {
  const trimmed = topic.trim();
  return template.replace(/\{\{topic\}\}/g, trimmed || "your topic");
}
