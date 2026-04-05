// routing.js
import { newsItems } from './data.js';
import { books } from './data.js';
import { renderBooks, renderAllBooks, renderBookDetail, renderNews, renderAllNews, renderNewsDetail, resetMetaTags, updateMetaTags } from './ui.js';
import { showAdminBooksPage, showAdminNewsPage, showAdminUsersPage, showAdminCommentsPage } from './admin.js';
import { BASE_PATH } from './constants.js';
import { adminMode } from './auth.js';

// ── Slug helper ─────────────────────────────────────────────────────────────
// Converts a book's English title into a clean URL slug.
// Handles mixed Chinese/English titles, e.g.:
//   "野花·繁星: Wild Flowers & Bright Stars"  →  "wild-flowers-bright-stars"
//   "自惜身薄祜——红楼奸雄贾雨村: Jia Yucun Character Analysis"  →  "jia-yucun-character-analysis"
export function toSlug(title) {
    if (!title) return 'book';
    return title
        .replace(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ') // strip CJK
        .replace(/[：:·•—–()\[\]《》「」『』【】]/g, ' ')             // strip delimiters
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')                             // strip remaining non-ascii
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim() || 'book';
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

        // 1. Slug match — primary (e.g. /book/jia-yucun-character-analysis)
        let book = books.find(b => toSlug(b.title) === segment);
        // 2. ID fallback — legacy links or 404.html redirect (e.g. /book/b6)
        if (!book) book = books.find(b => b.id === segment);

        if (book) {
            detailPage.style.display = 'block';
            // Silently canonicalise the URL to the slug form
            const slug = toSlug(book.title);
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