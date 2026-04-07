// @ts-nocheck
// supabase/functions/og-card/index.ts  v4 — loads Noto Sans font for resvg-wasm
import { createClient } from '@supabase/supabase-js';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let wasmReady = false;
let fontData: Uint8Array | null = null;

async function init() {
    if (wasmReady) return;
    // Load WASM binary
    const wasm = await fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
    await initWasm(wasm);
    // Load Noto Sans — supports Latin + CJK
    const fontRes = await fetch('https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjc5anXuQ.woff2');
    const fontBuf = await fontRes.arrayBuffer();
    fontData = new Uint8Array(fontBuf);
    wasmReady = true;
}

function toSlugSimple(title) {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g,' ')
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g,' ')
        .replace(/[^a-zA-Z0-9\s-]/g,' ')
        .toLowerCase().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').trim()||'book';
}

function esc(s)    { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escSvg(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

// Wrap text into SVG <tspan> elements
function svgWrap(text, x, maxChars, maxLines, lineH) {
    const tokens = text.match(/[\u3000-\u9fff\uac00-\ud7af]|[^\u3000-\u9fff\uac00-\ud7af\s]+|\s+/g)||[];
    const lines=[]; let line='';
    for (const t of tokens) {
        if ((line+t).trimEnd().length > maxChars && line.trim()) {
            lines.push(line.trim()); line=t.trim();
            if (lines.length >= maxLines-1){ line+='…'; break; }
        } else { line+=t; }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0,maxLines).map((l,i)=>
        `<tspan x="${x}" dy="${i===0?0:lineH}">${escSvg(l)}</tspan>`
    ).join('');
}

function starsSvg(rating, x, y) {
    const r=Math.min(5,Math.max(1,Math.round(rating)));
    return Array.from({length:5},(_,i)=>
        `<text x="${x+i*30}" y="${y}" font-size="24" font-family="Noto Sans,sans-serif" fill="${i<r?'#ff0000':'#dddddd'}">${i<r?'★':'☆'}</text>`
    ).join('');
}

function buildSvg(review, book, coverDataUrl) {
    const F = 'Noto Sans,sans-serif';
    const titleWrap   = svgWrap(book?.title||'Book Review', 440, 22, 2, 40);
    const titleLines  = (titleWrap.match(/<tspan/g)||[]).length;
    const excerpt     = `"${(review.text||'').replace(/\s+/g,' ').substring(0,220)}${(review.text||'').length>220?'…':''}"`;
    const excerptWrap = svgWrap(excerpt, 452, 37, 4, 30);

    const authorY  = 128 + titleLines*40 + 8;
    const starsY   = authorY + 36;
    const excerptY = starsY + (review.rating ? 44 : 14);
    const avatarY  = 556;

    const coverImg = coverDataUrl
        ? `<image href="${coverDataUrl}" x="16" y="16" width="368" height="598" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="16" y="16" width="368" height="598" rx="6" fill="#2d0000"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630">
<rect width="1200" height="630" fill="#ffffff"/>
<rect width="400" height="630" fill="#140000"/>
${coverImg}
<rect x="397" y="0" width="3" height="630" fill="#ff0000"/>
<rect x="430" y="24" width="36" height="36" rx="4" fill="#ff0000"/>
<text x="448" y="47" font-size="16" font-family="${F}" fill="#ffffff" text-anchor="middle" font-weight="bold">A</text>
<text x="476" y="47" font-size="15" font-family="${F}" fill="#1a1a1a" font-weight="bold">ACER BOOKS</text>
<rect x="956" y="22" width="204" height="32" rx="4" fill="#ff0000"/>
<text x="1058" y="43" font-size="12" font-family="${F}" fill="#ffffff" text-anchor="middle" font-weight="bold">READER REVIEW</text>
<line x1="430" y1="74" x2="1170" y2="74" stroke="#eeeeee" stroke-width="1"/>
<text x="440" y="128" font-size="28" font-family="${F}" fill="#1a1a1a" font-weight="bold">${titleWrap}</text>
<text x="440" y="${authorY}" font-size="16" font-family="${F}" fill="#888888" font-style="italic">by ${escSvg(book?.author||'')}</text>
${review.rating ? starsSvg(review.rating, 440, starsY) : ''}
<rect x="440" y="${excerptY-16}" width="4" height="14" fill="#ff0000"/>
<text x="452" y="${excerptY}" font-size="17" font-family="${F}" fill="#444444" font-style="italic">${excerptWrap}</text>
<circle cx="450" cy="${avatarY}" r="20" fill="#ff0000"/>
<text x="450" y="${avatarY+6}" font-size="15" font-family="${F}" fill="#ffffff" text-anchor="middle" font-weight="bold">${escSvg((review.username||'?').charAt(0).toUpperCase())}</text>
<text x="480" y="${avatarY-5}" font-size="14" font-family="${F}" fill="#1a1a1a" font-weight="bold">${escSvg(review.username||'')}</text>
<text x="480" y="${avatarY+13}" font-size="12" font-family="${F}" fill="#888888">${escSvg(new Date(review.timestamp).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}))}</text>
<text x="1170" y="616" font-size="14" font-family="${F}" fill="#ff0000" text-anchor="end" font-weight="bold">acerbooks.ca</text>
</svg>`;
}

Deno.serve(async (req) => {
    if (req.method==='OPTIONS') return new Response('ok',{headers:CORS});
    try {
        const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
        const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
        const SITE             = 'https://acerbooks.ca';

        const url  = new URL(req.url);
        const rid  = url.searchParams.get('rid')?.trim();
        const mode = url.searchParams.get('mode');
        if (!rid) return new Response('Missing rid',{status:400,headers:CORS});

        const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const {data:review} = await sb.from('reviews')
            .select('id,book_id,username,text,rating,timestamp').eq('id',rid).maybeSingle();
        if (!review) return new Response(
            `<html><body>Not found. <a href="${SITE}">Home</a></body></html>`,
            {status:200,headers:{...CORS,'Content-Type':'text/html'}});

        const {data:book} = await sb.from('books')
            .select('id,title,author,cover').eq('id',review.book_id).maybeSingle();

        const slug         = toSlugSimple(book?.title||'');
        const canonicalUrl = `${SITE}/book/${slug}#review-${rid}`;
        const imgFnUrl     = `${SUPABASE_URL}/functions/v1/og-card?rid=${rid}&mode=img`;

        // ── Image mode ────────────────────────────────────────────────────────
        if (mode==='img') {
            const imgPath = `reviews/${rid}.png`;

            // Check Storage cache first
            const {data:cached} = await sb.storage.from('og-images')
                .download(imgPath).catch(()=>({data:null}));
            if (cached) {
                const buf = await cached.arrayBuffer();
                return new Response(buf,{
                    headers:{...CORS,'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}
                });
            }

            // Fetch cover server-side (no CORS issues here)
            let coverDataUrl=null;
            if (book?.cover) {
                const src=book.cover.startsWith('http')?book.cover
                    :`${SITE}${book.cover.startsWith('/')?'':'/'}${book.cover}`;
                try {
                    const r=await fetch(src);
                    if (r.ok){
                        const ab=await r.arrayBuffer();
                        const b64=btoa(String.fromCharCode(...new Uint8Array(ab)));
                        coverDataUrl=`data:${r.headers.get('content-type')||'image/jpeg'};base64,${b64}`;
                    }
                } catch(_){}
            }

            // Init WASM + fonts (cached after first call)
            await init();

            const svg   = buildSvg(review, book, coverDataUrl);
            const resvg = new Resvg(svg, {
                fitTo: {mode:'width', value:1200},
                font:  { fontBuffers: fontData ? [fontData] : [], loadSystemFonts: false }
            });
            const png = resvg.render().asPng();

            // Store in og-images (service role bypasses RLS)
            await sb.storage.from('og-images').upload(imgPath, png,
                {contentType:'image/png',upsert:true}).catch(e=>console.warn('cache:',e.message));

            return new Response(png,{
                headers:{...CORS,'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}
            });
        }

        // ── HTML mode ─────────────────────────────────────────────────────────
        const ogTitle = `${book?.title||'Book'} — Reader Review | Acer Books`;
        const ogDesc  = `${review.username||''} reviewed "${book?.title||''}": ${(review.text||'').substring(0,200)}`;
        const stars   = review.rating?'★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+'  ':'';

        const html=`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ogTitle)}</title>
<meta property="og:type"         content="article">
<meta property="og:url"          content="${esc(canonicalUrl)}">
<meta property="og:title"        content="${esc(ogTitle)}">
<meta property="og:description"  content="${esc(stars+ogDesc)}">
<meta property="og:image"        content="${esc(imgFnUrl)}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name"    content="Acer Books">
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(stars+ogDesc)}">
<meta name="twitter:image"       content="${esc(imgFnUrl)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}">
<style>body{font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#333}a{color:#ff0000}</style>
</head><body>
<p>Loading&hellip;</p><p><a href="${esc(canonicalUrl)}">Click here if not redirected.</a></p>
<script>window.location.replace('${canonicalUrl.replace(/'/g,"\\'")}');</script>
</body></html>`;

        return new Response(html,{status:200,headers:{
            ...CORS,'Content-Type':'text/html;charset=utf-8',
            'Cache-Control':'public,max-age=3600,stale-while-revalidate=86400'
        }});

    } catch(err) {
        console.error('og-card fatal:',err);
        return new Response(String(err),{status:500,headers:CORS});
    }
});