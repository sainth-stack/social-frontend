export const formatCurrencyUsd = (amount: number) =>
  amount >= 1_000_000
    ? `$${(amount / 1_000_000).toFixed(1)}M`
    : amount >= 1_000
      ? `$${(amount / 1_000).toFixed(1)}K`
      : `$${amount.toLocaleString("en-US")}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const formatChannelLabel = (channel: string) =>
  channel.charAt(0).toUpperCase() + channel.slice(1);

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
