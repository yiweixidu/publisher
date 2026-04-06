// routing.js
import { newsItems } from './data.js';
import { books } from './data.js';
import { renderBooks, renderAllBooks, renderBookDetail, renderNews, renderAllNews, renderNewsDetail, resetMetaTags, updateMetaTags } from './ui.js';
import { showAdminBooksPage, showAdminNewsPage, showAdminUsersPage, showAdminCommentsPage } from './admin.js';
import { BASE_PATH } from './constants.js';
import { adminMode } from './auth.js';

// ── Pinyin helper (lazy-loaded from CDN) ────────────────────────────────────
let _pinyinFn = null;
async function _getPinyin(str) {
    if (!_pinyinFn) {
        try {
            const mod = await import('https://esm.sh/pinyin-pro@3');
            _pinyinFn = mod.pinyin;
        } catch(e) {
            console.warn('pinyin-pro load failed:', e);
            _pinyinFn = () => '';
        }
    }
    return _pinyinFn(str, { toneType: 'none', type: 'array' }).join('-');
}

// ── Slug helper ─────────────────────────────────────────────────────────────
// Converts a book title into a clean URL slug.
//
// Mixed Chinese/English:
//   "野花·繁星: Wild Flowers & Bright Stars"  →  "wild-flowers-bright-stars"
//   "自惜身薄祜——红楼奸雄贾雨村: Jia Yucun"   →  "jia-yucun"
//
// Chinese-only (no English segment):
//   "从北极到南极"   →  "cong-bei-ji-dao-nan-ji"
//   "荒原·情歌"      →  "huang-yuan-qing-ge"
export function toSlug(title) {
    if (!title) return 'book';
    const cleaned = title.replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ').trim();
    const latinPart = cleaned
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
    return latinPart || 'book'; // sync fallback; toSlugAsync used for actual URLs
}

// Async version — resolves Chinese-only titles to pinyin slugs.
// Used by handleRoute for pushState / replaceState.
export async function toSlugAsync(title) {
    if (!title) return 'book';
    const cleaned = title.replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ').trim();
    const latinPart = cleaned
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
    if (latinPart) return latinPart;
    // Pure/mostly Chinese → convert to pinyin
    const cjkOnly = cleaned.replace(/[^\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, '');
    if (!cjkOnly) return 'book';
    try {
        const py = await _getPinyin(cjkOnly);
        return py.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim() || 'book';
    } catch(e) { return 'book'; }
}

// ── Navigation ──────────────────────────────────────────────────────────────
export function navigateTo(path) {
    const base = BASE_PATH.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const fullPath = cleanPath ? `${base}/${cleanPath}` : base + '/';
    if (window.location.pathname === fullPath) { handleRoute(); return; }
    history.pushState(null, '', fullPath);
    handleRoute();
}

// ── Route handler ───────────────────────────────────────────────────────────
export async function handleRoute() {
    let path = window.location.pathname.replace(/\/+/g, '/');
    const basePattern = new RegExp('^' + BASE_PATH.replace(/\/+$/, '') + '/?');
    path = path.replace(basePattern, '') || '/';

    const mainContent    = document.getElementById('mainContent');
    const booksPage      = document.getElementById('booksPage');
    const detailPage     = document.getElementById('bookDetailPage');
    const newsListPage   = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');
    const adminNewsPage  = document.getElementById('adminNewsPage');
    const adminUsersPage    = document.getElementById('adminUsersPage');
    const adminCommentsPage = document.getElementById('adminCommentsPage');

    // Hide all
    mainContent.style.display = 'none';
    booksPage.style.display   = 'none';
    detailPage.style.display  = 'none';
    if (newsListPage)       newsListPage.style.display       = 'none';
    if (newsDetailPage)     newsDetailPage.style.display     = 'none';
    if (adminBooksPage)     adminBooksPage.style.display     = 'none';
    if (adminNewsPage)      adminNewsPage.style.display      = 'none';
    if (adminUsersPage)     adminUsersPage.style.display     = 'none';
    if (adminCommentsPage)  adminCommentsPage.style.display  = 'none';

    if (path === '/' || path === '') {
        mainContent.style.display = 'block';
        await Promise.all([renderBooks(), renderNews()]);
        resetMetaTags();
        const { updateUserUI } = await import('./auth.js');
        await updateUserUI();

    } else if (path === 'books') {
        booksPage.style.display = 'block';
        await renderAllBooks();
        document.title = 'All Books | Acer Books';

    } else if (path.startsWith('book/')) {
        const segment = path.split('book/')[1];

        // Build async slug map for all books (handles Chinese-only titles via pinyin)
        const slugMap = await Promise.all(books.map(async b => ({ book: b, slug: await toSlugAsync(b.title) })));

        // 1. Async slug match — supports pinyin slugs for Chinese-only titles
        let entry = slugMap.find(e => e.slug === segment);
        // 2. Sync slug fallback (existing behaviour for mixed titles)
        if (!entry) entry = slugMap.find(e => toSlug(e.book.title) === segment);
        // 3. ID fallback — legacy links or 404.html redirect (e.g. /book/b6)
        if (!entry) entry = slugMap.find(e => e.book.id === segment);

        const book = entry?.book;
        if (book) {
            detailPage.style.display = 'block';
            // Canonicalise URL to the async slug (pinyin for Chinese-only titles)
            const slug = entry.slug;
            const canonical = BASE_PATH.replace(/\/+$/, '') + '/book/' + slug;
            if (window.location.pathname !== canonical) {
                history.replaceState(null, '', canonical);
            }
            renderBookDetail(book);
            updateMetaTags(book);
        } else {
            navigateTo('/books');
        }

    } else if (path === 'news') {
        if (newsListPage) {
            newsListPage.style.display = 'block';
            await renderAllNews();
            document.title = 'News & Events | Acer Books';
        } else {
            navigateTo('/');
        }

    } else if (path.startsWith('news/')) {
        const newsId = path.split('news/')[1];
        const item = newsItems.find(n => n.id === newsId);
        if (item && newsDetailPage) {
            newsDetailPage.style.display = 'block';
            renderNewsDetail(item);
            document.title = item.title?.en || 'News | Acer Books';
        } else {
            navigateTo('/news');
        }

    } else if (path === 'admin') {
        mainContent.style.display = 'block';
        await Promise.all([renderBooks(), renderNews()]);
        resetMetaTags();

    } else if (path === 'admin/books') {
        if (!adminMode) {
            // Not in admin mode — silently rewrite URL to home without pushing a history entry
            history.replaceState(null, '', BASE_PATH);
            mainContent.style.display = 'block';
            await Promise.all([renderBooks(), renderNews()]);
            resetMetaTags();
            window.dispatchEvent(new CustomEvent('routeChanged'));
            return;
        }
        showAdminBooksPage();
        document.title = 'Manage Books | Acer Books';

    } else if (path === 'admin/news') {
    if (!adminMode) {
        history.replaceState(null, '', BASE_PATH);
        mainContent.style.display = 'block';
        await Promise.all([renderBooks(), renderNews()]);
        resetMetaTags();
        window.dispatchEvent(new CustomEvent('routeChanged'));
        return;
    }
    
    // ✨ 显示admin news页面
    const adminNewsPage = document.getElementById('adminNewsPage');
    if (adminNewsPage) {
        adminNewsPage.style.display = 'block';
    }
    
    // ✨ 隐藏其他页面
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.style.display = 'none';
    
    showAdminNewsPage();
    document.title = 'Manage News | Acer Books';
    window.dispatchEvent(new CustomEvent('routeChanged'));
 
    } else if (path === 'admin/users') {
        if (!adminMode) {
            history.replaceState(null, '', BASE_PATH);
            mainContent.style.display = 'block';
            await Promise.all([renderBooks(), renderNews()]);
            resetMetaTags();
            window.dispatchEvent(new CustomEvent('routeChanged'));
            return;
        }
        showAdminUsersPage();
        document.title = 'Manage Users | Acer Books';
 
    } else if (path === 'admin/comments') {
        if (!adminMode) {
            history.replaceState(null, '', BASE_PATH);
            mainContent.style.display = 'block';
            await Promise.all([renderBooks(), renderNews()]);
            resetMetaTags();
            window.dispatchEvent(new CustomEvent('routeChanged'));
            return;
        }
        showAdminCommentsPage();
        document.title = 'Manage Comments | Acer Books';
 
    } else {
        navigateTo('/');
    }

    window.dispatchEvent(new CustomEvent('routeChanged'));
}