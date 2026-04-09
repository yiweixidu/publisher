// @ts-nocheck
// supabase/functions/og-card/index.ts
//
// Routes:
//   ?rid=xxx        → OG HTML (crawlers) or 302 redirect (real browsers)
//   ?rid=xxx&img=1  → Generated 1200×630 PNG  (og:image for Facebook)

import { createClient }    from '@supabase/supabase-js';
import satori               from 'npm:satori@0.10.14';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.0';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Asset cache (module-level → warm across same worker) ─────────────────────
let assetsReady = false;
let latinFont:  ArrayBuffer | null = null;
let cjkFont:    ArrayBuffer | null = null;

// Candidate URLs tried in order until one succeeds
const LATIN_CANDIDATES = [
    'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff2',
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ.woff2',
];
const CJK_CANDIDATES = [
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff2',
    'https://cdn.jsdelivr.net/npm/@fontsource-variable/noto-sans-sc/files/noto-sans-sc-chinese-simplified-wght-normal.woff2',
];
const WASM_CANDIDATES = [
    'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
    'https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm',
];

async function fetchFirstSuccess(urls: string[]): Promise<ArrayBuffer | null> {
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (res.ok) return res.arrayBuffer();
        } catch (e) {
            console.warn(`font fetch failed: ${url}`, e);
        }
    }
    return null;
}

async function ensureAssets(): Promise<void> {
    if (assetsReady) return;

    // Fetch WASM first (initWasm is one-time)
    let wasmOk = false;
    for (const url of WASM_CANDIDATES) {
        try {
            await initWasm(fetch(url));
            wasmOk = true;
            break;
        } catch (e) {
            console.warn(`wasm init failed: ${url}`, e);
        }
    }
    if (!wasmOk) throw new Error('resvg-wasm init failed — all candidates exhausted');

    // Fonts in parallel
    const [lf, cf] = await Promise.all([
        fetchFirstSuccess(LATIN_CANDIDATES),
        fetchFirstSuccess(CJK_CANDIDATES),
    ]);

    if (!lf) throw new Error('Latin font unavailable');
    // CJK font is optional: if missing, satori renders Latin glyphs fine; Chinese may show as boxes
    latinFont = lf;
    cjkFont   = cf;
    assetsReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSlugSimple(title: string): string {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim() || 'book';
}
function he(s: any): string {
    return String(s ?? '').replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'})[c] ?? c)
        .replace(/[^\x00-\x7F]/g, c => `&#${c.codePointAt(0)};`);
}
function esc(s: any): string {
    return String(s ?? '').replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'})[c] ?? c);
}
function trunc(s: any, n: number): string {
    const t = String(s ?? '');
    return t.length > n ? t.substring(0, n) + '…' : t;
}

// ─── Cover → base64 data URL ──────────────────────────────────────────────────
async function fetchCoverDataUrl(coverUrl: string): Promise<string> {
    try {
        const res   = await fetch(coverUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return '';
        const buf   = await res.arrayBuffer();
        const mime  = /\.png(\?|$)/i.test(coverUrl) ? 'image/png' : 'image/jpeg';
        const bytes = new Uint8Array(buf);
        // Build base64 in chunks to avoid call-stack limits on large images
        const CHUNK = 0x8000;
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i += CHUNK) {
            bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        return `data:${mime};base64,${btoa(bin)}`;
    } catch {
        return '';
    }
}

// ─── OG Image Generator ───────────────────────────────────────────────────────
// Layout: [cover 420px] [red stripe 6px] [text panel ~774px]
// Matches the Twitter/X card design exactly.
async function generateImage(p: {
    title: string; author: string; excerpt: string;
    coverUrl: string; rating: number;
}): Promise<Uint8Array> {
    await ensureAssets();

    const stars = p.rating > 0
        ? '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating)
        : '';

    const coverData = await fetchCoverDataUrl(p.coverUrl);

    // Build satori font list — always Latin; add CJK only if loaded
    const fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }> = [
        { name: 'Inter', data: latinFont!, weight: 700, style: 'normal' },
    ];
    if (cjkFont) {
        fonts.push({ name: 'Noto Sans SC', data: cjkFont, weight: 700, style: 'normal' });
    }
    const fontFamily = cjkFont
        ? '"Inter", "Noto Sans SC", sans-serif'
        : '"Inter", sans-serif';

    const node = {
        type: 'div',
        props: {
            style: { display: 'flex', width: '1200px', height: '630px', background: '#ffffff', fontFamily },
            children: [
                // ── Cover ────────────────────────────────────────────────
                {
                    type: 'div',
                    props: {
                        style: {
                            width: '420px', height: '630px', flexShrink: 0,
                            overflow: 'hidden', background: '#e8e2d9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        },
                        children: coverData ? [{
                            type: 'img',
                            props: { src: coverData, style: { width: '420px', height: '630px', objectFit: 'cover' } },
                        }] : [],
                    },
                },
                // ── Red stripe ───────────────────────────────────────────
                {
                    type: 'div',
                    props: { style: { width: '6px', height: '630px', background: '#cc0000', flexShrink: 0 } },
                },
                // ── Text panel ───────────────────────────────────────────
                {
                    type: 'div',
                    props: {
                        style: {
                            flex: 1, display: 'flex', flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '44px 50px 40px 50px', background: '#ffffff',
                        },
                        children: [
                            // Top group
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', flexDirection: 'column' },
                                    children: [
                                        // Brand row
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    display: 'flex', justifyContent: 'space-between',
                                                    alignItems: 'center', marginBottom: '30px',
                                                },
                                                children: [
                                                    {
                                                        type: 'span',
                                                        props: {
                                                            style: { fontSize: '12px', letterSpacing: '3px', color: '#aaa', fontWeight: 700 },
                                                            children: 'ACER BOOKS',
                                                        },
                                                    },
                                                    {
                                                        type: 'span',
                                                        props: {
                                                            style: {
                                                                fontSize: '10px', letterSpacing: '2px',
                                                                color: '#fff', background: '#cc0000',
                                                                padding: '5px 11px', fontWeight: 700,
                                                            },
                                                            children: 'READER REVIEW',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                        // Title
                                        {
                                            type: 'div',
                                            props: {
                                                style: { fontSize: '26px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.35, marginBottom: '10px' },
                                                children: trunc(p.title, 55),
                                            },
                                        },
                                        // Author
                                        {
                                            type: 'div',
                                            props: {
                                                style: { fontSize: '13px', color: '#999', marginBottom: '22px' },
                                                children: p.author ? `by ${trunc(p.author, 70)}` : '',
                                            },
                                        },
                                        // Stars
                                        ...(stars ? [{
                                            type: 'div',
                                            props: {
                                                style: { fontSize: '20px', color: '#cc0000', letterSpacing: '3px', marginBottom: '18px' },
                                                children: stars,
                                            },
                                        }] : []),
                                        // Excerpt with red left border
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    display: 'flex',
                                                    borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: '#cc0000',
                                                    paddingLeft: '16px',
                                                },
                                                children: [{
                                                    type: 'span',
                                                    props: {
                                                        style: { fontSize: '14px', color: '#555', lineHeight: 1.7 },
                                                        children: trunc(p.excerpt, 140),
                                                    },
                                                }],
                                            },
                                        },
                                    ],
                                },
                            },
                            // Domain watermark
                            {
                                type: 'div',
                                props: {
                                    style: { fontSize: '12px', color: '#ccc', letterSpacing: '1px' },
                                    children: 'acerbooks.ca',
                                },
                            },
                        ],
                    },
                },
            ],
        },
    };

    const svg = await satori(node as any, { width: 1200, height: 630, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    return resvg.render().asPng();
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
        const SITE             = 'https://acerbooks.ca';

        const url = new URL(req.url);
        const rid = url.searchParams.get('rid')?.trim();
        if (!rid) return new Response('Missing rid', { status: 400, headers: CORS });

        const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const { data: review } = await sb.from('reviews')
            .select('id,book_id,username,text,rating,timestamp')
            .eq('id', rid).maybeSingle();

        if (!review) return new Response(
            `<html><head><meta http-equiv="refresh" content="0;url=${SITE}"></head><body><a href="${SITE}">Home</a></body></html>`,
            { status: 200, headers: { ...CORS, 'Content-Type': 'text/html' } });

        const { data: book } = await sb.from('books')
            .select('id,title,author,cover').eq('id', review.book_id).maybeSingle();

        const slug         = toSlugSimple(book?.title || '');
        const shareUrl     = `${url.origin}${url.pathname}?rid=${rid}`;
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;
        const imgUrl       = `${url.origin}${url.pathname}?rid=${rid}&img=1`;

        const rawCover = book?.cover || '';
        const coverUrl = rawCover.startsWith('http') ? rawCover
            : rawCover ? `${SITE}${rawCover.startsWith('/') ? '' : '/'}${rawCover}`
            : `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // ── ?img=1 → PNG for Facebook og:image ────────────────────────────
        if (url.searchParams.has('img')) {
            try {
                const png = await generateImage({
                    title:   book?.title  || 'Book Review',
                    author:  book?.author || '',
                    excerpt: (review.text || '').replace(/\s+/g, ' '),
                    coverUrl,
                    rating:  Number(review.rating) || 0,
                });
                return new Response(png, {
                    headers: {
                        ...CORS,
                        'Content-Type':  'image/png',
                        'Cache-Control': 'public,max-age=86400',
                    },
                });
            } catch (imgErr) {
                // Generation failed → fallback: redirect to raw book cover
                console.error('og-card img gen error:', String(imgErr));
                return new Response(null, {
                    status: 302,
                    headers: { ...CORS, 'Location': coverUrl },
                });
            }
        }

        // ── OG HTML or redirect ────────────────────────────────────────────
        const bookTitle = book?.title || 'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text || '').replace(/\s+/g, ' ').substring(0, 500);
        const ogDesc    = `${review.username || ''}: ${excerpt}`;
        const stars     = review.rating
            ? '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating) + ' '
            : '';

        // facebookexternalhit = FB crawler  → serve OG HTML
        // FBAN / FBAV         = FB in-app   → real user, 302 redirect
        const ua = req.headers.get('user-agent') || '';
        const isCrawler = !ua
            || /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Baiduspider|bot|crawler|spider|preview|scraper|fetcher/i.test(ua);
        const isRealBrowser = !isCrawler && /mozilla/i.test(ua);

        if (isRealBrowser) {
            return new Response(null, {
                status: 302,
                headers: { ...CORS, 'Location': canonicalUrl },
            });
        }

        // og:image     → generated PNG card  (Facebook shows the designed layout)
        // twitter:image → raw book cover     (X keeps its original card design)
        const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${he(ogTitle)}</title>

<meta property="og:type"         content="article">
<meta property="og:url"          content="${esc(shareUrl)}">
<meta property="og:title"        content="${he(ogTitle)}">
<meta property="og:description"  content="${he(stars + ogDesc)}">
<meta property="og:image"        content="${esc(imgUrl)}">
<meta property="og:image:type"   content="image/png">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name"    content="Acer Books">
<meta property="og:locale"       content="zh_CN">

<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${he(ogTitle)}">
<meta name="twitter:description" content="${he(stars + ogDesc)}">
<meta name="twitter:image"       content="${esc(coverUrl)}">
<meta name="twitter:image:alt"   content="${he('Cover of ' + bookTitle)}">

<link rel="canonical" href="${esc(shareUrl)}">
</head>
<body>
<h1 style="font-family:Georgia,serif;padding:40px 20px 8px;color:#1a1a1a">${he(bookTitle)}</h1>
<p style="font-family:Georgia,serif;padding:0 20px;color:#666;font-style:italic">by ${he(book?.author || '')}</p>
<p style="font-family:Georgia,serif;padding:16px 20px;color:#333;line-height:1.7">${he(review.text || '')}</p>
<p style="padding:0 20px"><a href="${esc(canonicalUrl)}" style="color:#cc0000">Read on Acer Books &#8594;</a></p>
</body></html>`;

        return new Response(new TextEncoder().encode(html), {
            status: 200,
            headers: {
                ...CORS,
                'Content-Type':  'text/html;charset=utf-8',
                'Cache-Control': 'public,max-age=3600,stale-while-revalidate=86400',
            },
        });

    } catch (err) {
        console.error('og-card fatal:', err);
        return new Response(String(err), { status: 500, headers: CORS });
    }
});