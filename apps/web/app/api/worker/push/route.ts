// path: /apps/web/app/api/worker/push/route.ts
// description: push notifications worker

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Job = {
  id: string;
  event_id: string;
  recipient_email: string;
  type: string;
  payload: any;
  device_token: string;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin env");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function getBadgeCount(supabase: any, recipientEmail: string): Promise<number> {
  const cleanEmail = recipientEmail.toLowerCase().trim();

  const { data, error } = await supabase.rpc(
    "get_unread_badge_count_for_email",
    { p_email_lc: cleanEmail } as any
  );

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : 0;
}

function renderNotification(job: Job, badgeCount: number) {
  const eventTitle = job.payload?.event_title || "your event";
  const hostName = job.payload?.host_name || "Someone";
  const guestName = job.payload?.guest_name || "Someone";
  const senderName = job.payload?.sender_name || "Someone";
  const dmPreview = job.payload?.body || "Sent you a message";

  const contentMap: Record<string, { title: string; body: string }> = {
    invite_created: {
      title: "Invitation",
      body: `${hostName} invited you to ${eventTitle}`,
    },
    host_message: {
      title: "Message from host",
      body: `${hostName}: ${job.payload?.message || ""}`,
    },
    event_cancelled: {
      title: "Event cancelled",
      body: job.payload?.message
        ? `Cancelled: ${eventTitle} — ${job.payload.message}`
        : `${hostName} cancelled ${eventTitle}`,
    },
    chat_message_batch: {
      title: "New messages",
      body: `New messages in ${eventTitle}`,
    },
    event_updated: {
      title: "Event updated",
      body: job.payload?.final_date_chosen
        ? `A date was confirmed for ${eventTitle}`
        : `Details changed for ${eventTitle}`,
    },
    rsvp_received: {
      title: "New RSVP",
      body:
        job.payload?.response === "interested"
          ? `${guestName} is interested in ${eventTitle}`
          : job.payload?.response === "maybe"
          ? `${guestName} might come to ${eventTitle}`
          : job.payload?.response === "no"
          ? `${guestName} can't make it to ${eventTitle}`
          : `${guestName} is coming to ${eventTitle}`,
    },
    join_request_created: {
      title: "Join request",
      body: `${guestName} wants to join ${eventTitle}`,
    },
    join_request_approved: {
      title: "You're in",
      body: `${hostName} approved your request for ${eventTitle}`,
    },
    join_request_denied: {
      title: "Request declined",
      body: `${hostName} declined your request for ${eventTitle}`,
    },
    rsvp_deadline_reminder: {
      title: "RSVP reminder",
      body: `Please reply to ${eventTitle} today`,
    },
    event_dm_message: {
      title: `${senderName} sent you a message about ${eventTitle}`,
      body: dmPreview,
    },
    friend_event_created: {
      title: `${hostName} is going out - want to join?`,
      body: `${hostName} created ${eventTitle}`,
    },
  };

  const key = job.type || job.payload?.type || job.payload?.template;

  const content = contentMap[key] || {
    title: "Pallinky",
    body: "You have a new notification",
  };

  return {
    to: job.device_token,
    sound: "default",
    channelId: "default",
    badge: badgeCount,
    title: content.title,
    body: content.body,
    data: {
      event_id: job.event_id,
      type: job.type,
      message: job.payload?.message || null,
      thread_id: job.payload?.thread_id || null,
      message_id: job.payload?.message_id || null,
    },
  };
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const enqueueResult = await supabase.rpc("enqueue_final_rsvp_deadline_reminders");

  if (enqueueResult.error) {
    return NextResponse.json(
      { error: enqueueResult.error.message },
      { status: 500 }
    );
  }

  const { data, error } = await supabase.rpc("get_pending_push_notifications", {
    p_limit: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobs = (data || []) as Job[];

  let sent = 0;
  let failed = 0;

  const seen = new Set<string>();

for (const job of jobs) {
  if (seen.has(job.id)) continue;
  seen.add(job.id);

  try {
    const { data: claimed } = await supabase.rpc("mark_push_sent", { p_id: job.id });
    if (!claimed) continue;

    const badgeCount = await getBadgeCount(supabase, job.recipient_email);
  const message = renderNotification(job, badgeCount);
console.log("IS ARRAY:", Array.isArray(message));
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    sent++;
  } catch {
    failed++;
  }
}

  return NextResponse.json({
    ok: true,
    processed: jobs.length,
    sent,
    failed,
  });
}
