// admin.js
import { books, newsItems, saveBooks, deleteBook, saveNews, deleteNews, loadBooks, loadNews } from './data.js';
import { langPack } from './i18n.js';
import { adminMode, currentAccessToken } from './auth.js';
import { currentLang } from './i18n.js';
import { renderBooks, renderAllBooks, renderNews, renderAllNews } from './ui.js';
import { navigateTo } from './routing.js';
import { supabase } from './supabaseClient.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants.js';

// DOM elements
const adminBooksPage = document.getElementById('adminBooksPage');
const adminBooksList = document.getElementById('adminBooksList');
const searchInput = document.getElementById('searchBooks');
const sortSelect = document.getElementById('sortBooks');
const addNewBookBtn = document.getElementById('addNewBookBtn');
const bookFormModal = document.getElementById('bookFormModal');
const bookForm = document.getElementById('bookForm');
const bookIdField = document.getElementById('bookId');
const formTitle = document.getElementById('formTitle');
const formAuthor = document.getElementById('formAuthor');
const formCategories = document.getElementById('formCategories');
const formIsbn = document.getElementById('formIsbn');
const formPublisher = document.getElementById('formPublisher');
const formPubDate = document.getElementById('formPubDate');
const formPages = document.getElementById('formPages');
// formLanguage removed, replaced by checkboxes
const formPrice = document.getElementById('formPrice');
const formPriceHardcover = document.getElementById('formPriceHardcover');
const formAcerSeries = document.getElementById('formAcerSeries');
const formStockStatus = document.getElementById('formStockStatus');
const formCover = document.getElementById('formCover');
const coverPreview = document.getElementById('coverPreview');
const formInterior = document.getElementById('formInterior');
const interiorPreviewsContainer = document.getElementById('interiorPreviewsContainer');
const formModalClose = document.getElementById('bookFormModalClose');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const newsImageUpload = document.getElementById('newsImageUpload');
const newsFileNameSpan = document.getElementById('news-file-name');
const addNewsBtn = document.getElementById('addNewsBtn');
const newsDate = document.getElementById('newsDate');
const newsTitleEn = document.getElementById('newsTitleEn');
const newsTitleFr = document.getElementById('newsTitleFr');
const newsSummaryEn = document.getElementById('newsSummaryEn');
const newsSummaryFr = document.getElementById('newsSummaryFr');

// Quill editors for books
let descriptionQuill, bioQuill;
// Quill editors for news content
let newsContentEditorEn, newsContentEditorFr;

// State
let adminSearchTerm = '';
let adminSortBy = 'title';

// ── Toast helper ────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const color = type === 'success' ? '#4caf50' : '#ff0000';
    const el = document.createElement('div');
    el.className = `acer-toast toast-${type}`;
    el.style.cssText = `
        position:fixed; bottom:2rem; right:2rem; z-index:99999;
        background:#1e1e1e; color:#fff; padding:0.85rem 1.5rem;
        border-radius:10px; font-size:0.9rem; font-weight:500;
        box-shadow:0 8px 24px rgba(0,0,0,0.3);
        display:flex; align-items:center; gap:0.6rem;
        transition:opacity 0.4s, transform 0.4s;
        opacity:1; transform:translateY(0);
    `;
    el.innerHTML = `<i class="fas ${icon}" style="color:${color};font-size:1rem;"></i><span>${msg}</span>`;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(1rem)';
        setTimeout(() => el.remove(), 450);
    }, 2800);
}

// Helper: upload file to Supabase Storage and return public URL
async function uploadFile(file, bucket, pathPrefix) {
    console.log(`uploadFile: bucket=${bucket}, pathPrefix=${pathPrefix}, file=${file.name}, size=${file.size}`);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${fileExt}`;
    const filePath = `${pathPrefix}/${fileName}`;
    
    if (!currentAccessToken) {
        throw new Error('Not authenticated');
    }
    console.log('Token obtained from auth.js, length:', currentAccessToken.length);
    
    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;
    console.log('Uploading to URL:', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Content-Type': file.type
        },
        body: file
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
    console.log('Upload success, publicUrl:', publicUrl);
    return publicUrl;
}

// ---------- Admin Books Page ----------
export function showAdminBooksPage() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('booksPage').style.display = 'none';
    document.getElementById('bookDetailPage').style.display = 'none';
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    if (newsListPage) newsListPage.style.display = 'none';
    if (newsDetailPage) newsDetailPage.style.display = 'none';
    adminBooksPage.style.display = 'block';
    renderAdminBookList();
}

export function hideAdminBooksPage() {
    adminBooksPage.style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

export async function renderAdminBookList() {
    await loadBooks();

    let filtered = books.filter(book =>
        book.title.toLowerCase().includes(adminSearchTerm) ||
        (book.author && book.author.toLowerCase().includes(adminSearchTerm))
    );

    filtered.sort((a, b) => {
        let aVal = a[adminSortBy] || '';
        let bVal = b[adminSortBy] || '';
        if (adminSortBy === 'price') {
            return parseFloat(a.price) - parseFloat(b.price);
        }
        return aVal.toString().localeCompare(bVal.toString());
    });

    const html = filtered.map(book => {
        const title = currentLang === 'fr' && book.title_fr ? book.title_fr : book.title;
        const author = currentLang === 'fr' && book.author_fr ? book.author_fr : book.author;
        return `
        <div class="admin-book-row" data-id="${book.id}">
            <div>${title}</div>
            <div>${author}</div>
            <div>$${parseFloat(book.price).toFixed(2)}${book.price_hardcover ? `<span class="admin-hc-tag"> / HC $${parseFloat(book.price_hardcover).toFixed(2)}</span>` : ''}</div>
            <div>${book.stock_status || 'In Stock'}</div>
            <div class="actions">
                <button class="edit-book" data-id="${book.id}"><i class="fas fa-pen"></i> Edit</button>
                <button class="duplicate-book" data-id="${book.id}"><i class="fas fa-copy"></i> Duplicate</button>
                <button class="delete-book" data-id="${book.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
        `;
    }).join('');
    adminBooksList.innerHTML = html;

    document.querySelectorAll('.edit-book').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const book = books.find(b => b.id === id);
            if (book) openBookFormModal(book);
        });
    });
    document.querySelectorAll('.duplicate-book').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const book = books.find(b => b.id === id);
            if (book) {
                const copy = { ...book, id: undefined };
                openBookFormModal(copy);
            }
        });
    });
    document.querySelectorAll('.delete-book').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(langPack[currentLang].deleteConfirm || 'Are you sure?')) return;
            const id = btn.dataset.id;
            try {
                await deleteBook(id);
                await renderAdminBookList();
                if (document.getElementById('mainContent').style.display === 'block') renderBooks();
                if (document.getElementById('booksPage').style.display === 'block') renderAllBooks();
                showToast('Deleted successfully');
            } catch (err) {
                console.error('Delete error:', err);
                showToast('Delete failed: ' + err.message, 'error');
            }
        });
    });
}

export function setAdminSearchTerm(term) {
    adminSearchTerm = term.toLowerCase();
    renderAdminBookList();
}

export function setAdminSortBy(sortBy) {
    adminSortBy = sortBy;
    renderAdminBookList();
}

// Helper: get language checkboxes
function getLangCheckboxes() {
    return document.querySelectorAll('input[name="langChoice"]');
}

// ---------- Book Form Modal ----------
export function openBookFormModal(book = null) {
    // Remove any leftover success message from previous save
    const oldMsg = document.getElementById('bookSaveSuccessMsg');
    if (oldMsg) oldMsg.remove();

    bookForm.reset();
    coverPreview.style.backgroundImage = '';
    interiorPreviewsContainer.innerHTML = '';

    // Reset language checkboxes
    const langCheckboxes = getLangCheckboxes();
    langCheckboxes.forEach(cb => cb.checked = false);

    if (book) {
        bookIdField.value = book.id || '';
        formTitle.value = book.title || '';
        formAuthor.value = book.author || '';
        formCategories.value = book.categories ? book.categories.join(', ') : '';
        formIsbn.value = book.isbn || '';
        formPublisher.value = book.publisher || '';
        formPubDate.value = book.pub_date || '';
        formPages.value = book.pages || '';
        // Set language checkboxes based on book.language (comma-separated)
        if (book.language) {
            const selectedLangs = book.language.split(',').map(s => s.trim());
            langCheckboxes.forEach(cb => {
                if (selectedLangs.includes(cb.value)) cb.checked = true;
            });
        }
        formPrice.value = book.price || '';
        formPriceHardcover.value = book.price_hardcover || '';
        if (formAcerSeries) {
            let series = (book.categories || []).find(c => c.startsWith('Acer ') || c === "Children's Art");
            // 映射旧分类到新下拉选项
            if (series === 'Acer Literature') series = 'Acer Series';
            if (series === 'Acer Poems') series = 'Acer Poetry';
            if (series === 'Acer Children') series = "Children's Art";
            formAcerSeries.value = series || '';
        }
        formStockStatus.value = book.stock_status || 'In Stock';
        if (descriptionQuill) descriptionQuill.root.innerHTML = book.description || '';
        if (bioQuill) bioQuill.root.innerHTML = book.author_bio || '';
        if (book.cover) {
            coverPreview.style.backgroundImage = `url('${book.cover}')`;
            coverPreview.style.height = '150px';
        }
        if (book.interior_previews && Array.isArray(book.interior_previews)) {
            book.interior_previews.forEach(url => {
                const thumb = document.createElement('div');
                thumb.className = 'thumb';
                thumb.style.backgroundImage = `url('${url}')`;
                interiorPreviewsContainer.appendChild(thumb);
            });
        }
        document.getElementById('formModalTitle').innerText = langPack[currentLang].editBook || 'Edit Book';
    } else {
        bookIdField.value = '';
        document.getElementById('formModalTitle').innerText = langPack[currentLang].addNewBook || 'Add New Book';
    }

    bookFormModal.classList.add('active');
}

export function initQuillEditors() {
    if (!document.querySelector('#descriptionEditor')) return;

    try {
        descriptionQuill = new Quill('#descriptionEditor', {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
        });
        bioQuill = new Quill('#bioEditor', {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
        });
    } catch (e) {
        console.warn('Quill failed to initialise — rich-text editing disabled:', e);
    }

    bookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (descriptionQuill) document.getElementById('formDescription').value = descriptionQuill.root.innerHTML;
        if (bioQuill)         document.getElementById('formAuthorBio').value  = bioQuill.root.innerHTML;
        saveBookFromForm();
    });
}

let isSavingBook = false;

async function saveBookFromForm() {
    if (isSavingBook) return;
    isSavingBook = true;
    const saveBtn = document.getElementById('saveBookBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.6'; }

    console.log('saveBookFromForm called');

    // Collect language from checkboxes
    const langCheckboxes = getLangCheckboxes();
    const selectedLanguages = Array.from(langCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join(', ');

    const bookData = {
        id: bookIdField.value || undefined,
        title: formTitle.value.trim(),
        title_fr: formTitle.value.trim() || null,
        author: formAuthor.value.trim(),
        author_fr: formAuthor.value.trim() || null,
        categories: (() => {
            let base = formCategories.value.split(',').map(s=>s.trim()).filter(Boolean);
            const selectedSeries = formAcerSeries?.value;
            if (selectedSeries) {
                const seriesKeywords = [
                    'Acer Literature', 'Acer Series', 'Acer Novels', 
                    'Acer Essays', 'Acer Poetry', 'Acer Poems', 
                    'Acer Children', "Children's Art"
                ];
                base = base.filter(cat => !seriesKeywords.includes(cat));
                base.unshift(selectedSeries);
            }
            return base;
        })(),
        isbn: formIsbn.value.trim(),
        publisher: formPublisher.value.trim(),
        pub_date: formPubDate.value.trim(),
        pages: parseInt(formPages.value) || null,
        language: selectedLanguages,
        price: parseFloat(formPrice.value).toFixed(2),
        price_hardcover: formPriceHardcover.value.trim() !== '' ? parseFloat(formPriceHardcover.value) : null,
        stock_status: formStockStatus.value,
        description: document.getElementById('formDescription').value,
        description_fr: document.getElementById('formDescription').value || null,
        author_bio: document.getElementById('formAuthorBio').value,
        author_bio_fr: document.getElementById('formAuthorBio').value || null,
        cover: '',
        interior_previews: []
    };

    // 1. Handle cover upload
    if (formCover.files.length > 0) {
        try {
            bookData.cover = await uploadFile(formCover.files[0], 'book-covers', 'covers');
        } catch (err) {
            console.error('Cover upload failed', err);
            showToast('Cover image upload failed, please try again', 'error');
            isSavingBook = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
            return;
        }
    } else {
        const existing = books.find(b => b.id === bookData.id);
        if (existing && existing.cover) bookData.cover = existing.cover;
    }

    // 2. Handle interior previews
    if (formInterior.files.length > 0) {
        const urls = [];
        for (const file of formInterior.files) {
            try {
                const url = await uploadFile(file, 'book-covers', 'interior');
                urls.push(url);
            } catch (err) {
                console.error('Interior upload failed', err);
                showToast('Interior image upload failed, please try again', 'error');
                isSavingBook = false;
                if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
                return;
            }
        }
        bookData.interior_previews = urls;
    } else {
        const existing = books.find(b => b.id === bookData.id);
        if (existing && existing.interior_previews) bookData.interior_previews = existing.interior_previews;
    }

    // 3. Generate ID for new book
    if (!bookData.id) {
        bookData.id = 'b' + Date.now() + Math.random().toString(36).substr(2, 6);
    }

    // 4. Save to Supabase
    if (!currentAccessToken) {
        showToast('Not authenticated. Please log in again.', 'error');
        isSavingBook = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
        return;
    }
    const { created_at, interior_previews, description_fr, author_bio_fr, ...cleanBook } = bookData;
    let saveOk = false;
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${currentAccessToken}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify([cleanBook])
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Supabase ${resp.status}: ${errText}`);
        }
        saveOk = true;
        console.log('Book saved successfully');
    } catch (err) {
        console.error('Save error:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
        isSavingBook = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
        return;
    }

    // 5. Success: show message above Save button
    if (saveOk) {
        const oldMsg = document.getElementById('bookSaveSuccessMsg');
        if (oldMsg) oldMsg.remove();

        const formActions = bookFormModal.querySelector('.form-actions');
        if (formActions) {
            const msgDiv = document.createElement('div');
            msgDiv.id = 'bookSaveSuccessMsg';
            msgDiv.style.cssText = `
                margin: 0 0 1rem 0;
                padding: 0.65rem 1rem;
                background: #e8f5e9;
                border: 1px solid #4caf50;
                border-radius: 6px;
                font-size: 0.85rem;
                color: #2e7d32;
                text-align: center;
                font-weight: 500;
            `;
            msgDiv.innerHTML = '<i class="fas fa-check-circle" style="margin-right:0.5rem;"></i> Book saved! The book list has been updated automatically.';
            formActions.parentNode.insertBefore(msgDiv, formActions);
        } else {
            showToast('Book saved! List updated automatically', 'success');
        }

        isSavingBook = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
    }

    // 6. Refresh lists in background
    try {
        await renderAdminBookList();
        if (document.getElementById('mainContent').style.display === 'block') await renderBooks();
        if (document.getElementById('booksPage').style.display === 'block') await renderAllBooks();
    } catch(e) {
        console.warn('Background refresh failed (non-critical):', e.message);
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---------- Add News (Admin) ----------
export function attachNewsEvents() {
    newsImageUpload?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (newsFileNameSpan) newsFileNameSpan.textContent = file ? file.name : 'No file chosen';
    });

    addNewsBtn?.addEventListener('click', async function() {
        console.log('addNewsBtn clicked');
        const displayDate = newsDate?.value.trim() || 'No date';
        const titleEn = newsTitleEn?.value.trim() || 'Untitled';
        const titleFr = newsTitleFr?.value.trim() || titleEn;
        const summaryEn = newsSummaryEn?.value.trim() || '';
        const summaryFr = newsSummaryFr?.value.trim() || summaryEn;
        const file = newsImageUpload?.files[0];

        const clearInputs = () => {
            if (newsDate) newsDate.value = '';
            if (newsTitleEn) newsTitleEn.value = '';
            if (newsTitleFr) newsTitleFr.value = '';
            if (newsSummaryEn) newsSummaryEn.value = '';
            if (newsSummaryFr) newsSummaryFr.value = '';
            if (newsImageUpload) newsImageUpload.value = '';
            if (newsFileNameSpan) newsFileNameSpan.textContent = 'No file chosen';
        };

        let imageUrl = null;
        if (file) {
            try {
                imageUrl = await uploadFile(file, 'news-images', 'news');
            } catch (err) {
                console.error('News image upload failed', err);
            }
        }

        const newId = 'n' + Date.now() + Math.random().toString(36).substring(2,6);
        const newItem = {
            id: newId,
            display_date: displayDate,
            timestamp: Date.now(),
            title: { en: titleEn, fr: titleFr },
            summary: { en: summaryEn, fr: summaryFr },
            image: imageUrl,
            status: 'draft'
        };
        const updatedNews = [...newsItems, newItem];
        await saveNews(updatedNews);
        clearInputs();
        if (document.getElementById('mainContent').style.display === 'block') renderNews();
        if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
    });
}

// ---------- Admin News Management ----------
export function showAdminNewsPage() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('booksPage').style.display = 'none';
    document.getElementById('bookDetailPage').style.display = 'none';
    document.getElementById('newsListPage').style.display = 'none';
    document.getElementById('newsDetailPage').style.display = 'none';
    document.getElementById('adminBooksPage').style.display = 'none';
    document.getElementById('adminNewsPage').style.display = 'block';
    renderAdminNewsList();
}

export function hideAdminNewsPage() {
    document.getElementById('adminNewsPage').style.display = 'none';
}

export async function renderAdminNewsList() {
    await loadNews();
    const sorted = [...newsItems].sort((a, b) => {
        const dateA = a.event_date ? new Date(a.event_date) : 0;
        const dateB = b.event_date ? new Date(b.event_date) : 0;
        return dateB - dateA;
    });

    // Show subscriber count banner
    let subCount = 0;
    try {
        const { getSubscriberCount } = await import('./newsletter.js');
        subCount = await getSubscriberCount();
    } catch (_) {}
    const subBanner = `
        <div class="anr-sub-banner">
            <i class="fas fa-users"></i>
            <strong>${subCount}</strong> active subscriber${subCount !== 1 ? 's' : ''}
            <span class="anr-sub-hint">— use <i class="fas fa-paper-plane"></i> Send to deliver a news item to all subscribers by email</span>
        </div>`;

    let html = sorted.map(item => `
        <div class="admin-news-row" data-id="${item.id}">
            <div class="anr-date">${item.display_date || ''}</div>
            <div class="anr-title">${item.title?.en || ''} / ${item.title?.fr || ''}</div>
            <div class="anr-summary">${(item.summary?.en || '').substring(0,50)}${(item.summary?.en || '').length > 50 ? '…' : ''}</div>
            <div class="anr-right">
                <span class="status-badge ${item.status === 'published' ? 'published' : 'draft'}">${item.status}</span>
                <div class="anr-actions">
                    <button class="toggle-status anr-btn" data-id="${item.id}" data-status="${item.status}">
                        ${item.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button class="edit-news anr-btn" data-id="${item.id}"><i class="fas fa-edit"></i> Edit</button>
                    ${item.status === 'published'
                        ? `<button class="send-newsletter anr-btn anr-btn--send" data-id="${item.id}" title="Send to all subscribers">
                               <i class="fas fa-paper-plane"></i> Send
                           </button>`
                        : ''}
                    <button class="delete-news anr-btn anr-btn--danger" data-id="${item.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('adminNewsList').innerHTML = subBanner + html;

    document.querySelectorAll('.toggle-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            const currentStatus = btn.dataset.status;
            const newStatus = currentStatus === 'published' ? 'draft' : 'published';
            const item = newsItems.find(n => n.id === id);
            if (item) {
                item.status = newStatus;
                await saveNews(newsItems);
                await renderAdminNewsList();
                if (document.getElementById('mainContent').style.display === 'block') renderNews();
                if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
            }
        });
    });

    document.querySelectorAll('.edit-news').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const item = newsItems.find(n => n.id === id);
            if (item) openNewsFormModal(item);
        });
    });
    document.querySelectorAll('.delete-news').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(langPack[currentLang].deleteConfirm || 'Are you sure?')) return;
            const id = btn.dataset.id;
            try {
                await deleteNews(id);
                await renderAdminNewsList();
                if (document.getElementById('mainContent').style.display === 'block') renderNews();
                if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
                showToast('Deleted successfully');
            } catch (err) {
                console.error('Delete error:', err);
                showToast('Delete failed: ' + err.message, 'error');
            }
        });
    });

    // ── Send Newsletter ──────────────────────────────────────────────────────
    document.querySelectorAll('.send-newsletter').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id    = btn.dataset.id;
            const item  = newsItems.find(n => n.id === id);
            if (!item) return;

            let subCount = 0;
            try {
                const { getSubscriberCount } = await import('./newsletter.js');
                subCount = await getSubscriberCount();
            } catch (_) {}

            if (!confirm(
                `Send "${item.title?.en || 'this news'}" to ${subCount} subscriber${subCount !== 1 ? 's' : ''}?\n\n` +
                `This will dispatch a newsletter email immediately.`
            )) return;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const { currentAccessToken } = await import('./auth.js');
                const { sendNewsletterEmail }  = await import('./newsletter.js');
                const sent = await sendNewsletterEmail(id, currentAccessToken);
                showToast(`Newsletter sent to ${sent} subscriber${sent !== 1 ? 's' : ''}! 📨`);
            } catch (err) {
                console.error('Send newsletter error:', err);
                showToast('Send failed: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
            }
        });
    });
}

export function openNewsFormModal(item = null) {
    const newsForm = document.getElementById('newsForm');
    const preview = document.getElementById('newsImagePreview');
    const newsId = document.getElementById('newsId');
    const newsDateInput = document.getElementById('newsDateInput');
    const newsTitleEnInput = document.getElementById('newsTitleEnInput');
    const newsTitleFrInput = document.getElementById('newsTitleFrInput');
    const newsSummaryEnInput = document.getElementById('newsSummaryEnInput');
    const newsSummaryFrInput = document.getElementById('newsSummaryFrInput');
    const newsStatus = document.getElementById('newsStatus');
    const modalTitle = document.getElementById('newsFormModalTitle');
    const modal = document.getElementById('newsFormModal');

    if (!newsForm || !preview || !newsId || !newsDateInput || !newsTitleEnInput || !newsTitleFrInput ||
        !newsSummaryEnInput || !newsSummaryFrInput || !newsStatus || !modalTitle || !modal) {
        console.error('One or more news form elements not found in DOM');
        return;
    }

    newsForm.reset();
    preview.style.backgroundImage = '';
    preview.style.height = '0';

    if (!newsContentEditorEn && document.getElementById('newsContentEditorEn')) {
        newsContentEditorEn = new Quill('#newsContentEditorEn', {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
        });
        newsContentEditorFr = new Quill('#newsContentEditorFr', {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
        });
    }

    if (item) {
        newsId.value = item.id || '';
        newsDateInput.value = item.display_date || '';
        newsTitleEnInput.value = item.title?.en || '';
        newsTitleFrInput.value = item.title?.fr || '';
        newsSummaryEnInput.value = item.summary?.en || '';
        newsSummaryFrInput.value = item.summary?.fr || '';
        newsStatus.value = item.status || 'draft';

        if (item.content_en && newsContentEditorEn) newsContentEditorEn.root.innerHTML = item.content_en;
        if (item.content_fr && newsContentEditorFr) newsContentEditorFr.root.innerHTML = item.content_fr;

        if (item.image) {
            preview.style.backgroundImage = `url('${item.image}')`;
            preview.style.height = '150px';
        }
        modalTitle.innerText = langPack[currentLang].editNews || 'Edit News';
    } else {
        if (newsContentEditorEn) newsContentEditorEn.root.innerHTML = '';
        if (newsContentEditorFr) newsContentEditorFr.root.innerHTML = '';
        newsStatus.value = 'draft';
        modalTitle.innerText = langPack[currentLang].addNewsBtn || 'Add News';
    }

    modal.classList.add('active');
}

function parseDisplayDateToEventDate(dateStr) {
    let date = new Date(dateStr);
    if (!isNaN(date)) {
        return date.toISOString().slice(0, 10);
    }
    return '';
}

async function saveNewsFromForm() {
    console.log('saveNewsFromForm called');
    const id = document.getElementById('newsId').value;
    const displayDate = document.getElementById('newsDateInput').value.trim();
    const titleEn = document.getElementById('newsTitleEnInput').value.trim();
    const titleFr = document.getElementById('newsTitleFrInput').value.trim();
    const summaryEn = document.getElementById('newsSummaryEnInput').value.trim();
    const summaryFr = document.getElementById('newsSummaryFrInput').value.trim();
    const status = document.getElementById('newsStatus').value;
    const contentEn = newsContentEditorEn?.root.innerHTML || '';
    const contentFr = newsContentEditorFr?.root.innerHTML || '';
    const imageFile = document.getElementById('newsImageInput').files[0];

    console.log('Form values:', { displayDate, titleEn, titleFr, summaryEn, summaryFr, status, hasImage: !!imageFile });

    if (!displayDate || !titleEn || !titleFr || !summaryEn || !summaryFr) {
        console.log('Validation failed: missing fields');
        alert('Please fill all fields.');
        return;
    }
    console.log('Validation passed');

    let imageUrl = null;
    if (imageFile) {
        console.log('Uploading image...');
        try {
            imageUrl = await uploadFile(imageFile, 'news-images', 'news');
            console.log('Image uploaded, URL:', imageUrl);
        } catch (err) {
            console.error('Image upload failed', err);
            showToast('Image upload failed: ' + err.message, 'error');
            return;
        }
    } else if (id) {
        const existing = newsItems.find(n => n.id === id);
        if (existing && existing.image) imageUrl = existing.image;
        console.log('Using existing image:', imageUrl);
    }

    const eventDate = parseDisplayDateToEventDate(displayDate);
    console.log('Parsed event_date:', eventDate);

    let timestamp;
    if (id) {
        const existing = newsItems.find(n => n.id === id);
        timestamp = existing ? existing.timestamp : Date.now();
        console.log('Editing, keeping timestamp:', timestamp);
    } else {
        timestamp = Date.now();
        console.log('New item, timestamp:', timestamp);
    }

    const newsItem = {
        id: id || 'n' + Date.now() + Math.random().toString(36).substr(2, 6),
        display_date: displayDate,
        timestamp: timestamp,
        event_date: eventDate,
        title: { en: titleEn, fr: titleFr },
        summary: { en: summaryEn, fr: summaryFr },
        content_en: contentEn,
        content_fr: contentFr, 
        image: imageUrl,
        status: status
    };
    console.log('Constructed newsItem:', newsItem);

    let updatedNews;
    if (id) {
        updatedNews = newsItems.map(item => item.id === id ? newsItem : item);
    } else {
        updatedNews = [...newsItems, newsItem];
    }
    console.log('About to call saveNews with', updatedNews.length, 'items');

    try {
        await saveNews(updatedNews);
        console.log('saveNews completed successfully');
        document.getElementById('newsFormModal').classList.remove('active');
        await renderAdminNewsList();
        if (document.getElementById('mainContent').style.display === 'block') renderNews();
        if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
        showToast('News saved successfully!');
    } catch (err) {
        console.error('Error saving news:', err);
        showToast('Save failed: ' + err.message, 'error');
    }
}

export function attachAdminNewsEvents() {
    console.log('attachAdminNewsEvents called');
    document.getElementById('addNewsAdminBtn')?.addEventListener('click', () => {
        console.log('addNewsAdminBtn clicked');
        openNewsFormModal();
    });

    document.getElementById('newsForm')?.addEventListener('submit', (e) => {
        console.log('newsForm submit event triggered');
        e.preventDefault();
        saveNewsFromForm();
    });

    document.getElementById('cancelNewsFormBtn')?.addEventListener('click', () => {
        document.getElementById('newsFormModal').classList.remove('active');
    });

    document.getElementById('newsFormModalClose')?.addEventListener('click', () => {
        document.getElementById('newsFormModal').classList.remove('active');
    });

    document.getElementById('backToHomeFromAdminNews')?.addEventListener('click', () => {
        hideAdminNewsPage();
        navigateTo('/');
    });

    document.getElementById('newsImageInput')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                const preview = document.getElementById('newsImagePreview');
                preview.style.backgroundImage = `url('${ev.target.result}')`;
                preview.style.height = '150px';
            };
            reader.readAsDataURL(file);
        }
    });
}
