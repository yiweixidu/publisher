// app.js
(function() {
    const ADMIN_PASSWORD = "acer2025";

    // Load data from DataService
    let books = DataService.loadBooks();
    let newsItems = DataService.loadNews();
    let users = DataService.loadUsers();
    let reviews = DataService.loadReviews();

    let currentLang = 'en';
    let adminMode = false;
    let currentUser = null;

    // DOM elements
    const grid = document.getElementById('bookGrid');
    const newsGrid = document.getElementById('newsGrid');
    const toolbox = document.getElementById('toolbox');
    const adminSwitch = document.getElementById('adminSwitch');
    const addBtn = document.getElementById('addBookBtn');
    const newTitle = document.getElementById('newTitle');
    const newAuthor = document.getElementById('newAuthor');
    const newPrice = document.getElementById('newPrice');
    const newLang = document.getElementById('newLang');
    const coverUpload = document.getElementById('coverUpload');
    const fileNameSpan = document.getElementById('file-name');
    const newsDate = document.getElementById('newsDate');
    const newsTitle = document.getElementById('newsTitle');
    const newsSummary = document.getElementById('newsSummary');
    const newsImageUpload = document.getElementById('newsImageUpload');
    const newsFileNameSpan = document.getElementById('news-file-name');
    const addNewsBtn = document.getElementById('addNewsBtn');
    const langEn = document.getElementById('langEn');
    const langFr = document.getElementById('langFr');
    const cartIcon = document.getElementById('cartIcon');

    // Modal elements
    const modalOverlay = document.getElementById('bookModal');
    const modalClose = document.getElementById('modalClose');
    const modalCover = document.getElementById('modalCover');
    const modalTitle = document.getElementById('modalTitle');
    const modalAuthor = document.getElementById('modalAuthor');
    const modalPrice = document.getElementById('modalPrice');
    const modalAvailability = document.getElementById('modalAvailability');
    const modalAddToCart = document.getElementById('modalAddToCart');
    const modalAddToWishList = document.getElementById('modalAddToWishList');
    const modalDescription = document.getElementById('modalDescription');
    const modalAuthorBio = document.getElementById('modalAuthorBio');
    const modalCategories = document.getElementById('modalCategories');
    const modalIsbn = document.getElementById('modalIsbn');
    const modalPublisher = document.getElementById('modalPublisher');
    const modalPubDate = document.getElementById('modalPubDate');
    const modalPages = document.getElementById('modalPages');
    const modalLanguage = document.getElementById('modalLanguage');
    const modalReviews = document.getElementById('modalReviews');
    const tabs = document.querySelectorAll('.modal-tab');
    const panes = document.querySelectorAll('.tab-pane');

    // Login elements
    const loginOverlay = document.getElementById('loginOverlay');
    const loginClose = document.getElementById('loginClose');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const userSection = document.getElementById('userSection');

    // ---------- Helper: translate UI ----------
    function translateUI(lang) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langPack[lang] && langPack[lang][key] !== undefined) {
                el.innerHTML = langPack[lang][key];
            }
        });
        if (lang === 'en') {
            langEn.classList.add('active');
            langFr.classList.remove('active');
        } else {
            langFr.classList.add('active');
            langEn.classList.remove('active');
        }
    }

    // ---------- Login / logout ----------
    function updateUserUI() {
        if (currentUser) {
            userSection.innerHTML = `
                <span class="user-name">${currentUser.displayName || currentUser.username}</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', logout);
        } else {
            userSection.innerHTML = `<button class="btn-outline-red" id="showLoginBtn">Login</button>`;
            document.getElementById('showLoginBtn').addEventListener('click', () => {
                loginOverlay.classList.add('active');
            });
        }
    }

    function login(username, password) {
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = user;
            loginOverlay.classList.remove('active');
            updateUserUI();
            if (modalOverlay.classList.contains('active')) {
                const currentBookId = modalAddToCart.dataset.bookId;
                if (currentBookId) renderReviews(currentBookId);
            }
        } else {
            loginError.textContent = 'Invalid username or password';
        }
    }

    function logout() {
        currentUser = null;
        updateUserUI();
        if (modalOverlay.classList.contains('active')) {
            const currentBookId = modalAddToCart.dataset.bookId;
            if (currentBookId) renderReviews(currentBookId);
        }
    }

    loginBtn.addEventListener('click', () => {
        login(loginUsername.value, loginPassword.value);
    });
    loginClose.addEventListener('click', () => {
        loginOverlay.classList.remove('active');
        loginError.textContent = '';
    });
    loginOverlay.addEventListener('click', (e) => {
        if (e.target === loginOverlay) {
            loginOverlay.classList.remove('active');
            loginError.textContent = '';
        }
    });

    // ---------- Render reviews ----------
    function renderReviews(bookId) {
        const bookReviews = reviews.filter(r => r.bookId === bookId);
        let html = '<div class="wechat-review-list">';

        if (currentUser) {
            html += `
                <div class="review-form wechat-review-form">
                    <textarea id="newReviewText" class="review-textarea" placeholder="写评论..."></textarea>
                    <button id="submitReview" class="review-submit wechat-submit">发表评论</button>
                </div>
            `;
        }

        bookReviews.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(r => {
            const date = new Date(r.timestamp).toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
            html += `
                <div class="wechat-review-item" data-review-id="${r.id}">
                    <div class="wechat-review-header">
                        <span class="wechat-review-user">${r.username}</span>
                        <span class="wechat-review-date">${date}</span>
                    </div>
                    <div class="wechat-review-content">${r.text}</div>
                    <div class="wechat-review-footer">
                        <button class="wechat-share-btn" data-review-id="${r.id}">分享到微信</button>
                    </div>
                    <div class="wechat-comment-section" id="comments-${r.id}">
                        ${r.comments.map(c => {
                            const commentDate = new Date(c.timestamp).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
                            return `
                                <div class="wechat-comment-item">
                                    <span class="wechat-comment-user">${c.username}</span>
                                    <span class="wechat-comment-text">${c.text}</span>
                                    <span class="wechat-comment-date">${commentDate}</span>
                                </div>
                            `;
                        }).join('')}
                        ${currentUser ? `
                            <div class="wechat-comment-form">
                                <input type="text" class="wechat-comment-input" placeholder="写下你的评论..." data-review-id="${r.id}">
                                <button class="wechat-comment-submit" data-review-id="${r.id}">发送</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        modalReviews.innerHTML = html;

        // Share button handler – uses Web Share API if available, else copies a message
        document.querySelectorAll('.wechat-share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const reviewId = btn.dataset.reviewId;
                const review = reviews.find(r => r.id === reviewId);
                if (!review) return;

                // Build the share data
                const shareTitle = `书评 by ${review.username}`;
                const shareText = review.text.substring(0, 100) + (review.text.length > 100 ? '…' : '');
                const shareUrl = window.location.href.split('#')[0] + '#review-' + reviewId; // clean URL with hash

                // If Web Share API is available (including WeChat's browser), use it
                if (navigator.share) {
                    navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: shareUrl,
                    }).catch(() => {
                        // User cancelled share – fallback to copying
                        fallbackCopy(review, shareUrl);
                    });
                } else {
                    // Fallback: copy a formatted message to clipboard
                    fallbackCopy(review, shareUrl);
                }
            });
        });

        // Helper function for fallback copy
        function fallbackCopy(review, shareUrl) {
            const message = `【书评】${review.username} 评论了这本书：\n“${review.text}”\n查看完整评论：${shareUrl}`;
            navigator.clipboard.writeText(message).then(() => {
                alert('评论已复制，你可以粘贴发送给微信好友');
            }).catch(() => {
                alert('复制失败，请手动复制链接：' + shareUrl);
            });
        }

        // Comment submission (same as before)
        document.querySelectorAll('.wechat-comment-submit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentUser) return;
                const reviewId = btn.dataset.reviewId;
                const input = document.querySelector(`.wechat-comment-input[data-review-id="${reviewId}"]`);
                const text = input.value.trim();
                if (!text) return;
                const review = reviews.find(r => r.id === reviewId);
                if (review) {
                    review.comments.push({
                        userId: currentUser.id,
                        username: currentUser.displayName || currentUser.username,
                        text: text,
                        timestamp: new Date().toISOString()
                    });
                    DataService.saveReviews(reviews);
                    renderReviews(bookId);
                }
            });
        });

        // New review submission (same)
        if (currentUser) {
            const submitReview = document.getElementById('submitReview');
            if (submitReview) {
                submitReview.addEventListener('click', () => {
                    const text = document.getElementById('newReviewText').value.trim();
                    if (!text) return;
                    const newReview = {
                        id: 'rev_' + Date.now() + Math.random().toString(36).substr(2,6),
                        bookId: bookId,
                        userId: currentUser.id,
                        username: currentUser.displayName || currentUser.username,
                        text: text,
                        timestamp: new Date().toISOString(),
                        likes: [],
                        comments: []
                    };
                    reviews.push(newReview);
                    DataService.saveReviews(reviews);
                    renderReviews(bookId);
                });
            }
        }
    }

    function checkHashForReview() {
        if (window.location.hash.startsWith('#review-')) {
            const reviewId = window.location.hash.substring(8); // remove '#review-'
            const review = reviews.find(r => r.id === reviewId);
            if (review) {
                const book = books.find(b => b.id === review.bookId);
                if (book) {
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        openModal(book);
                        // After modal opens, directly activate the reviews tab
                        setTimeout(() => {
                            const reviewsTab = Array.from(tabs).find(t => t.dataset.tab === 'reviews');
                            if (reviewsTab) {
                                // Remove active class from all tabs and panes
                                tabs.forEach(t => t.classList.remove('active'));
                                panes.forEach(p => p.classList.remove('active'));
                                // Activate reviews tab and its pane
                                reviewsTab.classList.add('active');
                                document.getElementById('tab-reviews').classList.add('active');
                            }
                        }, 100);
                    }, 100);
                }
            }
        }
    }

    // Call it after initial render
    renderBooks();
    renderNews();
    checkHashForReview(); // <-- add this line

    // ---------- Open modal ----------
    function openModal(book) {
        modalCover.style.backgroundImage = `url('${book.cover}')`;
        modalTitle.innerText = book.title;
        modalAuthor.innerText = book.author;
        modalPrice.innerText = `$${book.price}`;
        modalAvailability.innerText = 'At Distributor - We Can Usually Get It in 3-8 Days! NON-RETURNABLE - Arrival Times Vary, Often 1-2 Weeks';
        modalDescription.innerText = book.description || langPack[currentLang].bookDescription;
        modalAuthorBio.innerText = book.authorBio || 'Information about the author is not available.';
        if (book.categories && book.categories.length) {
            modalCategories.innerHTML = book.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('');
        } else {
            modalCategories.innerHTML = '<span class="category-tag">General</span>';
        }
        modalIsbn.innerText = book.isbn || '978-1-7381938-6-8';
        modalPublisher.innerText = book.publisher || 'Acer Books';
        modalPubDate.innerText = book.pubDate || 'March 17th, 2024';
        modalPages.innerText = book.pages || '170';
        modalLanguage.innerText = book.language || 'Chinese';

        renderReviews(book.id);

        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tabs[0].classList.add('active');
        panes[0].classList.add('active');

        modalAddToCart.dataset.bookId = book.id;
        modalAddToWishList.dataset.bookId = book.id;

        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    modalAddToCart.addEventListener('click', () => {
        alert('🛒 Added to cart (demo)');
        closeModal();
    });
    modalAddToWishList.addEventListener('click', () => {
        alert('❤️ Added to wish list (demo)');
    });

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // ---------- Render books (random 5-8) ----------
    function renderBooks() {
    let booksToShow = books; // 管理员模式显示全部

    if (!adminMode) {
        const width = window.innerWidth;
        let count;

        if (width < 600) {
            count = 6;
        } else if (width < 800) {
            count = 6;
        } else if (width < 1000) {
            count = 6;
        } else if (width < 1200) {
            count = 8;
        } else if (width < 1400) {
            count = 5;
        } else {
            count = 6;
        }

        const shuffled = [...books];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        booksToShow = shuffled.slice(0, count);
    }

        let html = '';
        booksToShow.forEach((book) => {
            let coverStyle = book.cover 
                ? `background-image: url('${book.cover}'); background-size: cover; background-position: center;`
                : `background: #2d2d2d;`;
            const deleteBtn = adminMode ? `<button class="delete-book" data-id="${book.id}"><i class="fas fa-trash-alt"></i></button>` : '';
            html += `
                <div class="book-card" data-id="${book.id}">
                    <div class="book-cover" style="${coverStyle} background-color: #2d2d2d;">
                        ${book.title.length > 25 ? book.title.substr(0,22)+'…' : book.title}
                    </div>
                    <div class="book-meta">
                        <div class="book-title">${book.title}</div>
                        <div class="book-author">${book.author}</div>
                        ${adminMode ? `<div class="admin-controls">${deleteBtn}</div>` : ''}
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;

        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.admin-controls')) return;
                const bookId = card.dataset.id;
                const book = books.find(b => b.id === bookId);
                if (book) openModal(book);
            });
        });

        if (adminMode) {
            document.querySelectorAll('.delete-book').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    books = books.filter(b => b.id !== id);
                    DataService.saveBooks(books);
                    renderBooks();
                });
            });
        }
    }

    // ---------- Render news ----------
    function renderNews() {
        let html = '';
        newsItems.forEach(item => {
            // Get title and summary based on current language
            const title = (item.title && typeof item.title === 'object')
                ? (item.title[currentLang] || item.title.en || '')
                : item.title || '';
            const summary = (item.summary && typeof item.summary === 'object')
                ? (item.summary[currentLang] || item.summary.en || '')
                : item.summary || '';

            const imageHtml = item.image 
                ? `<div class="news-image" style="background-image: url('${item.image}');"></div>` 
                : `<div class="news-image" style="background-color: #ccc;"></div>`;
            const deleteBtn = adminMode ? `<button class="delete-news" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>` : '';
            html += `
                <div class="news-item" data-id="${item.id}">
                    ${imageHtml}
                    <div class="news-date">${item.date}</div>
                    <div class="news-title">${title}</div>
                    <div class="news-summary">${summary}</div>
                    <div class="news-footer">${deleteBtn}</div>
                </div>
            `;
        });
        newsGrid.innerHTML = html;

        if (adminMode) {
            document.querySelectorAll('.delete-news').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    newsItems = newsItems.filter(n => n.id !== id);
                    DataService.saveNews(newsItems);
                    renderNews();
                });
            });
        }
    }

    // ---------- Admin toggle ----------
    adminSwitch.addEventListener('click', function() {
        if (adminMode) {
            adminMode = false;
            adminSwitch.classList.remove('active');
            toolbox.classList.add('hidden');
            renderBooks();
            renderNews();
        } else {
            const pwd = prompt("Enter admin password:");
            if (pwd === ADMIN_PASSWORD) {
                adminMode = true;
                adminSwitch.classList.add('active');
                toolbox.classList.remove('hidden');
                renderBooks();
                renderNews();
            } else {
                alert("Incorrect password.");
            }
        }
    });

    // ---------- Add book ----------
    coverUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        fileNameSpan.textContent = file ? file.name : 'No file chosen';
    });
    addBtn.addEventListener('click', function() {
        const title = newTitle.value.trim() || 'Untitled';
        const author = newAuthor.value.trim() || 'Anonymous';
        const price = parseFloat(newPrice.value) ? parseFloat(newPrice.value).toFixed(2) : '15.00';
        const lang = newLang.value;
        const file = coverUpload.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addBookToArray(title, author, price, lang, e.target.result);
                coverUpload.value = '';
                fileNameSpan.textContent = 'No file chosen';
            };
            reader.readAsDataURL(file);
        } else {
            addBookToArray(title, author, price, lang, null);
        }
    });

    function addBookToArray(title, author, price, lang, coverDataUrl) {
        const newId = 'b' + Date.now() + Math.random().toString(36).substring(2,6);
        const newBook = {
            id: newId,
            title: title,
            author: author + (lang ? ' · ' + lang : ''),
            price: price,
            lang: lang,
            isbn: '978-1-7381938-0-0',
            publisher: 'Acer Books',
            pubDate: '2025',
            pages: 200,
            language: lang,
            categories: ['General'],
            description: 'A new addition to the Acer Books catalogue.',
            authorBio: 'Author information coming soon.',
            format: 'Paperback'
        };
        if (coverDataUrl) newBook.cover = coverDataUrl;
        books.push(newBook);
        DataService.saveBooks(books);
        renderBooks();
    }

    // ---------- Add news ----------
    newsImageUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        newsFileNameSpan.textContent = file ? file.name : 'No file chosen';
    });
    addNewsBtn.addEventListener('click', function() {
        const date = newsDate.value.trim() || 'No date';
        const title = newsTitle.value.trim() || 'Untitled';
        const summary = newsSummary.value.trim() || '';
        const file = newsImageUpload.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addNewsToArray(date, title, summary, e.target.result);
                newsImageUpload.value = '';
                newsFileNameSpan.textContent = 'No file chosen';
            };
            reader.readAsDataURL(file);
        } else {
            addNewsToArray(date, title, summary, null);
        }
    });

    function addNewsToArray(date, title, summary, imageDataUrl) {
        const newId = 'n' + Date.now() + Math.random().toString(36).substring(2,6);
        // Store as bilingual object (only English for now)
        const newItem = {
            id: newId,
            date,
            title: { en: title },
            summary: { en: summary }
        };
        if (imageDataUrl) newItem.image = imageDataUrl;
        newsItems.push(newItem);
        DataService.saveNews(newsItems);
        renderNews();
    }

    // ---------- Language switch ----------
    function setLanguage(lang) {
        currentLang = lang;
        translateUI(lang);
        renderNews();
    }
    langEn.addEventListener('click', (e) => { e.preventDefault(); setLanguage('en'); });
    langFr.addEventListener('click', (e) => { e.preventDefault(); setLanguage('fr'); });

    // ---------- Initial render ----------
    renderBooks();
    renderNews();
    updateUserUI();
    translateUI('en');
    cartIcon.addEventListener('click', () => alert('🛒 Proceed to checkout (demo)'));
})();