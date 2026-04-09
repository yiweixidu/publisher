// @ts-nocheck
// supabase/functions/og-card/index.ts
//
// Based on v-final (X card working) + FB og:image generation added.
//
// Routes:
//   ?rid=xxx        → OG HTML (crawlers) or 302 redirect (real browsers)
//   ?rid=xxx&img=1  → Generated 1200×630 PNG used as og:image for Facebook
//
// X card  : twitter:image = raw book cover  (unchanged — X renders its own design)
// FB card : og:image      = generated PNG   (designed card matching X layout)

import { createClient }    from '@supabase/supabase-js';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.0';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Helpers (unchanged from v-final) ─────────────────────────────────────────
function toSlugSimple(title) {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g,' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g,' ')
        .replace(/[^a-zA-Z0-9\s-]/g,' ')
        .toLowerCase().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').trim()||'book';
}
function he(s) {
    return String(s||'')
        .replace(/[&"<>]/g, c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))
        .replace(/[^\x00-\x7F]/g, c=>`&#${c.codePointAt(0)};`);
}
function esc(s) {
    return String(s||'').replace(/[&"<>]/g, c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
}

// ─── Image generation assets (module-level cache) ─────────────────────────────
let wasmReady = false;
let latinFont = null;
let cjkFont   = null;

async function tryFetch(urls) {
    for (const u of urls) {
        try {
            const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
            if (r.ok) return r.arrayBuffer();
        } catch(e) { console.warn('font fetch failed:', u, String(e)); }
    }
    return null;
}

async function ensureAssets() {
    if (wasmReady) return;
    for (const u of [
        'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
        'https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
    ]) {
        try { await initWasm(fetch(u)); break; }
        catch(e) { if (/already/i.test(String(e))) break; console.warn('wasm:', u, String(e)); }
    }
    const [lf, cf] = await Promise.all([
        tryFetch([
            'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff2',
            'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff2',
        ]),
        tryFetch([
            'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff2',
            'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5/files/noto-sans-sc-chinese-simplified-700-normal.woff2',
        ]),
    ]);
    if (!lf) throw new Error('Latin font unavailable');
    latinFont = lf;
    cjkFont   = cf;
    wasmReady = true;
}

// ─── Text helpers for SVG ──────────────────────────────────────────────────────
function trunc(s, n) { s = String(s||''); return s.length>n ? s.substring(0,n)+'…' : s; }
function x(s) {
    return String(s||'')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
const CJK = /[\u2e80-\u2eff\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
function wrapText(text, maxPx, fontSize, bold) {
    const lw = fontSize * (bold ? 0.63 : 0.58);
    const cw = fontSize;
    const lines = [];
    let line = '', w = 0;
    for (const ch of String(text||'')) {
        const chw = CJK.test(ch) ? cw : (ch===' ' ? lw*0.4 : lw);
        if (w+chw > maxPx && line) { lines.push(line); line=ch; w=chw; }
        else { line+=ch; w+=chw; }
    }
    if (line) lines.push(line);
    return lines;
}

// ─── Cover → base64 data URL ──────────────────────────────────────────────────
async function fetchCoverDataUrl(coverUrl) {
    try {
        const res = await fetch(coverUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return '';
        const buf = await res.arrayBuffer();
        const mime = /\.png(\?|$)/i.test(coverUrl) ? 'image/png' : 'image/jpeg';
        const bytes = new Uint8Array(buf);
        const CHUNK = 0x8000;
        let bin = '';
        for (let i=0; i<bytes.byteLength; i+=CHUNK)
            bin += String.fromCharCode(...bytes.subarray(i, i+CHUNK));
        return `data:${mime};base64,${btoa(bin)}`;
    } catch { return ''; }
}

// ─── OG Image Generator (pure SVG → resvg-wasm → PNG) ────────────────────────
// Layout: [cover 420px] | [red stripe 6px] | [text panel 774px]
async function generateImage(p) {
    await ensureAssets();

    const coverData    = await fetchCoverDataUrl(p.coverUrl);
    const stars        = p.rating>0 ? '★'.repeat(p.rating)+'☆'.repeat(5-p.rating) : '';
    const authorText   = p.author ? `by ${trunc(p.author, 65)}` : '';
    const titleLines   = wrapText(p.title, 648, 26, true).slice(0, 2);
    const excerptLines = wrapText(trunc(p.excerpt, 220), 625, 14, false).slice(0, 5);
    const FF           = cjkFont ? 'Inter, Noto Sans SC, sans-serif' : 'Inter, sans-serif';
    const PX           = 476; // panel text start x

    // Vertical layout
    let cy = 78;
    cy += 34;
    const titleY = cy;
    cy += titleLines.length * 36 + 14;
    const authorY = cy;
    cy += authorText ? 30 : 8;
    const starsY = stars ? cy+6 : -1;
    cy += stars ? 36 : 0;
    cy += 6;
    const exBorderY = cy;
    const exY = cy + 6;

    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630">`,
        coverData
            ? `<image x="0" y="0" width="420" height="630" href="${coverData}" preserveAspectRatio="xMidYMid slice"/>`
            : `<rect x="0" y="0" width="420" height="630" fill="#e8e2d9"/>`,
        `<rect x="420" y="0" width="6" height="630" fill="#cc0000"/>`,
        `<rect x="426" y="0" width="774" height="630" fill="#ffffff"/>`,
        `<text x="${PX}" y="78" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="#aaaaaa" letter-spacing="3">ACER BOOKS</text>`,
        `<rect x="1028" y="56" width="122" height="26" fill="#cc0000"/>`,
        `<text x="1036" y="74" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#ffffff" letter-spacing="2">READER REVIEW</text>`,
        ...titleLines.map((l,i) =>
            `<text x="${PX}" y="${titleY+i*36}" font-family="${FF}" font-size="26" font-weight="700" fill="#1a1a1a">${x(l)}</text>`),
        authorText
            ? `<text x="${PX}" y="${authorY}" font-family="${FF}" font-size="13" fill="#999999">${x(authorText)}</text>`
            : '',
        stars && starsY>0
            ? `<text x="${PX}" y="${starsY}" font-family="Inter,sans-serif" font-size="20" fill="#cc0000" letter-spacing="4">${x(stars)}</text>`
            : '',
        excerptLines.length>0
            ? `<rect x="${PX}" y="${exBorderY}" width="3" height="${excerptLines.length*25+4}" fill="#cc0000"/>`
            : '',
        ...excerptLines.map((l,i) =>
            `<text x="${PX+18}" y="${exY+i*25}" font-family="${FF}" font-size="14" fill="#555555">${x(l)}</text>`),
        `<text x="${PX}" y="608" font-family="Inter,sans-serif" font-size="12" fill="#cccccc" letter-spacing="1">acerbooks.ca</text>`,
        `</svg>`,
    ].filter(Boolean).join('\n');

    const fontBuffers = [latinFont];
    if (cjkFont) fontBuffers.push(cjkFont);

    const resvg = new Resvg(parts, {
        font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Inter' },
        fitTo: { mode: 'width', value: 1200 },
    });
    return resvg.render().asPng();
}

// ─── Main handler ─────────────────────────────────────────────────────────────
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

        // Supabase strips /functions/v1 internally — reconstruct correct public HTTPS URL
        const FUNC_BASE = `https://${url.hostname}/functions/v1/og-card`;
        const shareUrl  = `${FUNC_BASE}?rid=${rid}`;
        const imgUrl    = `${FUNC_BASE}?rid=${rid}&img=1`;

        // Absolute cover URL (same logic as v-final)
        const rawCover = book?.cover||'';
        const coverUrl = rawCover.startsWith('http') ? rawCover
            : rawCover ? `${SITE}${rawCover.startsWith('/')?'':'/'}${rawCover}`
            : `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // ── Route: PNG image for Facebook ──────────────────────────────────
        if (url.searchParams.has('img')) {
            try {
                const png = await generateImage({
                    title:   book?.title  || 'Book Review',
                    author:  book?.author || '',
                    excerpt: (review.text||'').replace(/\s+/g,' '),
                    coverUrl,
                    rating:  Number(review.rating)||0,
                });
                return new Response(png, {
                    headers: { ...CORS, 'Content-Type':'image/png', 'Cache-Control':'public,max-age=86400' }
                });
            } catch(imgErr) {
                console.error('og-card img gen error:', String(imgErr));
                return new Response(null, { status:302, headers:{...CORS,'Location':coverUrl} });
            }
        }

        // ── OG content strings (same as v-final) ───────────────────────────
        const bookTitle = book?.title||'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text||'').replace(/\s+/g,' ').substring(0,500);
        const ogDesc    = `${review.username||''}: ${excerpt}`;
        const stars     = review.rating ? '★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+' ' : '';

        // Crawler detection (same as v-final, with facebookexternalhit kept separate)
        const ua = req.headers.get('user-agent')||'';
        const isCrawler = !ua
            || /facebookexternalhit|bot|crawl|spider|twitterbot|linkedinbot|whatsapp|telegram|slack|discord|applebot|googlebot|bingbot|duckduckbot|baidu|preview|scraper|fetcher|Validator/i.test(ua);

        if (!isCrawler) {
            return new Response(null, {
                status: 302,
                headers: { ...CORS, 'Location': canonicalUrl }
            });
        }

        // og:image     → generated PNG  (Facebook sees the designed card)
        // twitter:image → book cover    (X unchanged — it renders its own designed card)
        const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${he(ogTitle)}</title>

<meta property="og:type"         content="article">
<meta property="og:url"          content="${esc(shareUrl)}">
<meta property="og:title"        content="${he(ogTitle)}">
<meta property="og:description"  content="${he(stars+ogDesc)}">
<meta property="og:image"        content="${esc(imgUrl)}">
<meta property="og:image:type"   content="image/png">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
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