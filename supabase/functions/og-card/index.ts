// @ts-nocheck
// supabase/functions/og-card/index.ts
//
// Routes:
//   ?rid=xxx        → OG HTML page (crawlers) or 302 redirect (real browsers)
//   ?rid=xxx&img=1  → Generated 1200×630 PNG card (satori + resvg-wasm)

import { createClient }    from '@supabase/supabase-js';
import satori               from 'npm:satori@0.10.14';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.0';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Module-level asset cache (warm across invocations in same worker) ────────
let assetsReady  = false;
let latinFont: ArrayBuffer;   // Inter 700 — Latin glyphs
let cjkFont:   ArrayBuffer;   // Noto Sans SC 700 — Chinese glyphs

async function ensureAssets() {
    if (assetsReady) return;
    await Promise.all([
        initWasm(fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.0/index_bg.wasm')),
        fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-700-normal.woff2')
            .then(r => r.arrayBuffer()).then(b => { latinFont = b; }),
        fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.1.0/files/noto-sans-sc-chinese-simplified-700-normal.woff2')
            .then(r => r.arrayBuffer()).then(b => { cjkFont = b; }),
    ]);
    assetsReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSlugSimple(title) {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim() || 'book';
}

function he(s) {
    return String(s || '')
        .replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))
        .replace(/[^\x00-\x7F]/g, c => `&#${c.codePointAt(0)};`);
}

function esc(s) {
    return String(s || '').replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
}

function trunc(s: string, n: number) {
    s = String(s || '');
    return s.length > n ? s.substring(0, n) + '…' : s;
}

// ─── OG Image Generator ───────────────────────────────────────────────────────
// Produces a 1200×630 PNG styled after the Twitter card layout:
//   [cover photo | red stripe | branded text panel]
async function generateImage(p: {
    title:    string;
    author:   string;
    excerpt:  string;
    coverUrl: string;
    rating:   number;
}): Promise<Uint8Array> {
    await ensureAssets();

    const stars = p.rating > 0
        ? '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating)
        : '';

    // Fetch cover → base64 data URL (5 s timeout)
    let coverData = '';
    try {
        const res   = await fetch(p.coverUrl, { signal: AbortSignal.timeout(5000) });
        const buf   = await res.arrayBuffer();
        const mime  = /\.png(\?|$)/i.test(p.coverUrl) ? 'image/png' : 'image/jpeg';
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        coverData = `data:${mime};base64,${btoa(bin)}`;
    } catch { /* fallback: solid bg */ }

    const node = {
        type: 'div',
        props: {
            style: {
                display:    'flex',
                width:      '1200px',
                height:     '630px',
                background: '#ffffff',
                fontFamily: '"Inter", "Noto Sans SC", sans-serif',
            },
            children: [
                // ── Left: book cover ──────────────────────────────────────
                {
                    type: 'div',
                    props: {
                        style: {
                            width:          '420px',
                            height:         '630px',
                            flexShrink:     0,
                            overflow:       'hidden',
                            background:     '#e8e2d9',
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'center',
                        },
                        children: coverData ? [{
                            type: 'img',
                            props: {
                                src:   coverData,
                                style: { width: '420px', height: '630px', objectFit: 'cover' },
                            }
                        }] : [],
                    }
                },

                // ── Red stripe ────────────────────────────────────────────
                {
                    type: 'div',
                    props: {
                        style: { width: '6px', height: '630px', background: '#cc0000', flexShrink: 0 },
                    }
                },

                // ── Right: text panel ─────────────────────────────────────
                {
                    type: 'div',
                    props: {
                        style: {
                            flex:           1,
                            display:        'flex',
                            flexDirection:  'column',
                            justifyContent: 'space-between',
                            padding:        '44px 50px 40px 50px',
                            background:     '#ffffff',
                        },
                        children: [
                            // Top content group
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
                                                    display:        'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems:     'center',
                                                    marginBottom:   '30px',
                                                },
                                                children: [
                                                    {
                                                        type: 'span',
                                                        props: {
                                                            style: {
                                                                fontSize:      '12px',
                                                                letterSpacing: '3px',
                                                                color:         '#aaa',
                                                                fontWeight:    700,
                                                            },
                                                            children: 'ACER BOOKS',
                                                        }
                                                    },
                                                    {
                                                        type: 'span',
                                                        props: {
                                                            style: {
                                                                fontSize:      '10px',
                                                                letterSpacing: '2px',
                                                                color:         '#fff',
                                                                background:    '#cc0000',
                                                                padding:       '5px 11px',
                                                                fontWeight:    700,
                                                            },
                                                            children: 'READER REVIEW',
                                                        }
                                                    },
                                                ]
                                            }
                                        },

                                        // Title
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize:     '26px',
                                                    fontWeight:   700,
                                                    color:        '#1a1a1a',
                                                    lineHeight:   1.35,
                                                    marginBottom: '10px',
                                                },
                                                children: trunc(p.title, 55),
                                            }
                                        },

                                        // Author
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize:     '13px',
                                                    color:        '#999',
                                                    marginBottom: '22px',
                                                },
                                                children: p.author ? `by ${trunc(p.author, 70)}` : '',
                                            }
                                        },

                                        // Stars (conditional)
                                        ...(stars ? [{
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize:      '20px',
                                                    color:         '#cc0000',
                                                    letterSpacing: '3px',
                                                    marginBottom:  '18px',
                                                },
                                                children: stars,
                                            }
                                        }] : []),

                                        // Excerpt with red left border
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    display:         'flex',
                                                    borderLeftWidth: '3px',
                                                    borderLeftStyle: 'solid',
                                                    borderLeftColor: '#cc0000',
                                                    paddingLeft:     '16px',
                                                },
                                                children: [{
                                                    type: 'span',
                                                    props: {
                                                        style: {
                                                            fontSize:   '14px',
                                                            color:      '#555',
                                                            lineHeight: 1.7,
                                                        },
                                                        children: trunc(p.excerpt, 140),
                                                    }
                                                }]
                                            }
                                        },
                                    ]
                                }
                            },

                            // Bottom: domain watermark
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        fontSize:      '12px',
                                        color:         '#ccc',
                                        letterSpacing: '1px',
                                    },
                                    children: 'acerbooks.ca',
                                }
                            },
                        ]
                    }
                },
            ]
        }
    };

    const svg = await satori(node as any, {
        width:  1200,
        height: 630,
        fonts: [
            { name: 'Inter',        data: latinFont, weight: 700, style: 'normal' },
            { name: 'Noto Sans SC', data: cjkFont,   weight: 700, style: 'normal' },
        ],
    });

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

        // Absolute cover URL
        const rawCover = book?.cover || '';
        const coverUrl = rawCover.startsWith('http') ? rawCover
            : rawCover ? `${SITE}${rawCover.startsWith('/') ? '' : '/'}${rawCover}`
            : `${SITE}/zhijian/Image_20260305124426_25_399.png`;

        // ── Route: PNG image ───────────────────────────────────────────────
        if (url.searchParams.has('img')) {
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
                }
            });
        }

        // ── Route: OG HTML or redirect ─────────────────────────────────────
        const bookTitle = book?.title || 'Book Review';
        const ogTitle   = `${bookTitle} — Reader Review | Acer Books`;
        const excerpt   = (review.text || '').replace(/\s+/g, ' ').substring(0, 500);
        const ogDesc    = `${review.username || ''}: ${excerpt}`;
        const stars     = review.rating
            ? '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating) + ' '
            : '';

        // facebookexternalhit = FB link-preview crawler → serve OG HTML
        // FBAN / FBAV         = FB in-app browser       → real user, redirect
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
<meta name="twitter:image"       content="${esc(imgUrl)}">
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