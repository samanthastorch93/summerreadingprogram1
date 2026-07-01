import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface DigestData {
  date: Date;
  since: Date;
  newUsers: any[];
  newEntries: any[];
  finishedEntries: any[];
  newComments: any[];
  newBooks: any[];
  totalMinutes: number;
  missingDescriptions: any[];
  hiddenEntriesCount: number;
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function statusBadge(status: string): string {
  const styles: Record<string, string> = {
    finished: "background:#D1FAE5;color:#065F46;",
    reading: "background:#DBEAFE;color:#1E40AF;",
    want_to_read: "background:#FEF3C7;color:#92400E;",
    did_not_finish: "background:#FEE2E2;color:#991B1B;",
  };
  const labels: Record<string, string> = {
    finished: "Finished",
    reading: "Reading",
    want_to_read: "Want to Read",
    did_not_finish: "DNF",
  };
  const style = styles[status] ?? "background:#F3F4F6;color:#374151;";
  const label = labels[status] ?? status;
  return `<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-radius:3px;${style}">${label}</span>`;
}

function sectionTitle(text: string, color = "#0F00E3"): string {
  return `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:${color};margin:0 0 14px;">${text}</div>`;
}

function emptyState(text = "Nothing in the last 24 hours."): string {
  return `<div style="font-size:13px;color:#bbb;font-style:italic;">${text}</div>`;
}

function statCell(value: string, label: string, borderRight = true): string {
  return `<td width="25%" style="padding:18px 10px;text-align:center;${borderRight ? "border-right:1px solid #ebebeb;" : ""}">
    <div style="font-size:32px;font-weight:900;color:#0F00E3;line-height:1;">${value}</div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-top:4px;">${label}</div>
  </td>`;
}

function buildHtml(d: DigestData): string {
  const dateStr = d.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const totalHours = Math.floor(d.totalMinutes / 60);
  const remainMins = d.totalMinutes % 60;
  const timeStr = d.totalMinutes === 0
    ? "—"
    : totalHours > 0
    ? `${totalHours}h${remainMins > 0 ? ` ${remainMins}m` : ""}`
    : `${remainMins}m`;

  // New members
  const membersHtml = d.newUsers.length === 0
    ? emptyState()
    : d.newUsers.map((u: any) =>
        `<div style="font-size:13px;color:#111;margin-bottom:6px;">
          <strong>${u.display_name ?? "Unknown"}</strong>
          <span style="color:#999;"> @${u.username ?? ""}</span>
          <span style="color:#bbb;font-size:11px;"> · joined</span>
        </div>`
      ).join("");

  // Reading activity
  const activityHtml = d.newEntries.length === 0
    ? emptyState()
    : d.newEntries.map((e: any) => {
        const book = e.books as any;
        const profile = e.profiles as any;
        const note = e.note ? e.note.slice(0, 130) + (e.note.length > 130 ? "…" : "") : null;
        return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f5f5f5;">
          <div style="font-size:13px;color:#111;margin-bottom:4px;">
            <strong>${profile?.display_name ?? "Unknown"}</strong>
            <span style="color:#777;"> — <em>${book?.title ?? "Unknown"}</em></span>
            &nbsp;${statusBadge(e.status)}
          </div>
          ${note ? `<div style="font-size:12px;color:#666;padding-left:10px;border-left:2px solid #e5e5e5;margin-top:5px;line-height:1.5;">${note}</div>` : ""}
        </div>`;
      }).join("");

  // Books finished
  const finishedHtml = d.finishedEntries.length === 0
    ? emptyState()
    : d.finishedEntries.map((e: any) => {
        const book = e.books as any;
        const profile = e.profiles as any;
        return `<div style="font-size:13px;color:#111;margin-bottom:6px;">
          📖 <strong>${profile?.display_name ?? "Unknown"}</strong>
          finished <em>${book?.title ?? "Unknown"}</em>
          <span style="color:#888;"> by ${book?.author ?? "Unknown"}</span>
        </div>`;
      }).join("");

  // Comments
  const commentsHtml = d.newComments.length === 0
    ? emptyState()
    : d.newComments.map((c: any) => {
        const profile = c.profiles as any;
        const content = (c.content ?? "").slice(0, 110) + (c.content?.length > 110 ? "…" : "");
        return `<div style="font-size:13px;color:#111;margin-bottom:8px;">
          <strong>${profile?.display_name ?? "Unknown"}</strong>
          <span style="color:#777;">: "${content}"</span>
        </div>`;
      }).join("");

  // New books
  const booksHtml = d.newBooks.length === 0
    ? emptyState()
    : d.newBooks.map((b: any) =>
        `<div style="font-size:13px;color:#111;margin-bottom:6px;">
          <strong>${b.title}</strong>
          <span style="color:#888;"> by ${b.author}</span>
        </div>`
      ).join("");

  // Needs attention
  const missingHtml = d.missingDescriptions.length === 0
    ? `<div style="font-size:13px;color:#16a34a;">✓ All books have synopses.</div>`
    : `<div style="font-size:13px;color:#c2410c;font-weight:600;margin-bottom:8px;">${d.missingDescriptions.length} book${d.missingDescriptions.length === 1 ? "" : "s"} still missing synopses</div>` +
      d.missingDescriptions.slice(0, 8).map((b: any) =>
        `<div style="font-size:13px;color:#555;margin-bottom:4px;">• <strong>${b.title}</strong> <span style="color:#888;">by ${b.author}</span></div>`
      ).join("") +
      (d.missingDescriptions.length > 8
        ? `<div style="font-size:12px;color:#aaa;margin-top:4px;">…and ${d.missingDescriptions.length - 8} more</div>`
        : "");

  const hiddenHtml = d.hiddenEntriesCount > 0
    ? `<div style="font-size:13px;color:#c2410c;margin-top:10px;font-weight:600;">
        ${d.hiddenEntriesCount} entr${d.hiddenEntriesCount === 1 ? "y" : "ies"} hidden/moderated in the last 24 hours.
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Summer Reading Daily Digest</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f2f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#FBFF3C;padding:24px 28px 22px;border:2px solid #0F00E3;border-bottom:none;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:#0F00E3;margin-bottom:5px;">Summer Reading</div>
            <div style="font-size:24px;font-weight:900;color:#0F00E3;letter-spacing:-0.02em;line-height:1.1;">Daily Activity Digest</div>
            <div style="font-size:12px;color:#555;margin-top:6px;">${dateStr}</div>
          </td>
        </tr>

        <!-- Stats bar -->
        <tr>
          <td style="background:#fff;border-left:2px solid #0F00E3;border-right:2px solid #0F00E3;border-bottom:2px solid #0F00E3;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${statCell(String(d.newUsers.length), "New Users")}
                ${statCell(String(d.newEntries.length), "New Entries")}
                ${statCell(String(d.finishedEntries.length), "Finished")}
                ${statCell(timeStr, "Time Logged", false)}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Spacer -->
        <tr><td style="height:8px;"></td></tr>

        <!-- Content card -->
        <tr>
          <td style="background:#fff;border:2px solid #0F00E3;">

            <!-- New Members -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;border-bottom:1px solid #f0f0f0;">
                  ${sectionTitle("New Members")}
                  ${membersHtml}
                </td>
              </tr>
            </table>

            <!-- Reading Activity -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;border-bottom:1px solid #f0f0f0;">
                  ${sectionTitle("Reading Activity")}
                  ${activityHtml}
                </td>
              </tr>
            </table>

            <!-- Books Finished -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;border-bottom:1px solid #f0f0f0;">
                  ${sectionTitle("Books Finished")}
                  ${finishedHtml}
                </td>
              </tr>
            </table>

            <!-- Comments -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;border-bottom:1px solid #f0f0f0;">
                  ${sectionTitle(`New Comments (${d.newComments.length})`)}
                  ${commentsHtml}
                </td>
              </tr>
            </table>

            <!-- New Books -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;border-bottom:1px solid #f0f0f0;">
                  ${sectionTitle("New Books Added to Library")}
                  ${booksHtml}
                </td>
              </tr>
            </table>

            <!-- Needs Attention -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:20px 28px;background:#FFF7ED;border-top:2px solid #F97316;">
                  ${sectionTitle("Needs Attention", "#C2410C")}
                  ${missingHtml}
                  ${hiddenHtml}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 0;text-align:center;font-size:11px;color:#aaa;">
            Sent daily at 8:00 AM UTC · Summer Reading
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY secret is not configured.");
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const DIGEST_TO = "samanthastorch93@gmail.com";
  const DIGEST_FROM = Deno.env.get("DIGEST_FROM_EMAIL") ?? "onboarding@resend.dev";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const [
    { data: newUsers },
    { data: newEntries },
    { data: newComments },
    { data: newTimeLogs },
    { data: newBooks },
    { data: missingDescriptions },
    { data: hiddenEntries },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),

    supabase
      .from("reading_entries")
      .select("status, entry_type, note, created_at, books(title, author), profiles(display_name, username)")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),

    supabase
      .from("comments")
      .select("content, created_at, profiles(display_name, username)")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),

    supabase
      .from("time_logs")
      .select("minutes_added")
      .gte("created_at", sinceIso),

    supabase
      .from("books")
      .select("title, author, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),

    supabase
      .from("books")
      .select("title, author")
      .is("description", null)
      .is("source_url", null)
      .order("created_at", { ascending: true }),

    supabase
      .from("hidden_entries")
      .select("entry_id")
      .gte("created_at", sinceIso),
  ]);

  const entries = newEntries ?? [];
  const finishedEntries = entries.filter((e: any) => e.status === "finished");
  const totalMinutes = (newTimeLogs ?? []).reduce((sum: number, tl: any) => sum + (tl.minutes_added ?? 0), 0);

  const html = buildHtml({
    date: now,
    since,
    newUsers: newUsers ?? [],
    newEntries: entries,
    finishedEntries,
    newComments: newComments ?? [],
    newBooks: newBooks ?? [],
    totalMinutes,
    missingDescriptions: missingDescriptions ?? [],
    hiddenEntriesCount: (hiddenEntries ?? []).length,
  });

  const subject = `Summer Reading – Daily Digest (${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: [DIGEST_TO],
      subject,
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error("Resend error:", errText);
    return new Response(
      JSON.stringify({ error: errText }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const emailData = await emailRes.json();
  console.log(`Daily digest sent. Resend ID: ${emailData.id}`);

  return new Response(
    JSON.stringify({ sent: true, id: emailData.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
