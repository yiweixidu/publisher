// routing.js
import { newsItems } from './data.js';
import { books } from './data.js';
import { renderBooks, renderAllBooks, renderBookDetail, renderNews, renderAllNews, renderNewsDetail, resetMetaTags, updateMetaTags } from './ui.js';
import { showAdminBooksPage, showAdminNewsPage } from './admin.js';
import { BASE_PATH } from './constants.js';
import { adminMode } from './auth.js';  // new import

export function navigateTo(path) {
    const base = BASE_PATH.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const fullPath = cleanPath ? `${base}/${cleanPath}` : base + '/'; 
    const currentFullPath = window.location.pathname;
    if (currentFullPath === fullPath) {
        handleRoute();
        return;
    }
    history.pushState(null, '', fullPath);
    handleRoute();
}

export function handleRoute() {
    let path = window.location.pathname.replace(/\/+/g, '/');
    const basePattern = new RegExp('^' + BASE_PATH.replace(/\/+$/, '') + '/?');
    path = path.replace(basePattern, '') || '/';
    
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage');
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');
    const adminNewsPage = document.getElementById('adminNewsPage');

    // Hide all pages first
    mainContent.style.display = 'none';
    booksPage.style.display = 'none';
    detailPage.style.display = 'none';
    if (newsListPage) newsListPage.style.display = 'none';
    if (newsDetailPage) newsDetailPage.style.display = 'none';
    if (adminBooksPage) adminBooksPage.style.display = 'none';
    if (adminNewsPage) adminNewsPage.style.display = 'none';

    if (path === '/' || path === '') {
        mainContent.style.display = 'block';
        renderBooks();
        renderNews();
        resetMetaTags();
    } else if (path === 'books') {
        booksPage.style.display = 'block';
        renderAllBooks();
        document.title = 'All Books | Acer Books';
    } else if (path.startsWith('book/')) {
        const bookId = path.split('book/')[1];
        const book = books.find(b => b.id === bookId);
        if (book) {
            detailPage.style.display = 'block';
            renderBookDetail(book);
            updateMetaTags(book);
        } else {
            navigateTo('/books');
        }
    } else if (path === 'news') {
        if (newsListPage) {
            newsListPage.style.display = 'block';
            renderAllNews();
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
        // Show homepage but allow the admin toggle to appear
        mainContent.style.display = 'block';
        renderBooks();
        renderNews();
        resetMetaTags();
    } else if (path === 'admin/books') {
        if (!adminMode) {
            navigateTo('/');
            return;
        }
        showAdminBooksPage();
        document.title = 'Manage Books | Acer Books';
    } else if (path === 'admin/news') {
        if (!adminMode) {
            navigateTo('/');
            return;
        }
        showAdminNewsPage();
        document.title = 'Manage News | Acer Books';
    } else {
        navigateTo('/');
    }

    // Dispatch event so main.js can update toggle visibility
    window.dispatchEvent(new CustomEvent('routeChanged'));
}