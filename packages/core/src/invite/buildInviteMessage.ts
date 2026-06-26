export function buildInviteMessage(input: {
  title?: string | null;
  link: string;
  ctaLabel?: string;
  hostName?: string | null;
  kind?: 'event' | 'planning_chat';
}) {
  const isPlanningChat = input.kind === 'planning_chat';
  const safeTitle = input.title?.trim() || (isPlanningChat ? 'this plan' : 'this event');
  const ctaLabel =
    input.ctaLabel?.trim() || (isPlanningChat ? 'Join the planning chat' : 'Open the invite');
  const host = input.hostName?.trim();

  if (isPlanningChat) {
    if (host) {
      return `${host} is starting a planning chat about ${safeTitle}.\n\n${ctaLabel}:\n${input.link}`;
    }

    return `Join the planning chat for ${safeTitle}.\n\n${ctaLabel}:\n${input.link}`;
  }

  if (host) {
    return `${host} invited you to ${safeTitle} 🎉\n\n${ctaLabel}:\n${input.link}`;
  }

  return `You're invited to ${safeTitle} 🎉\n\n${ctaLabel}:\n${input.link}`;
}
