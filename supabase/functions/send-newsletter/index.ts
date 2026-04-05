// supabase/functions/send-newsletter/index.ts
//
// Deploy with:  supabase functions deploy send-newsletter
// Set secrets:  supabase secrets set RESEND_API_KEY=re_xxxxx
//               supabase secrets set FROM_EMAIL=newsletter@acerbooks.ca
//
// Resend free tier: https://resend.com  (100 emails/day, no credit card)
// -----------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ── Auth: only admins may call this ──────────────────────────────
        const authHeader = req.headers.get('Authorization') ?? '';
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role bypasses RLS
        );

        // Verify the caller is an admin
        const supabaseUser = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Admin only' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Parse request ────────────────────────────────────────────────
        const { newsItemId } = await req.json();
        if (!newsItemId) {
            return new Response(JSON.stringify({ error: 'newsItemId required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Load the news item ───────────────────────────────────────────
        const { data: item, error: itemErr } = await supabaseAdmin
            .from('news').select('*').eq('id', newsItemId).single();
        if (itemErr || !item) {
            return new Response(JSON.stringify({ error: 'News item not found' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Load active subscribers ──────────────────────────────────────
        const { data: subscribers, error: subErr } = await supabaseAdmin
            .from('subscribers').select('email, user_id').eq('status', 'active');
        if (subErr) throw subErr;
        if (!subscribers?.length) {
            return new Response(JSON.stringify({ sent: 0, message: 'No active subscribers' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Send via Resend ──────────────────────────────────────────────
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'newsletter@acerbooks.ca';
        const SITE_URL       = 'https://acerbooks.ca';

        if (!RESEND_API_KEY) {
            return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const titleEn   = typeof item.title   === 'object' ? (item.title?.en   ?? '') : (item.title   ?? '');
        const summaryEn = typeof item.summary === 'object' ? (item.summary?.en ?? '') : (item.summary ?? '');
        const titleFr   = typeof item.title   === 'object' ? (item.title?.fr   ?? '') : '';
        const summaryFr = typeof item.summary === 'object' ? (item.summary?.fr ?? '') : '';

        let sent = 0;
        const errors: string[] = [];

        for (const sub of subscribers) {
            const unsubUrl =
                `${SITE_URL}/?unsubscribe=1&uid=${encodeURIComponent(sub.user_id)}`;

            const html = buildEmailHTML({
                titleEn, titleFr, summaryEn, summaryFr,
                image: item.image ?? '',
                displayDate: item.display_date ?? '',
                newsId: item.id,
                siteUrl: SITE_URL,
                unsubUrl
            });

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: `Acer Books <${FROM_EMAIL}>`,
                    to:   [sub.email],
                    subject: `📰 ${titleEn}`,
                    html
                })
            });

            if (res.ok) {
                sent++;
            } else {
                const errText = await res.text();
                errors.push(`${sub.email}: ${errText}`);
            }
        }

        console.log(`Newsletter sent: ${sent}/${subscribers.length}`, errors);

        return new Response(
            JSON.stringify({ sent, total: subscribers.length, errors }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('Edge Function error:', err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// ── Email HTML template ──────────────────────────────────────────────────────

function buildEmailHTML(opts: {
    titleEn: string; titleFr: string;
    summaryEn: string; summaryFr: string;
    image: string; displayDate: string;
    newsId: string; siteUrl: string; unsubUrl: string;
}): string {
    const { titleEn, titleFr, summaryEn, summaryFr,
            image, displayDate, newsId, siteUrl, unsubUrl } = opts;

    const readUrl = `${siteUrl}/news/${newsId}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleEn}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a0000 0%,#6b0000 100%);
                     padding:28px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;
                      text-transform:uppercase;color:rgba(255,255,255,0.55);">
              Acer Books · Montréal
            </p>
            <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;
                       color:#fff;font-weight:700;letter-spacing:0.02em;">
              News &amp; Events
            </h1>
          </td>
        </tr>

        <!-- Issue meta -->
        <tr>
          <td style="background:#fff8f8;padding:10px 36px;border-bottom:1px solid #f0e0e0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px;font-weight:700;color:#cc0000;
                           letter-spacing:0.08em;text-transform:uppercase;">
                  ● LATEST ISSUE
                </td>
                <td align="right" style="font-size:11px;color:#999;">
                  ${displayDate}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero image -->
        ${image ? `
        <tr>
          <td style="padding:0;">
            <img src="${image}" alt="${titleEn}"
                 style="width:100%;max-width:600px;height:220px;object-fit:cover;display:block;">
          </td>
        </tr>` : ''}

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 28px;">
            <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;
                       font-weight:700;color:#1a1a1a;line-height:1.35;">
              ${titleEn}
            </h2>
            <p style="margin:0 0 10px;font-size:14px;color:#555;line-height:1.7;">
              ${summaryEn}
            </p>
            ${titleFr && summaryFr ? `
            <hr style="border:none;border-top:1px solid #f0e0e0;margin:18px 0;">
            <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-size:18px;
                       font-weight:700;color:#4a0000;line-height:1.35;">
              ${titleFr}
            </h2>
            <p style="margin:0;font-size:13px;color:#666;line-height:1.7;">
              ${summaryFr}
            </p>` : ''}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 36px;text-align:center;">
            <a href="${readUrl}"
               style="display:inline-block;background:#cc0000;color:#fff;
                      text-decoration:none;padding:13px 32px;border-radius:8px;
                      font-size:14px;font-weight:700;letter-spacing:0.04em;">
              Read the Full Story →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;border-top:1px solid #eee;
                     padding:18px 36px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;color:#aaa;">
              You're receiving this because you subscribed on
              <a href="${siteUrl}" style="color:#cc0000;">${siteUrl.replace('https://','')}</a>.
            </p>
            <p style="margin:0;font-size:11px;">
              <a href="${unsubUrl}" style="color:#cc0000;text-decoration:underline;">
                Unsubscribe
              </a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}