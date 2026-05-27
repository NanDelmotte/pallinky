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

type ExpoPushResult = {
  ok: boolean;
  details?: unknown;
};

type OutboxDiagnosticRow = {
  id: string;
  recipient_email: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
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

function maskEmail(email: string | null | undefined) {
  const value = email?.toLowerCase().trim();

  if (!value) return null;

  const [name, domain] = value.split("@");

  if (!domain) return "***";

  return `${name.slice(0, 2)}***@${domain}`;
}

async function logNoPendingPushDiagnostics(supabase: any) {
  const { data, error } = await supabase
    .from("notifications_outbox")
    .select("id, recipient_email, type, status, created_at")
    .eq("type", "friend_event_created")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.warn("Push diagnostics failed", { error: error.message });
    return;
  }

  const rows = ((data || []) as OutboxDiagnosticRow[]).map((row) => ({
    id: row.id,
    recipient_email: maskEmail(row.recipient_email),
    type: row.type,
    status: row.status,
    created_at: row.created_at,
  }));

  console.log("Push diagnostics: no pending jobs", {
    recent_friend_event_created_count: rows.length,
    recent_friend_event_created: rows,
  });
}

function renderNotification(job: Job, badgeCount: number) {
  const eventTitle = job.payload?.event_title || "your event";
  const hostName = job.payload?.host_name || "Someone";
  const guestName = job.payload?.guest_name || "Someone";
  const senderName = job.payload?.sender_name || "Someone";
  const dmPreview = job.payload?.body || "Sent you a message";
  const message = job.payload?.message || "";

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
    guest_rsvp_confirmation: {
      title: "RSVP recorded",
      body: `You're on the list for ${eventTitle}`,
    },
    reach_out_suggestion: {
      title: "New plan suggestion",
      body: message || `${guestName} suggested something for ${eventTitle}`,
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

async function sendExpoPush(message: ReturnType<typeof renderNotification>): Promise<ExpoPushResult> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  let body: any = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return { ok: false, details: body || response.statusText };
  }

  const data = body?.data;
  const tickets = Array.isArray(data) ? data : data ? [data] : [];
  const failedTicket = tickets.find((ticket: any) => ticket?.status && ticket.status !== "ok");

  if (failedTicket) {
    return { ok: false, details: failedTicket };
  }

  return { ok: true, details: body };
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

  if (jobs.length === 0) {
    await logNoPendingPushDiagnostics(supabase);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const seen = new Set<string>();

  for (const job of jobs) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);

    try {
      const badgeCount = await getBadgeCount(supabase, job.recipient_email);
      const message = renderNotification(job, badgeCount);
      const delivery = await sendExpoPush(message);

      if (!delivery.ok) {
        console.warn("Push delivery rejected", {
          id: job.id,
          type: job.type,
          event_id: job.event_id,
          details: delivery.details,
        });
        failed++;
        continue;
      }

      const { data: markedSent, error: markError } = await supabase.rpc("mark_push_sent", { p_id: job.id });

      if (markError || !markedSent) {
        console.warn("Push delivered but not marked sent", {
          id: job.id,
          type: job.type,
          event_id: job.event_id,
          error: markError?.message,
        });
        skipped++;
        continue;
      }

      sent++;
    } catch (err: any) {
      console.warn("Push delivery failed", {
        id: job.id,
        type: job.type,
        event_id: job.event_id,
        error: err?.message || String(err),
      });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: jobs.length,
    sent,
    failed,
    skipped,
  });
}
