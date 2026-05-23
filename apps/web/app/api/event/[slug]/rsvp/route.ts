// apps/web/app/api/event/[slug]/rsvp/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  status?: 'yes' | 'maybe' | 'no' | 'interested';
  selectedDates?: string[];
  note?: string;
  lang?: string;
};

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as Body;

    const cleanName = (body.name || '').trim();
    const cleanEmail = normalizeEmail(body.email || '');
    const cleanPhone = (body.phone || '').trim() || null;
    const selectedDates = Array.isArray(body.selectedDates) ? body.selectedDates : [];
    const note = (body.note || '').trim();
    const allowedStatuses = new Set(['yes', 'maybe', 'no', 'interested']);
    const status = allowedStatuses.has(body.status || '') ? body.status : 'interested';

    if (!cleanName) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const isFormal = event.event_type === 'formal' || !!event.starts_at;

    if (
      !isFormal &&
      Array.isArray(event.proposed_dates) &&
      event.proposed_dates.length > 0 &&
      selectedDates.length === 0
    ) {
      return NextResponse.json({ error: 'Pick at least one date.' }, { status: 400 });
    }

    let guestToken: string | null = null;
    let joinRequestCreated = false;

    if (isFormal) {
      const { data, error } = await supabase.rpc('submit_rsvp_enriched', {
        p_event_id: event.id,
        p_name: cleanName,
        p_email: cleanEmail,
        p_status: status,
        p_phone_e164: cleanPhone,
        p_message: note || null,
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Failed to save RSVP. contact support.' },
          { status: 500 }
        );
      }

      if (data?.deadline_passed) {
        return NextResponse.json(
          {
            error: 'The RSVP deadline has passed, so responses are now closed.',
            deadline_passed: true,
            rsvp_deadline: data.rsvp_deadline ?? null,
          },
          { status: 400 }
        );
      }

      if (data?.error) {
        return NextResponse.json({ error: data.error }, { status: 400 });
      }

      joinRequestCreated = data?.join_request_created === true;
      guestToken = data?.guest_token || null;

      if (joinRequestCreated) {
        const { data: requestRow } = await supabase
          .from('rsvp_join_requests')
          .select('guest_token')
          .eq('event_id', event.id)
          .eq('requester_email_lc', cleanEmail)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        guestToken = guestToken || requestRow?.guest_token || null;

        const { error: pendingConfirmError } = await supabase
          .from('notifications_outbox')
          .insert({
            event_id: event.id,
            recipient_email: cleanEmail,
            template: 'guest_rsvp_confirmation',
            type: 'guest_rsvp_confirmation',
            payload: {
              slug: event.slug,
              event_title: event.title,
              host_name: event.host_name,
              response: 'pending',
              request_pending: true,
              token: guestToken,
              lang: body.lang || null,
            },
            status: 'pending',
          });

        if (pendingConfirmError) {
          return NextResponse.json(
            { error: pendingConfirmError.message || 'Failed to queue guest confirmation.' },
            { status: 500 }
          );
        }
      } else {
        const { data: rsvpRow } = await supabase
          .from('rsvps')
          .select('guest_token')
          .eq('event_id', event.id)
          .eq('email_lc', cleanEmail)
          .maybeSingle();

        guestToken = guestToken || rsvpRow?.guest_token || null;
      }
    } else {
      const { data, error } = await supabase.rpc('submit_vibe_rsvp', {
        p_slug: slug,
        p_user_email: cleanEmail,
        p_guest_name: cleanName,
        p_selected_dates: selectedDates,
        p_note: note || null,
        p_status: 'interested',
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Failed to save RSVP. contact support.' },
          { status: 500 }
        );
      }

      if (data?.deadline_passed) {
        return NextResponse.json(
          {
            error: 'The RSVP deadline has passed, so responses are now closed.',
            deadline_passed: true,
            rsvp_deadline: data.rsvp_deadline ?? null,
          },
          { status: 400 }
        );
      }

      if (data?.error) {
        return NextResponse.json({ error: data.error }, { status: 400 });
      }

      guestToken = data?.guest_token || null;
    }

    if (!isFormal) {
      const { error: guestConfirmError } = await supabase
        .from('notifications_outbox')
        .insert({
          event_id: event.id,
          recipient_email: cleanEmail,
          template: 'guest_rsvp_confirmation',
          type: 'guest_rsvp_confirmation',
          payload: {
            slug: event.slug,
            event_title: event.title,
            host_name: event.host_name,
            response: status,
            token: guestToken,
            lang: body.lang || null,
          },
          status: 'pending',
        });

      if (guestConfirmError) {
        return NextResponse.json(
          { error: guestConfirmError.message || 'Failed to queue guest confirmation.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      deadline_passed: false,
      join_request_created: joinRequestCreated,
      guest_token: guestToken,
      redirectTo: guestToken
        ? `/event/${event.slug}/thanks?status=${joinRequestCreated ? 'pending' : status}&token=${guestToken}`
        : `/event/${event.slug}/thanks?status=${joinRequestCreated ? 'pending' : status}`,
    });
  } catch {
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
