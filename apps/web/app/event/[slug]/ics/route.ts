import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

function formatICSDate(isoString: string) {
  return new Date(isoString)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(value?: string | null) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildICS(event: any) {
  const startsAt = formatICSDate(event.starts_at);
  const endsAt = event.ends_at ? formatICSDate(event.ends_at) : null;
  const stamp = formatICSDate(new Date().toISOString());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pallinky//Event//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@pallinky.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startsAt}`,
    ...(endsAt ? [`DTEND:${endsAt}`] : []),
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description || `Event details: https://pallinky.com/event/${event.slug}`)}`,
    `LOCATION:${escapeICS(event.location || '')}`,
    `URL:https://pallinky.com/event/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event?.starts_at) {
    return NextResponse.json({ error: 'Calendar file unavailable.' }, { status: 404 });
  }

  return new NextResponse(buildICS(event), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug || 'event'}.ics"`,
    },
  });
}
