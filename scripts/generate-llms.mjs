// =====================================================
// scripts/generate-llms.mjs
// Publisher E-commerce Platform
// =====================================================
// Author: Lewei Rong
//
// Generates the LLM-readable files for acerbooks.ca (llms.txt v2, https://llmstxt.org/):
//   books.md   — full catalogue: one entry per book, read from the Supabase `books` table
//   llms.txt   — short overview that links to books.md and about.md
//   .nojekyll  — stops GitHub Pages (Jekyll) from turning books.md into books.html
//
// about.md is written by hand and is not touched by this script.
//
// Usage (from the repository root):
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/generate-llms.mjs
//   BOOKS_JSON=sample-books.json node scripts/generate-llms.mjs   ← local test without Supabase
//
// Run automatically by .github/workflows/update-llms-txt.yml
// =====================================================

import { readFile, writeFile, access } from 'node:fs/promises';

// ── Site settings ─────────────────────────────────────────────────────────────
const SITE = 'https://acerbooks.ca';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '.';

// Same series as the "All Series" filter in index.html, in display order
const SERIES = ['Acer Series', 'Acer Novels', 'Acer Essays', 'Acer Poetry', "Children's Art"];
const OTHER_SERIES = 'Other titles';

const DESCRIPTION_MAX_CHARS = 1200;   // keeps books.md compact; the book page has the full text

// Columns read from the `books` table (anon key — same public read access as the website)
const BOOK_COLUMNS = [
    'id', 'title', 'title_fr', 'author', 'author_fr', 'price', 'price_hardcover',
    'isbn', 'publisher', 'pub_date', 'pages', 'language', 'categories',
    'description', 'stock_status', 'amazon_url',
].join(',');

// ── Load books ────────────────────────────────────────────────────────────────
async function loadBooks() {
    // Local test mode: read books from a JSON file instead of Supabase
    if (process.env.BOOKS_JSON) {
        return JSON.parse(await readFile(process.env.BOOKS_JSON, 'utf8'));
    }

    const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_ANON_KEY || '';
    if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (see constants.js for the values).');
    }

    const res = await fetch(`${url}/rest/v1/books?select=${BOOK_COLUMNS}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
        throw new Error(`Supabase request failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
}

// ── Book page URL — same slug rules as toSlugAsync() in routing.js ────────────
// Mixed titles use their Latin part; Chinese-only titles use pinyin.
let pinyinFn = null;
try {
    ({ pinyin: pinyinFn } = await import('pinyin-pro'));
} catch {
    console.warn('pinyin-pro not installed — Chinese-only titles will link to /books instead of their book page.');
}

function cleanSlug(text) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
}

function bookPageUrl(title) {
    if (!title) return `${SITE}/books`;
    const cleaned = title.replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ').trim();
    const latinPart = cleanSlug(cleaned
        .replace(/[　-鿿가-힯豈-﫿]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' '));
    if (latinPart) return `${SITE}/book/${latinPart}`;

    const cjkOnly = cleaned.replace(/[^　-鿿가-힯豈-﫿]/g, '');
    if (!cjkOnly || !pinyinFn) return `${SITE}/books`;
    const slug = cleanSlug(pinyinFn(cjkOnly, { toneType: 'none', type: 'array' }).join('-'));
    return slug ? `${SITE}/book/${slug}` : `${SITE}/books`;
}

// ── Field formatting ──────────────────────────────────────────────────────────
function toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;   // empty or NaN in the database → null
}

function formatPrices(book) {
    const pb = toNumber(book.price);
    const hc = toNumber(book.price_hardcover);
    const parts = [];
    if (pb !== null) parts.push(`CAD ${pb.toFixed(2)} paperback`);
    if (hc !== null) parts.push(`CAD ${hc.toFixed(2)} hardcover`);
    return parts.join(' · ');
}

// pub_date is free text; normalise "2025/04/21" to "2025-04-21"
function formatDate(value) {
    return String(value || '').trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, '$1-$2-$3');
}

// Quill HTML → plain text paragraphs
function htmlToText(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .split('\n').map(line => line.trim()).filter(Boolean).join('\n\n');
}

function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + ' …';
}

// Amazon link set by the owner in Manage Books; otherwise an Amazon search by ISBN or title
function amazonLink(book) {
    if (book.amazon_url && /^https?:\/\//.test(book.amazon_url)) {
        return { url: book.amazon_url, label: 'Buy on Amazon' };
    }
    const query = encodeURIComponent(book.isbn || book.title || '');
    return { url: `https://www.amazon.ca/s?k=${query}`, label: 'Search on Amazon' };
}

function seriesOf(book) {
    return SERIES.find(s => (book.categories || []).includes(s)) || OTHER_SERIES;
}

// Same A–Z idea as the website: Chinese compared by pinyin
const collator = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
function sortKey(text) {
    const t = String(text || '');
    if (!pinyinFn || !/[㐀-鿿]/.test(t)) return t.toLowerCase();
    const chars = Array.from(t);
    const syllables = pinyinFn(t, { toneType: 'none', type: 'array' });
    if (syllables.length !== chars.length) return t.toLowerCase();
    return chars.map((ch, i) => /[㐀-鿿]/.test(ch) ? syllables[i] + ' ' : ch).join('').toLowerCase();
}

// ── books.md ──────────────────────────────────────────────────────────────────
function bookEntry(book) {
    const lines = [`### ${book.title}`, ''];
    const add = (label, value) => { if (value) lines.push(`- ${label}: ${value}`); };

    add('Author', book.author);
    if (book.author_fr && book.author_fr !== book.author) add('Author (French)', book.author_fr);
    if (book.title_fr && book.title_fr !== book.title) add('French title', book.title_fr);
    add('Language', book.language);
    add('Published', formatDate(book.pub_date));
    add('Publisher', book.publisher || 'Acer Books Canada');
    add('ISBN', book.isbn);
    add('Pages', book.pages);
    add('Price', formatPrices(book));
    add('Availability', book.stock_status);
    add('Book page', bookPageUrl(book.title));
    const amazon = amazonLink(book);
    add(amazon.label, amazon.url);

    const description = htmlToText(book.description);
    if (description) lines.push('', truncate(description, DESCRIPTION_MAX_CHARS));
    return lines.join('\n');
}

function buildBooksMd(books, today) {
    const groups = new Map([...SERIES, OTHER_SERIES].map(s => [s, []]));
    books.forEach(b => groups.get(seriesOf(b)).push(b));

    const sections = [];
    for (const [series, list] of groups) {
        if (list.length === 0) continue;
        list.sort((a, b) => collator.compare(sortKey(a.title), sortKey(b.title)));
        sections.push(`## ${series} (${list.length})\n\n${list.map(bookEntry).join('\n\n')}`);
    }

    return [
        '# Acer Books Canada — Book Catalogue',
        '',
        `> All ${books.length} titles published by Acer Books Canada, an independent publisher in Montréal, Québec. ` +
        'Prices are in Canadian dollars (CAD). Books are sold on Amazon; each entry links to its Amazon page or an Amazon search.',
        '',
        `Generated from the publisher's database on ${today}. Book pages on acerbooks.ca need JavaScript; this file has the same information as plain text.`,
        '',
        sections.join('\n\n'),
        '',
    ].join('\n');
}

// ── llms.txt ──────────────────────────────────────────────────────────────────
function buildLlmsTxt(books, today) {
    const counts = SERIES
        .map(s => [s, books.filter(b => seriesOf(b) === s).length])
        .filter(([, n]) => n > 0)
        .map(([s, n]) => `${s} (${n})`)
        .join(', ');

    return [
        '# Acer Books Canada',
        '',
        '> Acer Books Canada is an independent publisher based in Montréal, Québec, founded by translator and scholar Tao Zhijian, PhD. ' +
        "It publishes poetry, fiction, essays, literary translation and children's art books in Chinese, English and French, " +
        'distributed worldwide through Amazon and bookstores including Harvard Book Store, Hatchards, Barnes & Noble, Kraina Książek and Kinokuniya.',
        '',
        `- The catalogue has ${books.length} titles in these series: ${counts}.`,
        '- Books are purchased on Amazon; each catalogue entry links to its Amazon page.',
        '- Prices are in Canadian dollars (CAD).',
        '- Many titles are bilingual (Chinese–English) or trilingual (Chinese–English–French).',
        '- The website (acerbooks.ca) is in English and French and renders with JavaScript; use the Markdown files below for its content.',
        '',
        '## Catalogue',
        '',
        `- [Book catalogue](${SITE}/books.md): every title with author, language, publication date, series, ISBN, price, description and Amazon link (updated ${today})`,
        '',
        '## Publisher',
        '',
        `- [About Acer Books](${SITE}/about.md): founder, editorial focus and distribution`,
        '',
        '## Optional',
        '',
        `- [All books (website)](${SITE}/books): browsable catalogue with search and filters (HTML, needs JavaScript)`,
        `- [News & events (website)](${SITE}/news): readings, launches and events (HTML, needs JavaScript)`,
        '',
    ].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Writes the file only when the content changed, ignoring the date line,
// so the daily run does not create a commit when no book changed.
async function writeIfChanged(path, content) {
    const stripDate = s => s.replace(/\d{4}-\d{2}-\d{2}(?=[).])/g, '');
    let old = null;
    try { old = await readFile(path, 'utf8'); } catch { /* new file */ }
    if (old !== null && stripDate(old) === stripDate(content)) {
        console.log(`unchanged: ${path}`);
        return;
    }
    await writeFile(path, content, 'utf8');
    console.log(`written:   ${path}`);
}

const books = (await loadBooks()).filter(b => b && b.title);
if (books.length === 0) throw new Error('No books returned — not overwriting the existing files.');

const today = new Date().toISOString().slice(0, 10);
await writeIfChanged(`${OUTPUT_DIR}/books.md`, buildBooksMd(books, today));
await writeIfChanged(`${OUTPUT_DIR}/llms.txt`, buildLlmsTxt(books, today));

try { await access(`${OUTPUT_DIR}/.nojekyll`); }
catch { await writeFile(`${OUTPUT_DIR}/.nojekyll`, ''); console.log(`written:   ${OUTPUT_DIR}/.nojekyll`); }

console.log(`Done: ${books.length} books.`);
