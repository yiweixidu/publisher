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

        const slug         = toSlugSimple(book?.title||'');
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;

        // Build absolute cover URL
        const rawCover = book?.cover || '';
        const coverUrl = rawCover.startsWith('http') ? rawCover
            : rawCover ? `${SITE}${rawCover.startsWith('/')?'':'/'}${rawCover}`
            : `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // Build OG content
        const bookTitle = book?.title || 'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text||'').replace(/\s+/g,' ').substring(0,200);
        const ogDesc    = `${review.username||''} reviewed: ${excerpt}`;
        const stars     = review.rating ? '★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+' ' : '';

        // Detect crawlers by User-Agent — serve OG HTML to crawlers, 302 to real browsers
        const ua = req.headers.get('user-agent') || '';
        const isCrawler = /twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|duckduckbot|baiduspider/i.test(ua);

        if (!isCrawler) {
            // Real user — 302 redirect directly to the book review page
            return new Response(null, {
                status: 302,
                headers: { ...CORS, 'Location': canonicalUrl }
            });
        }

        const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${he(ogTitle)}</title>

<meta property="og:type"         content="article">
<meta property="og:url"          content="${esc(canonicalUrl)}">
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

<link rel="canonical" href="${esc(canonicalUrl)}">
<meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}">
<style>body{font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#333}a{color:#cc0000}</style>
</head>
<body>
<p>Loading&#8230; <a href="${esc(canonicalUrl)}">Click here if not redirected.</a></p>
<script>window.location.replace('${canonicalUrl.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}');</script>
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