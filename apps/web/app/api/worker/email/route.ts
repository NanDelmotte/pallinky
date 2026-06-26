/**
 * Path: apps/web/app/api/worker/email/route.ts
 * Description: Sends localized guest RSVP confirmation emails from notifications_outbox using a Gmail-safe table layout and tokenized event links.
 *
 * Implementation notes:
 * - Replaces hardcoded English confirmation copy with i18n translation keys
 * - Uses event-type-aware confirmation logic:
 *   - Formal / Series -> RSVP language
 *   - Poll -> Vote language
 * - Keeps web/email copy aligned by returning:
 *   - subjectKey
 *   - headlineKey
 *   - eventContextKey
 *   - supportKey
 * - Updates CTA labels:
 *   - "View your event" -> "Open the event"
 *   - "Download Pallinky for iPhone" -> "Get Pallinky for iPhone"
 * - Uses planning-chat language for Reach-out plans
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { t } from "../../../../../../packages/i18n";
import type { AppLanguage, TranslationKey } from "../../../../../../packages/i18n/types";

type EmailJob = {
  id: string;
  event_id: string;
  recipient_email: string;
  type: string;
  payload: any;
};

type ConfirmationCopyKeys = {
  subjectKey: TranslationKey;
  headlineKey: TranslationKey;
  eventContextKey: TranslationKey;
  supportKey: TranslationKey;
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

function normalizeLanguage(value?: string): AppLanguage {
  const clean = String(value || "").toLowerCase();

  if (clean.startsWith("nl")) return "nl";
  if (clean.startsWith("fr")) return "fr";
  return "en";
}

function getConfirmationCopyKeys({
  response,
  isDatePoll,
  isUpdate,
  isPlanningChat,
}: {
  response?: string;
  isDatePoll?: boolean;
  isUpdate?: boolean;
  isPlanningChat?: boolean;
}): ConfirmationCopyKeys {
  const clean = String(response || "").toLowerCase();

  if (isPlanningChat) {
    return {
      subjectKey: "planning_chat_joined_subject",
      headlineKey: "planning_chat_joined_headline",
      eventContextKey: "planning_chat_joined_event_context",
      supportKey: "planning_chat_joined_support",
    };
  }

  if (isDatePoll) {
    return isUpdate
      ? {
          subjectKey: "poll_updated_subject",
          headlineKey: "poll_updated_headline",
          eventContextKey: "poll_updated_event_context",
          supportKey: "poll_updated_support",
        }
      : {
          subjectKey: "poll_submitted_subject",
          headlineKey: "poll_submitted_headline",
          eventContextKey: "poll_submitted_event_context",
          supportKey: "poll_submitted_support",
        };
  }

  if (clean === "yes") {
    return {
      subjectKey: "formal_yes_subject",
      headlineKey: "formal_yes_headline",
      eventContextKey: "formal_yes_event_context",
      supportKey: "formal_yes_support",
    };
  }

  if (clean === "maybe") {
    return {
      subjectKey: "formal_maybe_subject",
      headlineKey: "formal_maybe_headline",
      eventContextKey: "formal_maybe_event_context",
      supportKey: "formal_maybe_support",
    };
  }

  if (clean === "no") {
    return {
      subjectKey: "formal_no_subject",
      headlineKey: "formal_no_headline",
      eventContextKey: "formal_no_event_context",
      supportKey: "formal_no_support",
    };
  }

  return {
    subjectKey: "formal_yes_subject",
    headlineKey: "formal_yes_headline",
    eventContextKey: "formal_yes_event_context",
    supportKey: "formal_yes_support",
  };
}

function renderEmail(job: EmailJob) {
  if (job.type !== "guest_rsvp_confirmation") {
    return null;
  }

  const eventTitle = job.payload?.event_title || "your event";
  const hostName = job.payload?.host_name || "Someone";
  const slug = job.payload?.slug || "";
  const response = String(job.payload?.response || "").toLowerCase();
  const token = job.payload?.token;
  const proposedDates = Array.isArray(job.payload?.proposed_dates)
    ? job.payload.proposed_dates
    : [];
  const isDatePoll = proposedDates.length > 0;
  const isPlanningChat = job.payload?.event_type === "reach_out";
  const isUpdate = job.payload?.is_update === true;
  const isPendingRequest =
    job.payload?.request_pending === true || response === "pending";
  const lang = normalizeLanguage(
    job.payload?.lang || job.payload?.locale || job.payload?.language
  );

  const copyKeys = getConfirmationCopyKeys({
    response,
    isDatePoll,
    isUpdate,
    isPlanningChat,
  });

  const subject = t(lang, copyKeys.subjectKey, {
    event: eventTitle,
    host: hostName,
  });

  const headline = isPendingRequest && isPlanningChat
    ? t(lang, "planning_chat_request_pending_headline", {
        event: eventTitle,
        host: hostName,
      })
    : isPendingRequest
    ? t(lang, "rsvp_request_pending_headline", {
        event: eventTitle,
        host: hostName,
      })
    : t(lang, copyKeys.headlineKey, {
        event: eventTitle,
        host: hostName,
      });

  const eventContext = t(lang, copyKeys.eventContextKey, {
    event: eventTitle,
    host: hostName,
  });

  const support = isPendingRequest && isPlanningChat
    ? t(lang, "planning_chat_request_pending_support", {
        event: eventTitle,
        host: hostName,
      })
    : isPendingRequest
    ? t(lang, "rsvp_request_pending_support", {
        event: eventTitle,
        host: hostName,
      })
    : t(lang, copyKeys.supportKey, {
        event: eventTitle,
        host: hostName,
      });

  const installHint = t(lang, "post_rsvp_install_hint");

  const eventPath = isPlanningChat ? `/event/${slug}/chat` : `/event/${slug}`;
  const eventUrl = slug
    ? `https://pallinky.com${eventPath}${token ? `?token=${token}` : ""}`
    : "https://pallinky.com";
  const eventCta = isPlanningChat ? "Open planning chat" : "Open the event";

  return {
    subject,
    html: `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F6F7F9;margin:0;padding:32px 16px;font-family:Arial,ui-sans-serif,system-ui,sans-serif;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:#FFFFFF;border:1px solid #e7ede2;border-radius:20px;">
              <tr>
                <td style="padding:32px 28px 12px 28px;text-align:center;font-size:18px;font-weight:600;color:#1f2a1b;">
                  ${eventContext}
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 12px 28px;text-align:center;font-size:34px;line-height:1.1;font-weight:900;color:#1f2a1b;">
                  ${headline}
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 24px 28px;text-align:center;font-size:16px;line-height:1.5;color:#66715f;">
                  ${support}
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 14px 28px;">
                  <a
                    href="${eventUrl}"
                    style="display:block;width:100%;box-sizing:border-box;background-color:#43691b;color:#FFFFFF;text-decoration:none;text-align:center;font-size:16px;font-weight:800;line-height:1.2;padding:16px 20px;border-radius:14px;"
                  >
                    ${eventCta}
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 14px 28px;">
                  <a
                    href="https://apps.apple.com/app/pallinky/id6760797135"
                    target="_blank"
                    rel="noreferrer"
                    style="display:block;width:100%;box-sizing:border-box;background-color:#FFFFFF;color:#43691b;text-decoration:none;text-align:center;font-size:16px;font-weight:800;line-height:1.2;padding:16px 20px;border-radius:14px;border:2px solid #43691b;"
                  >
                    Get Pallinky for iPhone
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:4px 28px 18px 28px;text-align:center;font-size:13px;line-height:1.5;color:#66715f;">
                  ${installHint}
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 18px 28px;text-align:center;font-size:13px;line-height:1.5;color:#66715f;">
                  On Android? Send an email to nanbowles@gmail.com and we’ll add you to the beta.
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 32px 28px;text-align:center;font-size:13px;line-height:1.5;color:#8a9487;">
                  Pallinky is a small, independent project. If you have any feedback or want to say hi, send us an email at nanbowles@gmail.com. We read and respond to every message.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  };
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await supabase
    .from("notifications_outbox")
    .select("id, event_id, recipient_email, type, payload")
    .eq("status", "pending")
    .eq("type", "guest_rsvp_confirmation")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobs = (data || []) as EmailJob[];

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const email = renderEmail(job);

      if (!email) {
        continue;
      }

      await resend.emails.send({
        from: "notifications@pallinky.com",
        to: job.recipient_email,
        subject: email.subject,
        html: email.html,
      });

      await supabase.rpc("mark_push_sent", { p_id: job.id });

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
