// @ts-nocheck
// supabase/functions/og-card/index.ts
//
// Routes:
//   ?rid=xxx        → OG HTML (crawlers) or 302 redirect (real browsers)
//   ?rid=xxx&img=1  → Generated 1200×630 PNG  (og:image + twitter:image)
//
// KEY FIX: fontBuffers must be Uint8Array[], NOT ArrayBuffer[]
// That was the cause of "[object ArrayBuffer]" error.

import { createClient }    from '@supabase/supabase-js';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.0';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Helpers (from v-final, unchanged) ────────────────────────────────────────
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

// ─── Asset cache ──────────────────────────────────────────────────────────────
let wasmReady  = false;
let latinFont: Uint8Array | null = null;  // ← Uint8Array, not ArrayBuffer
let cjkFont:   Uint8Array | null = null;  // ← Uint8Array, not ArrayBuffer
let logoDataUrl = '';  // Acer Books logo cached as data URL

const LOGO_URL = 'https://acerbooks.ca/zhijian/Image_20260305124426_25_399.png';

async function tryFetch(urls: string[]): Promise<Uint8Array | null> {
    for (const u of urls) {
        try {
            const r = await fetch(u, { signal: AbortSignal.timeout(9000) });
            if (r.ok) {
                console.log('font ok:', u);
                return new Uint8Array(await r.arrayBuffer());  // ← convert to Uint8Array
            }
        } catch(e) { console.warn('font fetch fail:', u, String(e)); }
    }
    return null;
}

async function ensureAssets() {
    if (wasmReady) return;
    console.log('ensureAssets start');

    for (const u of [
        'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
        'https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
    ]) {
        try { await initWasm(fetch(u)); console.log('wasm ok:', u); break; }
        catch(e) {
            if (/already/i.test(String(e))) { console.log('wasm already init'); break; }
            console.warn('wasm fail:', u, String(e));
        }
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

    if (!lf) throw new Error('Latin font load failed');
    latinFont = lf;
    cjkFont   = cf;

    // Fetch Acer Books logo for top-left of card
    if (!logoDataUrl) logoDataUrl = await fetchCoverDataUrl(LOGO_URL);

    wasmReady = true;
    console.log('ensureAssets done, cjk=', !!cjkFont, 'logo=', !!logoDataUrl);
}

// ─── SVG text helpers ─────────────────────────────────────────────────────────
function trunc(s, n) { s=String(s||''); return s.length>n?s.substring(0,n)+'…':s; }
function x(s) {
    return String(s||'')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
const CJK = /[\u2e80-\u2eff\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
function wrapText(text, maxPx, fontSize, bold) {
    const lw = fontSize*(bold?0.63:0.58), cw = fontSize;
    const lines=[]; let line='', w=0;
    for (const ch of String(text||'')) {
        const chw = CJK.test(ch)?cw:(ch===' '?lw*0.4:lw);
        if (w+chw>maxPx && line) { lines.push(line); line=ch; w=chw; }
        else { line+=ch; w+=chw; }
    }
    if (line) lines.push(line);
    return lines;
}

// ─── Cover → base64 data URL ──────────────────────────────────────────────────
async function fetchCoverDataUrl(coverUrl) {
    try {
        const res = await fetch(coverUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) { console.warn('cover not ok:', res.status); return ''; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const mime  = /\.png(\?|$)/i.test(coverUrl) ? 'image/png' : 'image/jpeg';
        const CHUNK = 0x8000; let bin='';
        for (let i=0; i<bytes.byteLength; i+=CHUNK)
            bin += String.fromCharCode(...bytes.subarray(i, i+CHUNK));
        return `data:${mime};base64,${btoa(bin)}`;
    } catch(e) { console.warn('cover fetch error:', String(e)); return ''; }
}

// ─── OG Image Generator ───────────────────────────────────────────────────────
// Layout: [cover 420px] | [red stripe 6px] | [white text panel 774px]
// White background, red accents — minimalist style matching image 4.
async function generateImage(p) {
    console.log('generateImage start:', p.title?.substring(0,30));
    await ensureAssets();

    const coverData    = await fetchCoverDataUrl(p.coverUrl);
    const stars        = p.rating>0?'★'.repeat(p.rating)+'☆'.repeat(5-p.rating):'';
    const authorText   = p.author?`by ${trunc(p.author,65)}`:'';
    const titleLines   = wrapText(p.title, 648, 26, true).slice(0,2);
    const FF           = cjkFont?'Inter, Noto Sans SC, sans-serif':'Inter, sans-serif';
    const PX           = 476; // text panel left edge

    // Vertical layout — calculate space remaining for excerpt
    let cy=78; cy+=34;
    const titleY=cy; cy+=titleLines.length*36+14;
    const authorY=cy; cy+=authorText?30:8;
    const starsY=stars?cy+6:-1; cy+=stars?36:0; cy+=6;
    const exBorderY=cy, exY=cy+6;

    // ── Dynamic font-size: largest font where full text fits in available height ─
    const availH = 600 - exY;

    let exFontSize  = 14;
    let LINE_H      = Math.round(14 * 1.65);
    let excerptLines: string[] = [];

    // Try font sizes from 28 down to 14 (step 2), use the largest that fits
    for (let fs = 28; fs >= 14; fs -= 2) {
        const lh    = Math.round(fs * 1.65);
        const lines = wrapText(p.excerpt, 620, fs, false);
        if (lines.length * lh <= availH) {
            exFontSize   = fs;
            LINE_H       = lh;
            excerptLines = lines;
            break;
        }
    }

    // Fallback: if even 14px doesn't fit, truncate to max lines
    if (excerptLines.length === 0) {
        exFontSize  = 14;
        LINE_H      = Math.round(14 * 1.65);
        const maxLines = Math.max(1, Math.floor(availH / LINE_H));
        const allLines = wrapText(p.excerpt, 620, 14, false);
        excerptLines   = allLines.slice(0, maxLines);
        if (allLines.length > maxLines && excerptLines.length > 0) {
            const last = excerptLines[excerptLines.length - 1];
            excerptLines[excerptLines.length - 1] = last.slice(0, -1) + '…';
        }
    }

    const parts=[
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630">`,

        // Cover (left 420px)
        coverData
            ?`<image x="0" y="0" width="420" height="630" href="${coverData}" preserveAspectRatio="xMidYMid slice"/>`
            :`<rect x="0" y="0" width="420" height="630" fill="#e8e2d9"/>`,

        // Red stripe
        `<rect x="420" y="0" width="6" height="630" fill="#ff0000"/>`,

        // White text panel
        `<rect x="426" y="0" width="774" height="630" fill="#ffffff"/>`,

        // Acer Books logo — top left of panel (40×40 px, square logo)
        logoDataUrl
            ?`<image x="${PX}" y="52" width="40" height="40" href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
            :`<text x="${PX}" y="78" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="#aaaaaa" letter-spacing="3">ACER BOOKS</text>`,

        // "READER REVIEW" red badge — top right
        `<rect x="1028" y="56" width="122" height="26" fill="#ff0000"/>`,
        `<text x="1036" y="74" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#ffffff" letter-spacing="2">READER REVIEW</text>`,

        // Title (1–2 lines)
        ...titleLines.map((l,i)=>
            `<text x="${PX}" y="${titleY+i*36}"
                font-family="${FF}"
                font-size="26" font-weight="700" fill="#1a1a1a">${x(l)}</text>`),

        // Author
        authorText
            ?`<text x="${PX}" y="${authorY}"
                font-family="${FF}"
                font-size="13" fill="#999999">${x(authorText)}</text>`
            :'',

        // Stars
        stars&&starsY>0
            ?`<text x="${PX}" y="${starsY}"
                font-family="Inter,sans-serif"
                font-size="20" fill="#ff0000" letter-spacing="4">${x(stars)}</text>`
            :'',

        // Excerpt red left border
        excerptLines.length>0
            ?`<rect x="${PX}" y="${exBorderY}" width="3"
                height="${excerptLines.length*LINE_H+4}" fill="#ff0000"/>`
            :'',

        // Excerpt lines
        ...excerptLines.map((l,i)=>
            `<text x="${PX+18}" y="${exY+i*LINE_H}"
                font-family="${FF}"
                font-size="${exFontSize}" fill="#555555">${x(l)}</text>`),

        // Publisher email — bottom left, dark gray
        `<text x="${PX}" y="608"
            font-family="Inter,sans-serif"
            font-size="12" fill="#555555">acerbookscanada@gmail.ca</text>`,

        `</svg>`,
    ].filter(Boolean).join('\n');

    // ← fontBuffers: Uint8Array[] — this is the critical fix
    const fontBuffers: Uint8Array[] = [latinFont!];
    if (cjkFont) fontBuffers.push(cjkFont);

    const resvg = new Resvg(parts, {
        font: {
            fontBuffers,          // Uint8Array[], NOT ArrayBuffer[]
            loadSystemFonts: false,
            defaultFontFamily: 'Inter',
        },
        fitTo: { mode: 'width', value: 1200 },
    });

    const png = resvg.render().asPng();
    console.log('generateImage done, bytes=', png.byteLength);
    return png;
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

        const slug     = toSlugSimple(book?.title||'');
        // Reconstruct correct public HTTPS URL (Supabase strips /functions/v1 internally)
        const FUNC_BASE    = `https://${url.hostname}/functions/v1/og-card`;
        const shareUrl     = `${FUNC_BASE}?rid=${rid}`;
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;
        const imgUrl       = `${FUNC_BASE}?rid=${rid}&img=1`;

        const rawCover = book?.cover||'';
        const coverUrl = rawCover.startsWith('http')?rawCover
            :rawCover?`${SITE}${rawCover.startsWith('/')?'':'/'}${rawCover}`
            :`${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // ── ?img=1 → PNG ───────────────────────────────────────────────────
        if (url.searchParams.has('img')) {
            try {
                const png = await generateImage({
                    title:   book?.title||'Book Review',
                    author:  book?.author||'',
                    excerpt: (review.text||'').replace(/\s+/g,' '),
                    coverUrl,
                    rating:  Number(review.rating)||0,
                });
                return new Response(png,{
                    headers:{...CORS,'Content-Type':'image/png','Cache-Control':'public,max-age=86400'},
                });
            } catch(imgErr) {
                console.error('og-card img gen error:', String(imgErr));
                return new Response(null,{status:302,headers:{...CORS,'Location':coverUrl}});
            }
        }

        // ── OG HTML or redirect ────────────────────────────────────────────
        const bookTitle = book?.title||'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text||'').replace(/\s+/g,' ').substring(0,500);
        const ogDesc    = `${review.username||''}: ${excerpt}`;
        const stars     = review.rating?'★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+' ':'';

        const ua = req.headers.get('user-agent')||'';
        const isCrawler = !ua
            ||/facebookexternalhit|MicroMessenger|bot|crawl|spider|twitterbot|linkedinbot|whatsapp|telegram|slack|discord|applebot|googlebot|bingbot|duckduckbot|baidu|preview|scraper|fetcher|Validator/i.test(ua);

        if (!isCrawler) {
            return new Response(null,{status:302,headers:{...CORS,'Location':canonicalUrl}});
        }

        // og:image = twitter:image = generated PNG card (same designed layout for both FB and X)
        // twitter:card = summary_large_image → X shows the full-width designed card
        const html=`<!DOCTYPE html>
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
<meta name="twitter:image"       content="${esc(imgUrl)}">
<meta name="twitter:image:alt"   content="${he('Cover of '+bookTitle)}">

<link rel="canonical" href="${esc(shareUrl)}">
</head>
<body>
<h1 style="font-family:Georgia,serif;padding:40px 20px 8px;color:#1a1a1a">${he(bookTitle)}</h1>
<p style="font-family:Georgia,serif;padding:0 20px;color:#666;font-style:italic">by ${he(book?.author||'')}</p>
<p style="font-family:Georgia,serif;padding:16px 20px;color:#333;line-height:1.7">${he(review.text||'')}</p>
<p style="padding:0 20px"><a href="${esc(canonicalUrl)}" style="color:#cc0000">Read on Acer Books &#8594;</a></p>
</body></html>`;

        return new Response(new TextEncoder().encode(html),{
            status:200,
            headers:{...CORS,'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600,stale-while-revalidate=86400'},
        });

    } catch(err) {
        console.error('og-card fatal:',err);
        return new Response(String(err),{status:500,headers:CORS});
    }
});