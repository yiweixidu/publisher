// admin.js
import { books, newsItems, saveBooks, saveNews, loadBooks, loadNews } from './data.js';
import { langPack } from './i18n.js';
import { adminMode } from './auth.js';
import { currentLang } from './i18n.js';
import { renderBooks, renderAllBooks, renderNews, renderAllNews } from './ui.js';
import { navigateTo } from './routing.js';
import { supabase } from '/publisher/supabaseClient.js';

// DOM elements (same as before)
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
const formLanguage = document.getElementById('formLanguage');
const formPrice = document.getElementById('formPrice');
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

// Quill editors
let descriptionQuill, bioQuill;

// State
let adminSearchTerm = '';
let adminSortBy = 'title';

// Helper: upload file to Supabase Storage and return public URL
async function uploadFile(file, bucket, pathPrefix) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${fileExt}`;
    const filePath = `${pathPrefix}/${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
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
    // Ensure we have latest books
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
            <div>$${book.price}</div>
            <div>${book.stock_status || 'In Stock'}</div>
            <div class="actions">
                <button class="edit-book" data-id="${book.id}" data-i18n="editBook">Edit</button>
                <button class="duplicate-book" data-id="${book.id}" data-i18n="duplicate">Duplicate</button>
                <button class="delete-book" data-id="${book.id}" data-i18n="delete">Delete</button>
            </div>
        </div>
        `;
    }).join('');
    adminBooksList.innerHTML = html;

    // Attach event listeners
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
            const newBooks = books.filter(b => b.id !== id);
            await saveBooks(newBooks);
            await renderAdminBookList();
            if (document.getElementById('mainContent').style.display === 'block') renderBooks();
            if (document.getElementById('booksPage').style.display === 'block') renderAllBooks();
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

// ---------- Book Form Modal ----------
export function openBookFormModal(book = null) {
    bookForm.reset();
    coverPreview.style.backgroundImage = '';
    interiorPreviewsContainer.innerHTML = '';

    if (book) {
        bookIdField.value = book.id || '';
        formTitle.value = book.title || '';
        formAuthor.value = book.author || '';
        formCategories.value = book.categories ? book.categories.join(', ') : '';
        formIsbn.value = book.isbn || '';
        formPublisher.value = book.publisher || '';
        formPubDate.value = book.pub_date || '';
        formPages.value = book.pages || '';
        formLanguage.value = book.language || '';
        formPrice.value = book.price || '';
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
    descriptionQuill = new Quill('#descriptionEditor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
    });
    bioQuill = new Quill('#bioEditor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
    });

    bookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        document.getElementById('formDescription').value = descriptionQuill.root.innerHTML;
        document.getElementById('formAuthorBio').value = bioQuill.root.innerHTML;
        saveBookFromForm();
    });
}

async function saveBookFromForm() {
    console.log('saveBookFromForm called');
    const bookData = {
        id: bookIdField.value || undefined,
        title: formTitle.value.trim(),
        title_fr: formTitle.value.trim() || null,
        author: formAuthor.value.trim(),
        author_fr: formAuthor.value.trim() || null,
        categories: formCategories.value.split(',').map(s => s.trim()).filter(s => s),
        isbn: formIsbn.value.trim(),
        publisher: formPublisher.value.trim(),
        pub_date: formPubDate.value.trim(),
        pages: parseInt(formPages.value) || null,
        language: formLanguage.value.trim(),
        price: parseFloat(formPrice.value).toFixed(2),
        stock_status: formStockStatus.value,
        description: document.getElementById('formDescription').value,
        description_fr: document.getElementById('formDescription').value || null,
        author_bio: document.getElementById('formAuthorBio').value,
        author_bio_fr: document.getElementById('formAuthorBio').value || null,
        cover: '',
        interior_previews: []
    };

    if (formCover.files.length > 0) {
        const file = formCover.files[0];
        try {
            bookData.cover = await uploadFile(file, 'book-covers', 'covers');
        } catch (err) {
            console.error('Cover upload failed', err);
            alert('封面上传失败，请重试');
            return;
        }
    } else {
        const existing = books.find(b => b.id === bookData.id);
        if (existing && existing.cover) bookData.cover = existing.cover;
    }

    if (formInterior.files.length > 0) {
        const files = Array.from(formInterior.files);
        const urls = [];
        for (const file of files) {
            try {
                const url = await uploadFile(file, 'book-covers', 'interior');
                urls.push(url);
            } catch (err) {
                console.error('Interior upload failed', err);
                alert('内页图片上传失败，请重试');
                return;
            }
        }
        bookData.interior_previews = urls;
    } else {
        const existing = books.find(b => b.id === bookData.id);
        if (existing && existing.interior_previews) bookData.interior_previews = existing.interior_previews;
    }

    try {
        let updatedBooks;
        if (bookData.id) {
            updatedBooks = [bookData];
        } else {
            bookData.id = 'b' + Date.now() + Math.random().toString(36).substr(2, 6);
            updatedBooks = [bookData];
        }

        console.log('Saving book:', bookData);
        await saveBooks(updatedBooks);
        console.log('Book saved');

        bookFormModal.classList.remove('active');
        await renderAdminBookList();
        if (document.getElementById('mainContent').style.display === 'block') renderBooks();
        if (document.getElementById('booksPage').style.display === 'block') renderAllBooks();
        alert('书籍保存成功！');
    } catch (err) {
        console.error('Error saving book:', err);
        alert('保存失败，请检查控制台错误：' + (err.message || err));
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
            image: imageUrl
        };
        const updatedNews = [...newsItems, newItem];
        await saveNews(updatedNews);
        clearInputs();
        // refresh views
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
    const sorted = [...newsItems].sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
    let html = sorted.map(item => `
        <div class="admin-news-row" data-id="${item.id}">
            <div>${item.display_date || ''}</div>
            <div>${item.title?.en || ''} / ${item.title?.fr || ''}</div>
            <div>${(item.summary?.en || '').substring(0,50)}${(item.summary?.en || '').length > 50 ? '…' : ''}</div>
            <div class="actions">
                <button class="edit-news" data-id="${item.id}"><i class="fas fa-edit"></i> <span data-i18n="editNews">Edit News</span></button>
                <button class="delete-news" data-id="${item.id}"><i class="fas fa-trash-alt"></i> <span data-i18n="delete">Delete</span></button>
            </div>
        </div>
    `).join('');
    document.getElementById('adminNewsList').innerHTML = html;

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
            const newNews = newsItems.filter(n => n.id !== id);
            await saveNews(newNews);
            await renderAdminNewsList();
            if (document.getElementById('mainContent').style.display === 'block') renderNews();
            if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
        });
    });
}

export function openNewsFormModal(item = null) {
    document.getElementById('newsForm').reset();
    const preview = document.getElementById('newsImagePreview');
    preview.style.backgroundImage = '';
    preview.style.height = '0';

    if (item) {
        document.getElementById('newsId').value = item.id;
        document.getElementById('newsDateInput').value = item.display_date || '';
        document.getElementById('newsTitleEnInput').value = item.title?.en || '';
        document.getElementById('newsTitleFrInput').value = item.title?.fr || '';
        document.getElementById('newsSummaryEnInput').value = item.summary?.en || '';
        document.getElementById('newsSummaryFrInput').value = item.summary?.fr || '';
        if (item.image) {
            preview.style.backgroundImage = `url('${item.image}')`;
            preview.style.height = '150px';
        }
        document.getElementById('newsFormModalTitle').innerText = langPack[currentLang].editNews || 'Edit News';
    } else {
        document.getElementById('newsId').value = '';
        document.getElementById('newsFormModalTitle').innerText = langPack[currentLang].addNewsBtn || 'Add News';
    }
    document.getElementById('newsFormModal').classList.add('active');
}

async function saveNewsFromForm() {
    const id = document.getElementById('newsId').value;
    const displayDate = document.getElementById('newsDateInput').value.trim();
    const titleEn = document.getElementById('newsTitleEnInput').value.trim();
    const titleFr = document.getElementById('newsTitleFrInput').value.trim();
    const summaryEn = document.getElementById('newsSummaryEnInput').value.trim();
    const summaryFr = document.getElementById('newsSummaryFrInput').value.trim();
    const imageFile = document.getElementById('newsImageInput').files[0];

    if (!displayDate || !titleEn || !titleFr || !summaryEn || !summaryFr) {
        alert('Please fill all fields.');
        return;
    }

    let imageUrl = null;
    if (imageFile) {
        try {
            imageUrl = await uploadFile(imageFile, 'news-images', 'news');
        } catch (err) {
            console.error('Image upload failed', err);
        }
    } else {
        if (id) {
            const existing = newsItems.find(n => n.id === id);
            if (existing && existing.image) imageUrl = existing.image;
        }
    }

    const newsItem = {
        id: id || 'n' + Date.now() + Math.random().toString(36).substr(2,6),
        display_date: displayDate,
        timestamp: Date.now(),
        title: { en: titleEn, fr: titleFr },
        summary: { en: summaryEn, fr: summaryFr },
        image: imageUrl
    };

    let updatedNews;
    if (id) {
        updatedNews = newsItems.map(item => item.id === id ? newsItem : item);
    } else {
        updatedNews = [...newsItems, newsItem];
    }
    await saveNews(updatedNews);

    document.getElementById('newsFormModal').classList.remove('active');
    await renderAdminNewsList();
    if (document.getElementById('mainContent').style.display === 'block') renderNews();
    if (document.getElementById('newsListPage').style.display === 'block') renderAllNews();
}

export function attachAdminNewsEvents() {
    document.getElementById('addNewsAdminBtn')?.addEventListener('click', () => openNewsFormModal());

    document.getElementById('newsForm')?.addEventListener('submit', (e) => {
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