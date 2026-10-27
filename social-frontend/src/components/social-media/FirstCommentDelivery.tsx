import type { SocialPostPlatform } from "@/types/social-media.types";

export function FirstCommentDelivery({ platform, state }: { platform: string; state?: SocialPostPlatform["firstCommentState"] | null }) {
  const messages = {
    pending: "First-comment delivery is pending. The post and comment have separate delivery states.",
    succeeded: "First comment published successfully.",
    failed: "The post was published, but its first comment failed. Do not republish the post to retry the comment.",
    unsupported: "Manual copy only: automatic first-comment publishing is not supported for this platform.",
    unknown: "The post was published, but comment delivery is unconfirmed. Check the platform before trying again.",
  };
  return <p role="status" className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">{state ? messages[state.status] : platform === "facebook" || platform === "instagram" ? "First comment will be attempted separately after the post publishes. Delivery depends on platform permissions." : "Manual copy only: this comment is saved with your post but will not be published automatically."}</p>;
}