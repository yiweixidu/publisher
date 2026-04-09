// @ts-nocheck
// supabase/functions/og-card/index.ts  v-final
// Simple OG redirect page — no image generation needed.
// og:image = book cover, og:title = book+review title, redirects to review page.

import { createClient } from '@supabase/supabase-js';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toSlugSimple(title) {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g,' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g,' ')
        .replace(/[^a-zA-Z0-9\s-]/g,' ')
        .toLowerCase().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').trim()||'book';
}

// Convert non-ASCII to HTML numeric entities — charset-proof
function he(s) {
    return String(s||'')
        .replace(/[&"<>]/g, c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))
        .replace(/[^\x00-\x7F]/g, c=>`&#${c.codePointAt(0)};`);
}

function esc(s) {
    return String(s||'').replace(/[&"<>]/g, c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
}

Deno.serve(async (req) => {
    if (req.method==='OPTIONS') return new Response('ok',{headers:CORS});
    try {
        const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
        const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
        const SITE             = 'https://acerbooks.ca';

        const url = new URL(req.url);
        const rid = url.searchParams.get('rid')?.trim();
        if (!rid) return new Response('Missing rid',{status:400,headers:CORS});

        const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const {data:review} = await sb.from('reviews')
            .select('id,book_id,username,text,rating,timestamp')
            .eq('id',rid).maybeSingle();

        if (!review) return new Response(
            `<html><head><meta http-equiv="refresh" content="0;url=${SITE}"></head><body><a href="${SITE}">Home</a></body></html>`,
            {status:200,headers:{...CORS,'Content-Type':'text/html'}});

        const {data:book} = await sb.from('books')
            .select('id,title,author,cover').eq('id',review.book_id).maybeSingle();

        const slug = toSlugSimple(book?.title||'');

        // shareUrl  = the edge-function URL itself (used as og:url so FB never re-fetches the SPA)
        // canonicalUrl = the real destination on acerbooks.ca (used only for the 302 redirect)
        const shareUrl     = `${url.origin}${url.pathname}?rid=${rid}`;
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;

        // Build absolute cover URL
        const rawCover = book?.cover || '';
        const coverUrl = rawCover.startsWith('http') ? rawCover
            : rawCover ? `${SITE}${rawCover.startsWith('/')?'':'/'}${rawCover}`
            : `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // Build OG content
        const bookTitle = book?.title || 'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text||'').replace(/\s+/g,' ').substring(0,500);
        const ogDesc    = `${review.username||''}: ${excerpt}`;
        const stars     = review.rating ? '★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+' ' : '';

        // Detect real browsers vs crawlers by User-Agent
        //
        // facebookexternalhit = Facebook's link-preview crawler  → serve OG HTML (no redirect)
        // FBAN / FBAV         = Facebook in-app browser          → real user, do 302 redirect
        //
        // Rule: if UA contains a known crawler token, it's a crawler.
        // Otherwise, if UA contains "Mozilla" it's a real browser.
        const ua = req.headers.get('user-agent') || '';
        const isCrawler = !ua
            || /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Baiduspider|bot|crawler|spider|preview|scraper|fetcher/i.test(ua);
        const isRealBrowser = !isCrawler && /mozilla/i.test(ua);

        if (isRealBrowser) {
            // Real user — 302 redirect directly to the book review page
            return new Response(null, {
                status: 302,
                headers: { ...CORS, 'Location': canonicalUrl }
            });
        }

        // Crawler — return OG HTML. og:url points to THIS edge-function URL,
        // not the SPA, so Facebook's scraper won't follow it and hit "Redirecting..."
        const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${he(ogTitle)}</title>

<meta property="og:type"         content="article">
<meta property="og:url"          content="${esc(shareUrl)}">
<meta property="og:title"        content="${he(ogTitle)}">
<meta property="og:description"  content="${he(stars+ogDesc)}">
<meta property="og:image"        content="${esc(coverUrl)}">
<meta property="og:image:width"  content="600">
<meta property="og:image:height" content="900">
<meta property="og:site_name"    content="Acer Books">
<meta property="og:locale"       content="zh_CN">

<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${he(ogTitle)}">
<meta name="twitter:description" content="${he(stars+ogDesc)}">
<meta name="twitter:image"       content="${esc(coverUrl)}">
<meta name="twitter:image:alt"   content="${he('Cover of '+bookTitle)}">

<link rel="canonical" href="${esc(shareUrl)}">
</head>
<body>
<h1 style="font-family:Georgia,serif;padding:40px 20px 8px;color:#1a1a1a">${he(bookTitle)}</h1>
<p style="font-family:Georgia,serif;padding:0 20px;color:#666;font-style:italic">by ${he(book?.author||'')}</p>
<p style="font-family:Georgia,serif;padding:16px 20px;color:#333;line-height:1.7">${he(review.text||'')}</p>
<p style="padding:0 20px"><a href="${esc(canonicalUrl)}" style="color:#cc0000">Read on Acer Books &#8594;</a></p>
</body></html>`;

        return new Response(new TextEncoder().encode(html), {
            status: 200,
            headers: {
                ...CORS,
                'Content-Type':  'text/html;charset=utf-8',
                'Cache-Control': 'public,max-age=3600,stale-while-revalidate=86400',
            }
        });

    } catch(err) {
        console.error('og-card fatal:',err);
        return new Response(String(err),{status:500,headers:CORS});
    }
});