export function buildInviteMessage(input: {
  title?: string | null;
  link: string;
  ctaLabel?: string;
  hostName?: string | null;
}) {
  const safeTitle = input.title?.trim() || 'this event';
  const ctaLabel = input.ctaLabel?.trim() || 'Open the invite';
  const host = input.hostName?.trim();

  if (host) {
    return `${host} invited you to ${safeTitle} 🎉\n\n${ctaLabel}:\n${input.link}`;
  }

  return `You're invited to ${safeTitle} 🎉\n\n${ctaLabel}:\n${input.link}`;
}