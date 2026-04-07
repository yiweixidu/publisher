// @ts-nocheck
// supabase/functions/og-card/index.ts
//
// Deploy:
//   supabase functions deploy og-card
//
// Usage:
//   https://<project>.supabase.co/functions/v1/og-card?rid=rev_xxx
//
// What it does:
//   1. Fetches review + book from Supabase
//   2. Builds the og:image URL (pre-generated PNG in Storage)
//   3. Returns an HTML page with OG / Twitter Card meta tags
//   4. Redirects human visitors to the real book page via <meta refresh> + JS

import { createClient } from '@supabase/supabase-js';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert title → URL slug (mirrors routing.js logic, Latin-only here)
function toSlugSimple(title: string): string {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim() || 'book';
}

function esc(str: string): string {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const SITE              = 'https://acerbooks.ca';

        const url = new URL(req.url);
        const rid = url.searchParams.get('rid')?.trim();
        if (!rid) {
            return new Response('Missing rid parameter', { status: 400, headers: CORS });
        }

        const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ── Fetch review ──────────────────────────────────────────────────────
        const { data: review, error: revErr } = await sb
            .from('reviews')
            .select('id, book_id, username, text, rating, timestamp')
            .eq('id', rid)
            .maybeSingle();

        if (revErr || !review) {
            // Still redirect gracefully
            return redirectTo(SITE + '/', CORS);
        }

        // ── Fetch book ────────────────────────────────────────────────────────
        const { data: book } = await sb
            .from('books')
            .select('id, title, author, cover')
            .eq('id', review.book_id)
            .maybeSingle();

        // ── Build URLs ────────────────────────────────────────────────────────
        const slug         = toSlugSimple(book?.title || '');
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;

        // Public URL of pre-generated PNG (generated client-side, stored in Storage)
        const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/og-images/reviews/${rid}.png`;

        // Fallback image if PNG hasn't been generated yet
        const fallbackImage = `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // ── Build meta content ────────────────────────────────────────────────
        const bookTitle  = book?.title  || 'Book Review';
        const bookAuthor = book?.author || '';
        const ogTitle    = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt    = (review.text || '').replace(/\s+/g, ' ').substring(0, 200);
        const ogDesc     = `${review.username} reviewed "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}: ${excerpt}`;

        // Star line (text representation for meta description)
        const ratingLine = review.rating
            ? '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating) + '  '
            : '';

        // ── Verify image exists (HEAD request) ───────────────────────────────
        let finalImageUrl = fallbackImage;
        try {
            const check = await fetch(imageUrl, { method: 'HEAD' });
            if (check.ok) finalImageUrl = imageUrl;
        } catch(_) { /* use fallback */ }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(ogTitle)}</title>

  <!-- ── Open Graph ── -->
  <meta property="og:type"         content="article">
  <meta property="og:url"          content="${esc(canonicalUrl)}">
  <meta property="og:title"        content="${esc(ogTitle)}">
  <meta property="og:description"  content="${esc(ratingLine + ogDesc)}">
  <meta property="og:image"        content="${esc(finalImageUrl)}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name"    content="Acer Books">
  <meta property="og:locale"       content="en_CA">

  <!-- ── Twitter / X Card ── -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ratingLine + ogDesc)}">
  <meta name="twitter:image"       content="${esc(finalImageUrl)}">
  <meta name="twitter:image:alt"   content="${esc('Review of ' + bookTitle)}">

  <!-- ── Canonical + redirect ── -->
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}">
  <style>
    body { font-family: Georgia, serif; text-align: center; padding: 60px 20px; color: #333; }
    a    { color: #ff0000; }
  </style>
</head>
<body>
  <p>Loading review&hellip;</p>
  <p><a href="${esc(canonicalUrl)}">Click here if not redirected automatically.</a></p>
  <script>window.location.replace('${canonicalUrl.replace(/'/g, "\\'")}');</script>
</body>
</html>`;

        return new Response(html, {
            status: 200,
            headers: {
                ...CORS,
                'Content-Type':  'text/html; charset=utf-8',
                // Cache for 1 hour — safe because og:image URL is stable (keyed by rid)
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
        });

    } catch (err) {
        console.error('og-card fatal:', err);
        return new Response(String(err), { status: 500, headers: CORS });
    }
});

function redirectTo(url: string, headers: Record<string, string>) {
    return new Response(
        `<html><head><meta http-equiv="refresh" content="0;url=${url}"></head>` +
        `<body><a href="${url}">Click here</a></body></html>`,
        { status: 200, headers: { ...headers, 'Content-Type': 'text/html' } }
    );
}