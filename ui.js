// ui.js – final version with error handling and logging
import { adminMode, currentUser } from './auth.js';
import { books, newsItems, loadBooks, loadNews, saveBooks, saveNews } from './data.js';
import { langPack, currentLang, setLanguage as i18nSetLanguage } from './i18n.js';
import { addToCart } from './cart.js';
import { renderReviews, renderDetailReviews } from './review.js';
import { navigateTo } from './routing.js';
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

function handleLanguageChange(event) {
    const lang = event.detail;
    translateUI(lang);
    renderNews();
    if (modalOverlay?.classList.contains('active')) updateModalLanguage();
    if (cartModal?.classList.contains('active')) renderCartModal();
    if (newsListPage && newsListPage.style.display === 'block') renderAllNews();
    if (newsDetailPage && newsDetailPage.style.display === 'block' && currentNewsItem) renderNewsDetail(currentNewsItem);
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        updateDetailLanguage(currentModalBook);
        renderDetailReviews(currentModalBook.id, lang, currentUser);
    }
    if (booksPage && booksPage.style.display === 'block') renderAllBooks();
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
    let coverStyle = book.cover ? `background-image: url('${book.cover}'); background-size: cover; background-position: center;` : `background: #2d2d2d;`;
    const deleteBtn = adminMode ? `<button class="delete-book" data-id="${book.id}"><i class="fas fa-trash-alt"></i></button>` : '';
    return `
        <div class="book-card" data-id="${book.id}">
            <div class="book-cover" style="${coverStyle} background-color: #2d2d2d;">
                ${displayTitle.length > 25 ? displayTitle.substr(0,22)+'…' : displayTitle}
            </div>
            <div class="book-meta">
                <div class="book-title">${displayTitle}</div>
                <div class="book-author">${displayAuthor}</div>
                ${adminMode ? `<div class="admin-controls">${deleteBtn}</div>` : ''}
            </div>
        </div>
    `;
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
        booksToShow.forEach(book => { html += generateBookCardHTML(book, adminMode, currentLang); });
        if (grid) grid.innerHTML = html;
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.admin-controls')) return;
                const bookId = card.dataset.id;
                const book = books.find(b => b.id === bookId);
                if (book) openModal(book);
            });
        });
        attachBookDeleteEvents(grid, renderBooks);
    } catch (err) {
        console.error('Error rendering books:', err);
        if (grid) grid.innerHTML = '<p>Error loading books. Please refresh or try again later.</p>';
    }
}

export async function renderAllBooks() {
    try {
        if (books.length === 0) await loadBooks();
        let html = '';
        books.forEach(book => { html += generateBookCardHTML(book, adminMode, currentLang); });
        if (booksGridAll) booksGridAll.innerHTML = html;
        document.querySelectorAll('#booksGrid .book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.admin-controls')) return;
                const bookId = card.dataset.id;
                navigateTo(`/book/${bookId}`);
            });
        });
        attachBookDeleteEvents(booksGridAll, renderAllBooks);
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
        const sorted = [...newsItems].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latest = sorted.slice(0, 3);
        let html = '';
        latest.forEach(item => { html += generateNewsItemHTML(item, adminMode, currentLang); });
        if (newsGrid) newsGrid.innerHTML = html;
        document.querySelectorAll('#newsGrid .news-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-news')) return;
                const id = card.dataset.id;
                navigateTo(`/news/${id}`);
            });
        });
        attachNewsDeleteEvents(newsGrid, renderNews);
    } catch (err) {
        console.error('Error rendering news:', err);
        if (newsGrid) newsGrid.innerHTML = '<p>Error loading news.</p>';
    }
}

export async function renderAllNews() {
    try {
        if (newsItems.length === 0) await loadNews();
        const sorted = [...newsItems].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        let html = '';
        sorted.forEach(item => { html += generateNewsItemHTML(item, adminMode, currentLang); });
        if (allNewsGrid) allNewsGrid.innerHTML = html;
        document.querySelectorAll('#allNewsGrid .news-item').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                navigateTo(`/news/${id}`);
            });
        });
        attachNewsDeleteEvents(allNewsGrid, renderAllNews);
    } catch (err) {
        console.error('Error rendering all news:', err);
        if (allNewsGrid) allNewsGrid.innerHTML = '<p>Error loading news.</p>';
    }
}

export function renderNewsDetail(item) {
    currentNewsItem = item;
    const title = (item.title && typeof item.title === 'object') ? (item.title[currentLang] || item.title.en || '') : item.title || '';
    const summary = (item.summary && typeof item.summary === 'object') ? (item.summary[currentLang] || item.summary.en || '') : item.summary || '';
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
}

export function renderBookDetail(book) {
    currentModalBook = book;
    document.getElementById('detailCover').style.backgroundImage = `url('${book.cover}')`;
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
    document.getElementById('detailAddToCart').onclick = () => {
        addToCart(book);
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
    if (modalCover) modalCover.style.backgroundImage = `url('${book.cover}')`;
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