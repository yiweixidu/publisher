// ============================================
// routing.js
// Publisher E-commerce Platform
// ============================================
// Authors:
//   Lewei Rong            — All existing routing logic
//                           (slug helpers, navigateTo,
//                            handleRoute, all admin routes)
//   Ana-Laurya Lefrancois — /admin/orders route (Card 8)
//                           + adminOrdersPage hide (Card 8)
//                           /admin/static-pages route (Card 10)
//                           + adminStaticPagesPage hide (Card 10)
// ============================================

import { newsItems } from './data.js';
import { books } from './data.js';
import { renderBooks, renderAllBooks, renderBookDetail, renderNews, renderAllNews, renderNewsDetail, resetMetaTags, updateMetaTags } from './ui.js';
// Ana-Laurya Lefrancois added showAdminOrdersPage (Card 8)
// Ana-Laurya Lefrancois added showAdminStaticPagesPage (Card 10)
import { showAdminBooksPage, showAdminNewsPage, showAdminUsersPage, showAdminCommentsPage, showAdminOrdersPage, showAdminStaticPagesPage } from './admin.js';
import { BASE_PATH } from './constants.js';
import { adminMode } from './auth.js';

// ============================================
// PINYIN HELPER
// Author: Lewei Rong
// Lazy-loaded from CDN — used for Chinese-only title slugs
// ============================================

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

// ============================================
// SLUG HELPERS
// Author: Lewei Rong
// Converts book titles to clean URL slugs.
// Mixed Chinese/English → extracts Latin portion.
// Chinese-only → converts to pinyin (async version only).
// ============================================

export function toSlug(title) {
    if (!title) return 'book';
    const cleaned = title.replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ').trim();
    const latinPart = cleaned
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
    return latinPart || 'book';
}

// Async version — resolves Chinese-only titles to pinyin slugs
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

// ============================================
// NAVIGATION
// Author: Lewei Rong
// Pushes a new history entry and calls handleRoute()
// ============================================

export function navigateTo(path) {
    const base = BASE_PATH.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const fullPath = cleanPath ? `${base}/${cleanPath}` : base + '/';
    if (window.location.pathname === fullPath) { handleRoute(); return; }
    history.pushState(null, '', fullPath);
    handleRoute();
}

// ============================================
// ROUTE HANDLER
// Author: Lewei Rong
// Ana-Laurya Lefrancois added:
//   - adminOrdersPage to hide-all list (Card 8)
//   - /admin/orders route (Card 8)
//   - adminStaticPagesPage to hide-all list (Card 10)
//   - /admin/static-pages route (Card 10)
// ============================================

export async function handleRoute() {
    let path = window.location.pathname.replace(/\/+/g, '/');
    const basePattern = new RegExp('^' + BASE_PATH.replace(/\/+$/, '') + '/?');
    path = path.replace(basePattern, '') || '/';

    const mainContent          = document.getElementById('mainContent');
    const booksPage            = document.getElementById('booksPage');
    const detailPage           = document.getElementById('bookDetailPage');
    const newsListPage         = document.getElementById('newsListPage');
    const newsDetailPage       = document.getElementById('newsDetailPage');
    const adminBooksPage       = document.getElementById('adminBooksPage');
    const adminNewsPage        = document.getElementById('adminNewsPage');
    const adminUsersPage       = document.getElementById('adminUsersPage');
    const adminCommentsPage    = document.getElementById('adminCommentsPage');
    const adminOrdersPage      = document.getElementById('adminOrdersPage');      // Ana-Laurya — Card 8
    const adminStaticPagesPage = document.getElementById('adminStaticPagesPage'); // Ana-Laurya — Card 10

    // Hide all pages before showing the matched route
    mainContent.style.display          = 'none';
    booksPage.style.display            = 'none';
    detailPage.style.display           = 'none';
    if (newsListPage)          newsListPage.style.display          = 'none';
    if (newsDetailPage)        newsDetailPage.style.display        = 'none';
    if (adminBooksPage)        adminBooksPage.style.display        = 'none';
    if (adminNewsPage)         adminNewsPage.style.display         = 'none';
    if (adminUsersPage)        adminUsersPage.style.display        = 'none';
    if (adminCommentsPage)     adminCommentsPage.style.display     = 'none';
    if (adminOrdersPage)       adminOrdersPage.style.display       = 'none'; // Ana-Laurya — Card 8
    if (adminStaticPagesPage)  adminStaticPagesPage.style.display  = 'none'; // Ana-Laurya — Card 10

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

        // Build async slug map — handles Chinese-only titles via pinyin
        const slugMap = await Promise.all(books.map(async b => ({ book: b, slug: await toSlugAsync(b.title) })));

        // 1. Async slug match
        let entry = slugMap.find(e => e.slug === segment);
        // 2. Sync slug fallback (mixed titles)
        if (!entry) entry = slugMap.find(e => toSlug(e.book.title) === segment);
        // 3. ID fallback — legacy links or 404.html redirect
        if (!entry) entry = slugMap.find(e => e.book.id === segment);

        const book = entry?.book;
        if (book) {
            detailPage.style.display = 'block';
            // Canonicalise URL to async slug
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
            // Not admin — silently redirect to home without pushing history
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
        // Show admin news page and hide main content
        const adminNewsPage = document.getElementById('adminNewsPage');
        if (adminNewsPage) adminNewsPage.style.display = 'block';
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

    // ── /admin/orders — Ana-Laurya Lefrancois (Card 8) ───────────────────────
    // Same auth guard pattern as all other admin routes — redirects to home
    // if not in admin mode. Calls showAdminOrdersPage() from admin.js.
    } else if (path === 'admin/orders') {
        if (!adminMode) {
            history.replaceState(null, '', BASE_PATH);
            mainContent.style.display = 'block';
            await Promise.all([renderBooks(), renderNews()]);
            resetMetaTags();
            window.dispatchEvent(new CustomEvent('routeChanged'));
            return;
        }
        showAdminOrdersPage();
        document.title = 'Manage Orders | Acer Books';

    // ── /admin/static-pages — Ana-Laurya Lefrancois (Card 10) ────────────────
    // Same auth guard pattern as all other admin routes — redirects to home
    // if not in admin mode. Calls showAdminStaticPagesPage() from admin.js.
    } else if (path === 'admin/static-pages') {
        if (!adminMode) {
            history.replaceState(null, '', BASE_PATH);
            mainContent.style.display = 'block';
            await Promise.all([renderBooks(), renderNews()]);
            resetMetaTags();
            window.dispatchEvent(new CustomEvent('routeChanged'));
            return;
        }
        showAdminStaticPagesPage();
        document.title = 'Manage Pages | Acer Books';

    } else {
        navigateTo('/');
    }

    window.dispatchEvent(new CustomEvent('routeChanged'));
}
