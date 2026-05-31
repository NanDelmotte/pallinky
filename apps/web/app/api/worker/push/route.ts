// path: /apps/web/app/api/worker/push/route.ts
// description: push notifications worker

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Job = {
  id: string;
  event_id: string | null;
  recipient_email: string;
  type: string;
  payload: any;
  device_token: string;
};

type OutboxRow = {
  id: string;
  event_id: string | null;
  recipient_email: string;
  type: string;
  payload: any;
};

type PushTokenRow = {
  email_lc: string;
  device_token: string;
  updated_at: string | null;
  created_at: string | null;
};

type ExpoPushResult = {
  ok: boolean;
  details?: unknown;
  ticketIds?: string[];
};

type OutboxDiagnosticRow = {
  id: string;
  recipient_email: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
  payload?: any;
  has_push_token?: boolean;
  latest_token_at?: string | null;
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
  const { data, error } = await supabase.rpc("get_recent_push_notification_diagnostics", {
    p_limit: 10,
  });

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
    thread_id: row.payload?.thread_id || null,
    message_id: row.payload?.message_id || null,
    has_push_token: row.has_push_token === true,
    latest_token_at: row.latest_token_at || null,
  }));

  console.log("Push diagnostics: no pending jobs", {
    recent_push_candidate_count: rows.length,
    recent_push_candidates: rows,
  });
}

const PUSH_TYPES = [
  "invite_created",
  "chat_message_batch",
  "event_updated",
  "rsvp_received",
  "join_request_created",
  "join_request_approved",
  "join_request_denied",
  "event_cancelled",
  "host_message",
  "rsvp_deadline_reminder",
  "event_dm_message",
  "guest_rsvp_confirmation",
  "reach_out_suggestion",
  "friend_event_created",
];

async function getPendingPushJobs(supabase: any, limit = 50): Promise<Job[]> {
  const { data: tokenRows, error: tokenError } = await supabase
    .from("push_tokens")
    .select("email_lc,device_token,updated_at,created_at")
    .not("email_lc", "is", null)
    .not("device_token", "is", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (tokenError) {
    throw tokenError;
  }

  const tokenByEmail = new Map<string, string>();

  for (const tokenRow of (tokenRows || []) as PushTokenRow[]) {
    const email = tokenRow.email_lc?.toLowerCase().trim();
    const token = tokenRow.device_token?.trim();

    if (email && token && !tokenByEmail.has(email)) {
      tokenByEmail.set(email, token);
    }
  }

  const recipientEmails = Array.from(tokenByEmail.keys());

  if (recipientEmails.length === 0) {
    return [];
  }

  const { data: outboxRows, error: outboxError } = await supabase
    .from("notifications_outbox")
    .select("id,event_id,recipient_email,type,payload")
    .eq("status", "pending")
    .is("processed_at", null)
    .in("type", PUSH_TYPES)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 20, 500));

  if (outboxError) {
    throw outboxError;
  }

  const rows = (outboxRows || []) as OutboxRow[];

  return rows.flatMap((row) => {
    const email = row.recipient_email?.toLowerCase().trim();
    const deviceToken = email ? tokenByEmail.get(email) : null;

    if (!deviceToken) {
      return [];
    }

    return [
      {
        id: row.id,
        event_id: row.event_id,
        recipient_email: row.recipient_email,
        type: row.type,
        payload: row.payload,
        device_token: deviceToken,
      },
    ];
  }).slice(0, limit);
}

async function claimPushJob(supabase: any, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications_outbox")
    .update({
      processed_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .is("processed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function markPushSent(supabase: any, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications_outbox")
    .update({
      status: "sent",
      last_sent_at: now,
      last_error: null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function formatPushError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function markPushFailed(supabase: any, id: string, error: unknown): Promise<void> {
  const { error: updateError } = await supabase
    .from("notifications_outbox")
    .update({
      status: "failed",
      last_error: formatPushError(error).slice(0, 2000),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (updateError) {
    console.warn("Push failed but not marked failed", {
      id,
      error: updateError.message,
    });
  }
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
      title:
        job.payload?.chat_kind === "direct"
          ? senderName
          : job.payload?.thread_title || "New messages",
      body:
        job.payload?.body || job.payload?.preview
          ? `${senderName}: ${job.payload?.body || job.payload?.preview}`
          : `New messages in ${eventTitle}`,
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
    priority: "high",
    ttl: 60 * 60,
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

  return {
    ok: true,
    details: body,
    ticketIds: tickets.map((ticket: any) => ticket?.id).filter(Boolean),
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
    console.warn("Skipping RSVP deadline reminder enqueue", {
      error: enqueueResult.error.message,
    });
  }

  let jobs: Job[];

  try {
    jobs = await getPendingPushJobs(supabase, 50);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }

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
      const claimed = await claimPushJob(supabase, job.id);

      if (!claimed) {
        skipped++;
        continue;
      }

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
        await markPushFailed(supabase, job.id, delivery.details);
        failed++;
        continue;
      }

      console.log("Push delivery accepted", {
        id: job.id,
        type: job.type,
        event_id: job.event_id,
        ticket_ids: delivery.ticketIds || [],
      });

      const markedSent = await markPushSent(supabase, job.id);

      if (!markedSent) {
        console.warn("Push delivered but not marked sent", {
          id: job.id,
          type: job.type,
          event_id: job.event_id,
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
      await markPushFailed(supabase, job.id, err?.message || String(err));
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
