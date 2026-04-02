// ui.js – final version with error handling and logging
import { adminMode, currentUser } from './auth.js';
import { books, newsItems, loadBooks, loadNews, saveBooks, saveNews } from './data.js';
import { langPack, currentLang, setLanguage as i18nSetLanguage } from './i18n.js';
import { addToCart } from './cart.js';
import { renderReviews, renderDetailReviews } from './review.js';
import { navigateTo, toSlug } from './routing.js';
import { renderCartModal } from './cart.js';

// DOM elements
const grid = document.getElementById('bookGrid');
const newsGrid = document.getElementById('newsGrid');
const modalOverlay = document.getElementById('bookModal');
const modalCover = document.getElementById('modalCover');
const modalTitle = document.getElementById('modalTitle');
const modalAuthor = document.getElementById('modalAuthor');
const modalPrice = document.getElementById('modalPrice');
const modalAvailability = document.getElementById('modalAvailability');
const modalIsbn = document.getElementById('modalIsbn');
const modalPublisher = document.getElementById('modalPublisher');
const modalPubDate = document.getElementById('modalPubDate');
const modalPages = document.getElementById('modalPages');
const modalDescription = document.getElementById('modalDescription');
const modalAuthorBio = document.getElementById('modalAuthorBio');
const modalCategories = document.getElementById('modalCategories');
const modalLanguage = document.getElementById('modalLanguage');
const modalAddToCart = document.getElementById('modalAddToCart');
const modalAddToWishList = document.getElementById('modalAddToWishList');
const langEn = document.getElementById('langEn');
const langFr = document.getElementById('langFr');
const cartModal = document.getElementById('cartModal');
const newsListPage = document.getElementById('newsListPage');
const newsDetailPage = document.getElementById('newsDetailPage');
const allNewsGrid = document.getElementById('allNewsGrid');
const newsDetailTitle = document.getElementById('newsDetailTitle');
const newsDetailDate = document.getElementById('newsDetailDate');
const newsDetailImage = document.getElementById('newsDetailImage');
const newsDetailSummary = document.getElementById('newsDetailSummary');
const booksGridAll = document.getElementById('booksGrid');
const detailPage = document.getElementById('bookDetailPage');
const booksPage = document.getElementById('booksPage');

export let currentModalBook = null;
export let currentNewsItem = null;
export let currentModalFormat = 'paperback'; // tracks selected format in modal/detail

// Fix relative cover paths (DB stores e.g. "zhijian/image.jpg" → "/zhijian/image.jpg")
function normalizeCover(cover) {
    if (!cover) return '';
    if (cover.startsWith('http') || cover.startsWith('/') || cover.startsWith('data:')) return cover;
    return '/' + cover;
}

// ---------- Translation ----------
export function translateUI(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langPack[lang] && langPack[lang][key] !== undefined) {
            el.innerHTML = langPack[lang][key];
        }
    });
    if (lang === 'en') {
        langEn?.classList.add('active');
        langFr?.classList.remove('active');
    } else {
        langFr?.classList.add('active');
        langEn?.classList.remove('active');
    }
}

function initModalTabs() {
    const tabs = document.querySelectorAll('.modal-tab');
    const panes = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPane = document.getElementById(`tab-${target}`);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

document.addEventListener('DOMContentLoaded', initModalTabs);

// ============================================
// Language Switcher — Dynamic Content Handler
// FR #7 — Language Switcher | Card 18
// Acer Books — Publisher E-commerce Platform
// Contributor: Ana-Laurya Fay
// Date: 2026-03-29
// ============================================
// Listens for the custom 'languageChanged' event fired by setLanguage() in i18n.js
// Re-renders all visible dynamic content in the selected language
// Fulfills checklist item: "Ensure dynamic content (books, news) switches language"

function handleLanguageChange(event) {
    const lang = event.detail; // extract selected language from event
    translateUI(lang); // update all static UI text
    renderNews(); // re-render news section
    renderBooks(); // added by Ana-Laurya Fay — re-renders homepage book grid
    if (modalOverlay?.classList.contains('active')) updateModalLanguage(); // update open book modal if active
    if (cartModal?.classList.contains('active')) renderCartModal(); // update open cart if active
    if (newsListPage && newsListPage.style.display === 'block') renderAllNews(); // update news list page if visible
    if (newsDetailPage && newsDetailPage.style.display === 'block' && currentNewsItem) renderNewsDetail(currentNewsItem); // update news detail page if visible
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) { // update book detail page if visible
        updateDetailLanguage(currentModalBook); // update book detail text in selected language
        renderDetailReviews(currentModalBook.id, lang, currentUser); // update reviews in selected language
    }
    if (booksPage && booksPage.style.display === 'block') renderAllBooks(); // update full books page if visible
}

window.addEventListener('languageChanged', handleLanguageChange);

export function setLanguage(lang) {
    i18nSetLanguage(lang);
}

function generateBookCardHTML(book, adminMode, currentLang) {
    let displayTitle, displayAuthor;
    if (currentLang === 'fr') {
        displayTitle = book.title_fr || book.title;
        displayAuthor = book.author_fr || book.author;
    } else {
        displayTitle = book.title;
        displayAuthor = book.author;
    }
    const cover = normalizeCover(book.cover);
    let coverStyle = cover
        ? `background-image: url('${cover}'); background-size: cover; background-position: center;`
        : `background: #2d2d2d;`;
    const deleteBtn = adminMode ? `<button class="delete-book" data-id="${book.id}"><i class="fas fa-trash-alt"></i></button>` : '';
    const pbPrice = parseFloat(book.price || 0);
    const hcPrice = book.price_hardcover ? parseFloat(book.price_hardcover) : null;
    const priceRow = `
        <div class="book-price-row">
            <span class="book-price" id="card-price-${book.id}">$${pbPrice.toFixed(2)}</span>
            ${hcPrice ? `<div class="fmt-toggle" data-book-id="${book.id}" data-pb="${pbPrice}" data-hc="${hcPrice}">
                <span class="fmt-btn active" data-fmt="paperback">PB</span>
                <span class="fmt-sep">|</span>
                <span class="fmt-btn" data-fmt="hardcover">HC</span>
            </div>` : ''}
        </div>`;
    return `
        <div class="book-card" data-id="${book.id}">
            <div class="book-cover" style="${coverStyle} background-color: #2d2d2d;">
                ${displayTitle.length > 25 ? displayTitle.substr(0,22)+'…' : displayTitle}
            </div>
            <div class="book-meta">
                <div class="book-title">${displayTitle}</div>
                <div class="book-author">${displayAuthor}</div>
                ${priceRow}
                ${adminMode ? `<div class="admin-controls">${deleteBtn}</div>` : ''}
            </div>
        </div>
    `;
}

function attachFormatToggleEvents(container) {
    container.querySelectorAll('.fmt-toggle').forEach(toggle => {
        toggle.querySelectorAll('.fmt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookId  = toggle.dataset.bookId;
                const fmt     = btn.dataset.fmt;
                const pb      = parseFloat(toggle.dataset.pb);
                const hc      = parseFloat(toggle.dataset.hc);
                const priceEl = document.getElementById(`card-price-${bookId}`);
                toggle.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (priceEl) priceEl.textContent = `$${(fmt === 'hardcover' ? hc : pb).toFixed(2)}`;
            });
        });
    });
}

function attachBookDeleteEvents(container, renderCallback) {
    if (!adminMode) return;
    container.querySelectorAll('.delete-book').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const newBooks = books.filter(b => b.id !== id);
            await saveBooks(newBooks);
            renderCallback();
        });
    });
}

export async function renderBooks() {
    console.log('renderBooks called');
    try {
        // Ensure books are loaded
        if (books.length === 0) {
            console.log('Loading books...');
            await loadBooks();
            console.log(`Loaded ${books.length} books.`);
        }
        let booksToShow = books;
        if (!adminMode) {
            const width = window.innerWidth;
            let count;
            if (width < 600) count = 6;
            else if (width < 800) count = 6;
            else if (width < 1000) count = 6;
            else if (width < 1200) count = 8;
            else if (width < 1400) count = 5;
            else count = 6;
            const shuffled = [...books];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            booksToShow = shuffled.slice(0, count);
        }
        let html = '';
        booksToShow.forEach(book => { html += generateBookCardHTML(book, false, currentLang); });
        if (grid) grid.innerHTML = html;
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.admin-controls') || e.target.closest('.fmt-toggle')) return;
                const bookId = card.dataset.id;
                const book = books.find(b => b.id === bookId);
                if (book) openModal(book);
            });
        });
        attachFormatToggleEvents(grid);
        // attachBookDeleteEvents(grid, renderBooks);
    } catch (err) {
        console.error('Error rendering books:', err);
        if (grid) grid.innerHTML = '<p>Error loading books. Please refresh or try again later.</p>';
    }
}

// ── Category mapping ────────────────────────────────────────────────────────
const CAT_GROUPS = {
    poems:      b => (b.categories||[]).some(c=>/poetry|poem/i.test(c)),
    novels:     b => (b.categories||[]).some(c=>/novel|fiction|prose/i.test(c)),
    children:   b => (b.categories||[]).some(c=>/children|youth|kid/i.test(c)),
    literature: b => (b.categories||[]).some(c=>/essay|literature|translation|travel|photo|antholog/i.test(c)),
};
let booksActiveCategory = 'all';

// ── Books-page state ────────────────────────────────────────────────────────
const BOOKS_PER_PAGE = 12;
let booksCurrentPage  = 1;
let booksViewMode     = 'grid';
let booksActiveFilters = { search:'', lang:'', author:'', priceMin:'', priceMax:'', sort:'title' };

function getBooksFromURL() {
    const p = new URLSearchParams(window.location.search);
    booksCurrentPage    = parseInt(p.get('page') || '1', 10);
    booksViewMode       = p.get('view') || 'grid';
    booksActiveCategory = p.get('cat') || 'all';
    booksActiveFilters  = {
        search:   p.get('search')   || '',
        lang:     p.get('lang')     || '',
        author:   p.get('author')   || '',
        priceMin: p.get('priceMin') || '',
        priceMax: p.get('priceMax') || '',
        sort:     p.get('sort')     || 'title',
    };
}

function pushBooksToURL() {
    const p = new URLSearchParams();
    if (booksCurrentPage > 1)                p.set('page',     booksCurrentPage);
    if (booksViewMode !== 'grid')             p.set('view',     booksViewMode);
    if (booksActiveCategory !== 'all')        p.set('cat',      booksActiveCategory);
    if (booksActiveFilters.search)            p.set('search',   booksActiveFilters.search);
    if (booksActiveFilters.lang)              p.set('lang',     booksActiveFilters.lang);
    if (booksActiveFilters.author)            p.set('author',   booksActiveFilters.author);
    if (booksActiveFilters.priceMin)          p.set('priceMin', booksActiveFilters.priceMin);
    if (booksActiveFilters.priceMax)          p.set('priceMax', booksActiveFilters.priceMax);
    if (booksActiveFilters.sort !== 'title')  p.set('sort',     booksActiveFilters.sort);
    const qs = p.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
}

function applyBooksFilters(allBooks) {
    let list = [...allBooks];
    // Category tab
    if (booksActiveCategory !== 'all' && CAT_GROUPS[booksActiveCategory]) {
        list = list.filter(CAT_GROUPS[booksActiveCategory]);
    }
    const { search, lang, author, priceMin, priceMax, sort } = booksActiveFilters;
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(b => {
            const t = (currentLang==='fr'?(b.title_fr||b.title):b.title||'').toLowerCase();
            const a = (currentLang==='fr'?(b.author_fr||b.author):b.author||'').toLowerCase();
            return t.includes(q) || a.includes(q);
        });
    }
    if (lang)   list = list.filter(b => (b.language||'').toLowerCase().includes(lang.toLowerCase()));
    if (author) list = list.filter(b => {
        const a = currentLang==='fr'?(b.author_fr||b.author):b.author;
        return a === author;
    });
    const pMin = parseFloat(priceMin), pMax = parseFloat(priceMax);
    if (!isNaN(pMin)) list = list.filter(b => parseFloat(b.price) >= pMin);
    if (!isNaN(pMax)) list = list.filter(b => parseFloat(b.price) <= pMax);
    list.sort((a, b) => {
        if (sort === 'author')     { return (currentLang==='fr'?(a.author_fr||a.author):a.author||'').localeCompare(currentLang==='fr'?(b.author_fr||b.author):b.author||''); }
        if (sort === 'price_asc')  return parseFloat(a.price) - parseFloat(b.price);
        if (sort === 'price_desc') return parseFloat(b.price) - parseFloat(a.price);
        if (sort === 'pub_date')   return new Date(b.pub_date||0) - new Date(a.pub_date||0);
        const ta = currentLang==='fr'?(a.title_fr||a.title):a.title||'';
        const tb = currentLang==='fr'?(b.title_fr||b.title):b.title||'';
        return ta.localeCompare(tb);
    });
    return list;
}

function generateBookListRowHTML(book) {
    const title  = currentLang==='fr'&&book.title_fr  ? book.title_fr  : book.title;
    const author = currentLang==='fr'&&book.author_fr ? book.author_fr : book.author;
    const cover  = normalizeCover(book.cover);
    return `
        <div class="book-list-row" data-id="${book.id}">
            <div class="book-list-cover" style="${cover?`background-image:url('${cover}');background-size:cover;background-position:center;`:'background:#2d2d2d;'}"></div>
            <div class="book-list-info">
                <div class="book-list-title">${title}</div>
                <div class="book-list-author">${author}</div>
                <div class="book-list-meta">${book.language||''} · ${book.pub_date||''}</div>
            </div>
            <div class="book-list-price">$${parseFloat(book.price||0).toFixed(2)}</div>
        </div>`;
}

function renderBooksPagePagination(total) {
    const paginationEl = document.getElementById('booksPagination');
    if (!paginationEl) return;
    const totalPages = Math.ceil(total / BOOKS_PER_PAGE);
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${booksCurrentPage===1?'disabled':''} data-page="${booksCurrentPage-1}"><i class="fas fa-chevron-left"></i></button>`;
    for (let i=1; i<=totalPages; i++) {
        if (totalPages>7 && i>2 && i<totalPages-1 && Math.abs(i-booksCurrentPage)>1) {
            if (i===3||i===totalPages-2) html += `<span class="page-ellipsis">…</span>`; continue;
        }
        html += `<button class="page-btn ${i===booksCurrentPage?'active':''}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" ${booksCurrentPage===totalPages?'disabled':''} data-page="${booksCurrentPage+1}"><i class="fas fa-chevron-right"></i></button>`;
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            booksCurrentPage = parseInt(btn.dataset.page, 10);
            pushBooksToURL(); renderAllBooks();
            booksPage?.scrollIntoView({behavior:'smooth', block:'start'});
        });
    });
}

function syncBooksFilterUI() {
    const si=document.getElementById('booksSearchInput'), lf=document.getElementById('booksLangFilter'),
          af=document.getElementById('booksAuthorFilter'), sf=document.getElementById('booksSortFilter'),
          pMin=document.getElementById('booksPriceMin'), pMax=document.getElementById('booksPriceMax');
    if (si) si.value = booksActiveFilters.search;
    if (lf) lf.value = booksActiveFilters.lang;
    if (sf) sf.value = booksActiveFilters.sort;
    if (pMin) pMin.value = booksActiveFilters.priceMin;
    if (pMax) pMax.value = booksActiveFilters.priceMax;
    if (af) {
        const authors = [...new Set(books.map(b=>(currentLang==='fr'?(b.author_fr||b.author):b.author)).filter(Boolean))].sort();
        af.innerHTML = `<option value="">${langPack[currentLang].filterAllAuthors||'All Authors'}</option>`;
        authors.forEach(a => { af.innerHTML += `<option value="${a}" ${a===booksActiveFilters.author?'selected':''}>${a}</option>`; });
    }
    document.getElementById('booksGridViewBtn')?.classList.toggle('active', booksViewMode==='grid');
    document.getElementById('booksListViewBtn')?.classList.toggle('active', booksViewMode==='list');
    // Sync category tabs
    document.querySelectorAll('.cat-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === booksActiveCategory);
    });
}

let booksEventsAttached = false;

function attachBooksEvents() {
    const applyBtn = document.getElementById('booksFilterApply');
    const resetBtn = document.getElementById('booksFilterReset');
    document.getElementById('booksSearchInput')?.addEventListener('keydown', e => { if (e.key==='Enter') applyBtn?.click(); });
    applyBtn?.addEventListener('click', () => {
        booksActiveFilters = {
            search:   document.getElementById('booksSearchInput')?.value.trim()||'',
            lang:     document.getElementById('booksLangFilter')?.value||'',
            author:   document.getElementById('booksAuthorFilter')?.value||'',
            priceMin: document.getElementById('booksPriceMin')?.value||'',
            priceMax: document.getElementById('booksPriceMax')?.value||'',
            sort:     document.getElementById('booksSortFilter')?.value||'title',
        };
        booksCurrentPage = 1; pushBooksToURL(); renderAllBooks();
    });
    resetBtn?.addEventListener('click', () => {
        booksActiveFilters = {search:'',lang:'',author:'',priceMin:'',priceMax:'',sort:'title'};
        booksCurrentPage = 1; pushBooksToURL(); renderAllBooks();
    });
    document.getElementById('booksGridViewBtn')?.addEventListener('click', ()=>{ booksViewMode='grid'; pushBooksToURL(); renderAllBooks(); });
    document.getElementById('booksListViewBtn')?.addEventListener('click', ()=>{ booksViewMode='list'; pushBooksToURL(); renderAllBooks(); });
    // Category tabs
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            booksActiveCategory = tab.dataset.cat;
            booksCurrentPage = 1; pushBooksToURL(); renderAllBooks();
        });
    });
}

export function resetBooksPageState() {
    booksEventsAttached = false; booksCurrentPage = 1; booksActiveCategory = 'all';
    booksActiveFilters = {search:'',lang:'',author:'',priceMin:'',priceMax:'',sort:'title'};
}

export async function renderAllBooks() {
    try {
        if (books.length === 0) await loadBooks();
        if (!booksEventsAttached) { getBooksFromURL(); attachBooksEvents(); booksEventsAttached = true; }
        syncBooksFilterUI();

        const filtered   = applyBooksFilters(books);
        const total      = filtered.length;
        const totalPages = Math.ceil(total / BOOKS_PER_PAGE) || 1;
        if (booksCurrentPage > totalPages) booksCurrentPage = 1;
        const pageBooks  = filtered.slice((booksCurrentPage-1)*BOOKS_PER_PAGE, booksCurrentPage*BOOKS_PER_PAGE);

        const countEl = document.getElementById('booksResultCount');
        if (countEl) countEl.textContent = currentLang==='fr'
            ? `${pageBooks.length} livre${pageBooks.length!==1?'s':''} sur ${total}`
            : `Showing ${pageBooks.length} of ${total} book${total!==1?'s':''}`;

        if (booksGridAll) {
            if (booksViewMode === 'list') {
                booksGridAll.className = 'book-list';
                booksGridAll.innerHTML = pageBooks.map(b => generateBookListRowHTML(b)).join('');
                booksGridAll.querySelectorAll('.book-list-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const book = books.find(b => b.id === row.dataset.id);
                        if (book) navigateTo(`/book/${toSlug(book.title)}`);
                    });
                });
            } else {
                booksGridAll.className = 'book-grid';
                booksGridAll.innerHTML = pageBooks.map(b => generateBookCardHTML(b, false, currentLang)).join('');
                booksGridAll.querySelectorAll('.book-card').forEach(card => {
                    card.addEventListener('click', e => {
                        if (e.target.closest('.fmt-toggle')) return;
                        const book = books.find(b => b.id === card.dataset.id);
                        if (book) navigateTo(`/book/${toSlug(book.title)}`);
                    });
                });
                attachFormatToggleEvents(booksGridAll);
            }
        }
        renderBooksPagePagination(total);
    } catch (err) {
        console.error('Error rendering all books:', err);
        if (booksGridAll) booksGridAll.innerHTML = '<p>Error loading books.</p>';
    }
}

function generateNewsItemHTML(item, adminMode, currentLang) {
    const title = (item.title && typeof item.title === 'object') ? (item.title[currentLang] || item.title.en || '') : item.title || '';
    const summary = (item.summary && typeof item.summary === 'object') ? (item.summary[currentLang] || item.summary.en || '') : item.summary || '';
    const imageHtml = item.image ? `<div class="news-image" style="background-image: url('${item.image}');"></div>` : `<div class="news-image" style="background-color: #ccc;"></div>`;
    const deleteBtn = adminMode ? `<button class="delete-news" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>` : '';
    return `
        <div class="news-item" data-id="${item.id}">
            ${imageHtml}
            <div class="news-date">${item.display_date || ''}</div>
            <div class="news-title">${title}</div>
            <div class="news-summary">${summary}</div>
            ${adminMode ? `<div class="news-footer">${deleteBtn}</div>` : ''}
        </div>
    `;
}

function attachNewsDeleteEvents(container, renderCallback) {
    if (!adminMode) return;
    container.querySelectorAll('.delete-news').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const newNews = newsItems.filter(n => n.id !== id);
            await saveNews(newNews);
            renderCallback();
            if (currentNewsItem && currentNewsItem.id === id) navigateTo('/news');
        });
    });
}

export async function renderNews() {
    console.log('renderNews called');
    try {
        if (newsItems.length === 0) {
            console.log('Loading news...');
            await loadNews();
            console.log(`Loaded ${newsItems.length} news items.`);
        }
        let filtered = newsItems;
        if (!adminMode) {
            filtered = newsItems.filter(item => item.status === 'published');
        }
        const sorted = [...filtered].sort((a, b) => {
            const dateA = a.event_date ? new Date(a.event_date) : 0;
            const dateB = b.event_date ? new Date(b.event_date) : 0;
            return dateB - dateA;
        });
        const latest = sorted.slice(0, 3);
        let html = '';
        latest.forEach(item => { html += generateNewsItemHTML(item, false, currentLang); });
        if (newsGrid) newsGrid.innerHTML = html;
        document.querySelectorAll('#newsGrid .news-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-news')) return;
                const id = card.dataset.id;
                navigateTo(`/news/${id}`);
            });
        });
    } catch (err) {
        console.error('Error rendering news:', err);
        if (newsGrid) newsGrid.innerHTML = '<p>Error loading news.</p>';
    }
}

export async function renderAllNews() {
    try {
        if (newsItems.length === 0) await loadNews();
        let filtered = newsItems;
        if (!adminMode) {
            filtered = newsItems.filter(item => item.status === 'published');
        }
        const sorted = [...filtered].sort((a, b) => {
            const dateA = a.event_date ? new Date(a.event_date) : 0;
            const dateB = b.event_date ? new Date(b.event_date) : 0;
            return dateB - dateA;
        });
        let html = '';
        sorted.forEach(item => { html += generateNewsItemHTML(item, false, currentLang); });
        if (allNewsGrid) allNewsGrid.innerHTML = html;
        document.querySelectorAll('#allNewsGrid .news-item').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                navigateTo(`/news/${id}`);
            });
        });
    } catch (err) {
        console.error('Error rendering all news:', err);
        if (allNewsGrid) allNewsGrid.innerHTML = '<p>Error loading news.</p>';
    }
}

export function renderNewsDetail(item) {
    currentNewsItem = item;
    const title = (item.title && typeof item.title === 'object') ? (item.title[currentLang] || item.title.en || '') : item.title || '';
    const summary = (item.summary && typeof item.summary === 'object') ? (item.summary[currentLang] || item.summary.en || '') : item.summary || '';
    const content = currentLang === 'fr' ? (item.content_fr || '') : (item.content_en || '');

    if (newsDetailTitle) newsDetailTitle.innerText = title;
    if (newsDetailDate) newsDetailDate.innerText = item.display_date || '';
    if (newsDetailImage) {
        if (item.image) {
            newsDetailImage.style.backgroundImage = `url('${item.image}')`;
            newsDetailImage.style.backgroundColor = 'transparent';
        } else {
            newsDetailImage.style.backgroundImage = 'none';
            newsDetailImage.style.backgroundColor = '#ccc';
        }
    }
    if (newsDetailSummary) newsDetailSummary.innerText = summary;
    const contentContainer = document.getElementById('newsDetailContent');
    if (contentContainer) {
        contentContainer.innerHTML = content;
    }
}

export function renderBookDetail(book) {
    currentModalBook = book;
    currentModalFormat = 'paperback';
    const cover = normalizeCover(book.cover);
    document.getElementById('detailCover').style.backgroundImage = cover ? `url('${cover}')` : '';
    document.getElementById('detailTitle').innerText = (currentLang === 'fr' && book.title_fr) ? book.title_fr : book.title;
    document.getElementById('detailAuthor').innerText = (currentLang === 'fr' && book.author_fr) ? book.author_fr : book.author;
    document.getElementById('detailPrice').innerText = `$${book.price}`;
    document.getElementById('detailAvailability').innerText = langPack[currentLang].availability;
    document.getElementById('detailIsbn').innerText = book.isbn || '978-1-7381938-6-8';
    document.getElementById('detailPublisher').innerText = book.publisher || 'Acer Books';
    document.getElementById('detailPubDate').innerText = book.pub_date || 'March 17th, 2024';
    document.getElementById('detailPages').innerText = book.pages || '170';
    updateDetailLanguage(book);
    renderDetailReviews(book.id, currentLang, currentUser);
    // Format selector
    const detailFmtSel = document.getElementById('detailFormatSelector');
    if (detailFmtSel) {
        if (book.price_hardcover) {
            detailFmtSel.style.display = '';
            detailFmtSel.querySelectorAll('.format-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.fmt === 'paperback');
                btn.onclick = () => {
                    currentModalFormat = btn.dataset.fmt;
                    detailFmtSel.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const price = currentModalFormat === 'hardcover' ? book.price_hardcover : book.price;
                    document.getElementById('detailPrice').innerText = `$${parseFloat(price).toFixed(2)}`;
                };
            });
        } else {
            detailFmtSel.style.display = 'none';
        }
    }
    document.getElementById('detailAddToCart').onclick = () => {
        addToCart(book, currentModalFormat);
        alert(langPack[currentLang].itemAddedToCart);
    };
    document.getElementById('detailAddToWishList').onclick = () => {
        alert(langPack[currentLang].addedToWishList);
    };
    setupDetailTabs();
}

function setupDetailTabs() {
    const tabs = document.querySelectorAll('.detail-tab');
    const panes = document.querySelectorAll('#bookDetailPage .tab-pane');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`detail-tab-${target}`)?.classList.add('active');
        });
    });
    if (tabs.length > 0) {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        const firstTab = tabs[0];
        firstTab.classList.add('active');
        const firstTarget = firstTab.dataset.tab;
        const firstPane = document.getElementById(`detail-tab-${firstTarget}`);
        if (firstPane) firstPane.classList.add('active');
    }
}

function updateBookLanguage(book, elements) {
    const { titleEl, authorEl, descriptionEl, authorBioEl, categoriesEl, languageEl } = elements;
    const authorBioFallback = currentLang === 'fr' ? 'Biographie de l\'auteur non disponible.' : 'Author biography not available.';
    if (titleEl) titleEl.innerText = (currentLang === 'fr' && book.title_fr) ? book.title_fr : book.title;
    if (authorEl) authorEl.innerText = (currentLang === 'fr' && book.author_fr) ? book.author_fr : book.author;
    if (currentLang === 'fr') {
        if (descriptionEl) descriptionEl.innerHTML = book.description_fr || book.description || langPack.fr.bookDescription;
        if (authorBioEl) authorBioEl.innerHTML = book.author_bio_fr || book.author_bio || authorBioFallback;
        if (categoriesEl) {
            if (book.categories_fr && book.categories_fr.length) {
                categoriesEl.innerHTML = book.categories_fr.map(cat => `<span class="category-tag">${cat}</span>`).join('');
            } else if (book.categories && book.categories.length) {
                categoriesEl.innerHTML = book.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('');
            } else {
                categoriesEl.innerHTML = '<span class="category-tag">Général</span>';
            }
        }
        if (languageEl) languageEl.innerText = book.language_fr || book.language || 'Chinois';
    } else {
        if (descriptionEl) descriptionEl.innerHTML = book.description || langPack.en.bookDescription;
        if (authorBioEl) authorBioEl.innerHTML = book.author_bio || authorBioFallback;
        if (categoriesEl) {
            if (book.categories && book.categories.length) {
                categoriesEl.innerHTML = book.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('');
            } else {
                categoriesEl.innerHTML = '<span class="category-tag">General</span>';
            }
        }
        if (languageEl) languageEl.innerText = book.language || 'Chinese';
    }
}

export function updateDetailLanguage(book) {
    const elements = {
        titleEl: document.getElementById('detailTitle'),
        authorEl: document.getElementById('detailAuthor'),
        descriptionEl: document.getElementById('detailDescription'),
        authorBioEl: document.getElementById('detailAuthorBio'),
        categoriesEl: document.getElementById('detailCategories'),
        languageEl: document.getElementById('detailLanguage')
    };
    updateBookLanguage(book, elements);
}

export function openModal(book) {
    currentModalBook = book;
    currentModalFormat = 'paperback';
    const cover = normalizeCover(book.cover);
    if (modalCover) modalCover.style.backgroundImage = cover ? `url('${cover}')` : '';
    if (modalTitle) modalTitle.innerText = (currentLang === 'fr' && book.title_fr) ? book.title_fr : book.title;
    if (modalAuthor) modalAuthor.innerText = (currentLang === 'fr' && book.author_fr) ? book.author_fr : book.author;
    if (modalPrice) modalPrice.innerText = `$${book.price}`;
    if (modalAvailability) modalAvailability.innerText = langPack[currentLang].availability;
    if (modalIsbn) modalIsbn.innerText = book.isbn || '978-1-7381938-6-8';
    if (modalPublisher) modalPublisher.innerText = book.publisher || 'Acer Books';
    if (modalPubDate) modalPubDate.innerText = book.pub_date || 'March 17th, 2024';
    if (modalPages) modalPages.innerText = book.pages || '170';
    updateModalLanguage();
    renderReviews(book.id, currentLang, currentUser);
    const modalTabs = document.querySelectorAll('#bookModal .modal-tab');
    const modalPanes = document.querySelectorAll('#bookModal .tab-pane');
    modalTabs.forEach(t => t.classList.remove('active'));
    modalPanes.forEach(p => p.classList.remove('active'));
    if (modalTabs.length > 0) {
        modalTabs[0].classList.add('active');
        const firstTabId = modalTabs[0].dataset.tab;
        const firstPane = document.getElementById(`tab-${firstTabId}`);
        if (firstPane) firstPane.classList.add('active');
    }
    if (modalAddToCart) modalAddToCart.dataset.bookId = book.id;
    if (modalAddToWishList) modalAddToWishList.dataset.bookId = book.id;
    // Format selector
    const modalFmtSel = document.getElementById('modalFormatSelector');
    if (modalFmtSel) {
        if (book.price_hardcover) {
            modalFmtSel.style.display = '';
            modalFmtSel.querySelectorAll('.format-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.fmt === 'paperback');
                btn.onclick = () => {
                    currentModalFormat = btn.dataset.fmt;
                    modalFmtSel.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const price = currentModalFormat === 'hardcover' ? book.price_hardcover : book.price;
                    if (modalPrice) modalPrice.innerText = `$${parseFloat(price).toFixed(2)}`;
                };
            });
        } else {
            modalFmtSel.style.display = 'none';
        }
    }
    if (modalOverlay) modalOverlay.classList.add('active');
}

export function updateModalLanguage() {
    if (!currentModalBook) return;
    const book = currentModalBook;
    const elements = {
        titleEl: modalTitle,
        authorEl: modalAuthor,
        descriptionEl: modalDescription,
        authorBioEl: modalAuthorBio,
        categoriesEl: modalCategories,
        languageEl: modalLanguage
    };
    updateBookLanguage(book, elements);
    if (modalPrice) modalPrice.innerText = `$${book.price}`;
    if (modalAvailability) modalAvailability.innerText = langPack[currentLang].availability;
    if (modalAddToCart) modalAddToCart.innerHTML = `<i class="fas fa-shopping-cart"></i> ${langPack[currentLang].addToCart}`;
    if (modalAddToWishList) modalAddToWishList.innerHTML = `<i class="fas fa-heart"></i> ${langPack[currentLang].addToWishList}`;
    const tabElements = document.querySelectorAll('.modal-tab');
    if (tabElements.length >= 4) {
        tabElements[0].innerText = langPack[currentLang].tabDescription;
        tabElements[1].innerText = langPack[currentLang].tabAuthor;
        tabElements[2].innerText = langPack[currentLang].tabDetails;
        tabElements[3].innerText = langPack[currentLang].tabReviews;
    }
}

export function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
}

export function updateMetaTags(book) {
    document.title = `${book.title} by ${book.author} | Acer Books`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = book.description || 'A book from Acer Books, Montreal independent publisher.';
}

export function resetMetaTags() {
    document.title = 'Acer Books · Montréal independent publisher';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = 'Montreal-based independent publisher — red maple series, translation, and visual arts.';
    }
}