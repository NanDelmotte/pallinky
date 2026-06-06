export function formatRsvpReceivedBody({
  guestName,
  eventTitle,
  response,
}: {
  guestName: string;
  eventTitle: string;
  response?: string | null;
}): string {
  if (response === 'voted') return `${guestName} voted in ${eventTitle}`;
  if (response === 'interested') return `${guestName} is interested in ${eventTitle}`;
  if (response === 'maybe') return `${guestName} might come to ${eventTitle}`;
  if (response === 'no') return `${guestName} can't make it to ${eventTitle}`;
  return `${guestName} is coming to ${eventTitle}`;
}
