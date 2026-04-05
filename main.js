// main.js (complete with fixes - REPAIRED VERSION)
import { BASE_PATH } from './constants.js';
import { 
    setLanguage, renderBooks, renderAllBooks, renderNews, renderAllNews, renderNewsDetail,
    renderBookDetail, updateDetailLanguage, openModal, closeModal, translateUI, resetMetaTags, 
    updateMetaTags, currentModalBook, currentNewsItem, currentModalFormat, resetBooksPageState
} from './ui.js';
import { langPack, currentLang } from './i18n.js';
import { 
    adminMode, currentUser, logout, updateUserUI, bindInactivityEvents, openAdminLoginModal,
    updateAdminNavLink, login, signup, initAuth, isAdminUser, openLoginModal, resetLoginModalLinks
} from './auth.js';
import { cart, loadCart, saveCart, addToCart, renderCartModal } from './cart.js';
import { saveOrder } from './data.js';
import { 
    showAdminBooksPage, hideAdminBooksPage, renderAdminBookList, openBookFormModal, initQuillEditors,
    setAdminSearchTerm, setAdminSortBy, showAdminNewsPage, hideAdminNewsPage, attachAdminNewsEvents 
} from './admin.js';
import { renderReviews, renderDetailReviews, checkHashForReview } from './review.js';
import { navigateTo, handleRoute } from './routing.js';
import { loadBooks, loadNews, loadReviews, newsItems } from './data.js';

// DOM elements (same as original)
const adminSwitch = document.getElementById('adminSwitch');
const langEn = document.getElementById('langEn');
const langFr = document.getElementById('langFr');
const cartIcon = document.getElementById('cartIcon');
const cartModal = document.getElementById('cartModal');
const cartModalClose = document.getElementById('cartModalClose');
const continueShoppingBtn = document.getElementById('continueShoppingBtn');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const checkoutModalClose = document.getElementById('checkoutModalClose');
const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalClose = document.getElementById('confirmationModalClose');
const continueShoppingConfirmBtn = document.getElementById('continueShoppingConfirmBtn');
const printReceiptBtn = document.getElementById('printReceiptBtn');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const backToHomeFromBooks = document.getElementById('backToHomeFromBooks');
const backToBooks = document.getElementById('backToBooks');
const backToHomeFromNews = document.getElementById('backToHomeFromNews');
const backToNewsList = document.getElementById('backToNewsList');
const booksViewAllLink = document.getElementById('booksViewAllLink');
const newsMoreLink = document.getElementById('newsMoreLink');
const viewLink = document.querySelector('.view-link');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginClose = document.getElementById('adminLoginClose');
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const loginBtn = document.getElementById('loginBtn');
const loginClose = document.getElementById('loginClose');
const loginOverlay = document.getElementById('loginOverlay');
const searchInput = document.getElementById('searchBooks');
const sortSelect = document.getElementById('sortBooks');
const addNewBookBtn = document.getElementById('addNewBookBtn');
const bookFormModal = document.getElementById('bookFormModal');
// ========== News Form Modal Close Button ==========
const newsFormModal = document.getElementById('newsFormModal');
const newsFormClose = document.querySelector('[id*="newsFormModalClose"], .news-form-close');

if (newsFormClose) {
    newsFormClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (newsFormModal) {
            newsFormModal.classList.remove('active');
            // 清空表单
            document.querySelectorAll('#newsFormModal input, #newsFormModal textarea').forEach(el => {
                el.value = '';
            });
        }
    });
}
const formModalClose = document.getElementById('bookFormModalClose');
formModalClose?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const modal = document.getElementById('bookFormModal');
    if (modal) {
        modal.classList.remove('active');
        // 清空表单
        document.querySelectorAll('#bookFormModal input, #bookFormModal textarea').forEach(el => {
            el.value = '';
        });
    }
});
const cancelFormBtn = document.getElementById('cancelFormBtn');
// ========== Cancel News Form Button ==========
const newsCancelBtn = document.querySelector('[id*="newsCancelBtn"], [id*="cancelNewsBtn"]');

if (newsCancelBtn) {
    newsCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = document.getElementById('newsFormModal');
        if (modal) {
            modal.classList.remove('active');
            // 清空表单
            document.querySelectorAll('#newsFormModal input, #newsFormModal textarea').forEach(el => {
                el.value = '';
            });
        }
    });
}
const backToHomeFromAdmin = document.getElementById('backToHomeFromAdmin');
const modalClose = document.getElementById('modalClose');
const modalAddToCart = document.getElementById('modalAddToCart');
const modalAddToWishList = document.getElementById('modalAddToWishList');
const modalOverlay = document.getElementById('bookModal');
const signupOverlay = document.getElementById('signupOverlay');
const signupClose = document.getElementById('signupClose');
const signupBtn = document.getElementById('signupBtn');
const goToSignupLink = document.getElementById('goToSignupLink');
const goToLoginLink = document.getElementById('goToLoginLink');

// Helper: Admin Toggle Visibility
function updateAdminToggleVisibility() {
    const adminToggle = document.getElementById('adminToggle');
    if (!adminToggle) return;
    if (isAdminUser) {
        adminToggle.classList.remove('hidden');
    } else {
        let path = window.location.pathname.replace(/\/+/g, '/');
        const basePattern = new RegExp('^' + BASE_PATH.replace(/\/+$/, '') + '/?');
        const relativePath = path.replace(basePattern, '') || '/';
        if (adminMode || relativePath === 'admin') {
            adminToggle.classList.remove('hidden');
        } else {
            adminToggle.classList.add('hidden');
        }
    }
}

// ---------- Event Listeners ----------

// Admin toggle
adminSwitch?.addEventListener('click', async () => {
    const { toggleAdminMode, updateAdminNavLink } = await import('./auth.js');
    toggleAdminMode();
    setTimeout(() => {
        updateAdminNavLink();  // ✨ 关键：这一行更新UI
    }, 100);
});

adminLoginBtn?.addEventListener('click', () => { /* no-op */ });
adminLoginClose?.addEventListener('click', () => { /* no-op */ });
adminLoginOverlay?.addEventListener('click', () => { /* no-op */ });

/* ============================================
   ✅ 修复 2: Navbar 页面导航功能
   ============================================ */

// 获取navbar导航元素
const navHome = document.getElementById('navHome');
const navBooks = document.getElementById('navBooks');
const navAbout = document.getElementById('navAbout');
const navNews = document.getElementById('navNews');
const navLinksMenu = document.getElementById('navLinks');

/**
 * 关闭mobile导航菜单
 */
function closeNavMenu() {
    if (navLinksMenu) navLinksMenu.classList.remove('show');
    if (hamburger) hamburger.classList.remove('active');
}

/**
 * 平滑滚动到指定的section
 * @param {string} sectionId - section的ID或'home'
 */
function scrollToSection(sectionId) {
    closeNavMenu();
    
    if (sectionId === 'home') {
        // 滚动到页面顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // 滚动到指定section
        const element = document.getElementById(`section${sectionId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// HOME 按钮事件
if (navHome) {
    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('home');
    });
}

// BOOKS 按钮事件
if (navBooks) {
    navBooks.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('Books');
    });
}

// ABOUT 按钮事件
if (navAbout) {
    navAbout.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('About');
    });
}

// NEWS 按钮事件
if (navNews) {
    navNews.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('News');
    });
}

/* ============================================
   Newsletter Modal — redesigned to match the
   user profile modal (two-panel: sidebar + body)
   ============================================ */

const newsletterLink = document.getElementById('newsletterLink');

/** Close the newsletter modal helper */
function _closeNewsletterModal() {
    const modal = document.getElementById('newsletterModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

/**
 * Build or retrieve the newsletter modal shell.
 * The inner structure mirrors the account modal layout:
 *   .newsletter-modal-content
 *     .nl-sidebar   (dark crimson, branding + stat pills)
 *     .nl-body      (scrollable news list)
 */
function getOrCreateNewsletterModal() {
    let modal = document.getElementById('newsletterModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'newsletterModal';
    modal.className = 'login-overlay';          // reuse the same backdrop class
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="newsletter-modal-content">
            <!-- Close button -->
            <button class="acc-modal-close" id="nlModalClose" aria-label="Close">
                <i class="fas fa-times"></i>
            </button>

            <!-- Left sidebar -->
            <div class="nl-sidebar">
                <div class="nl-sidebar-brand">
                    <div class="nl-sidebar-icon">
                        <i class="fas fa-newspaper"></i>
                    </div>
                    <div class="nl-sidebar-title">News &amp;<br>Events</div>
                    <div class="nl-sidebar-sub">Acer Books</div>
                </div>
                <nav class="nl-sidebar-nav">
                    <div class="nl-nav-item active" id="nlNavAll">
                        <i class="fas fa-layer-group"></i> All News
                    </div>
                    <div class="nl-nav-item" id="nlNavLatest">
                        <i class="fas fa-star"></i> Latest
                    </div>
                </nav>
                <button class="nl-sidebar-viewall" id="nlViewAllBtn">
                    View all news <i class="fas fa-arrow-right"></i>
                </button>
            </div>

            <!-- Right content -->
            <div class="nl-body">
                <p class="acc-section-title" id="nlBodyTitle">Latest Updates</p>
                <div id="nlNewsList" class="nl-news-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) _closeNewsletterModal();
    });
    // Close button
    document.getElementById('nlModalClose')?.addEventListener('click', _closeNewsletterModal);
    // View-all button
    document.getElementById('nlViewAllBtn')?.addEventListener('click', () => {
        _closeNewsletterModal();
        navigateTo('/news');
    });

    return modal;
}

/**
 * Render news items into the #nlNewsList container.
 * @param {Array}  items   – array of news objects
 * @param {boolean} latestOnly – highlight the first item
 */
function _renderNlItems(items, latestOnly = false) {
    const list = document.getElementById('nlNewsList');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<p class="acc-empty">No news available yet. Check back soon!</p>';
        return;
    }

    list.innerHTML = items.map((item, idx) => {
        const lang  = (typeof currentLang !== 'undefined') ? currentLang : 'en';
        const title = (item.title && typeof item.title === 'object')
            ? (item.title[lang] || item.title.en || '')
            : (item.title || 'Untitled');
        const summary = (item.summary && typeof item.summary === 'object')
            ? (item.summary[lang] || item.summary.en || '')
            : (item.summary || '');
        const displayDate = item.display_date ||
            (item.event_date
                ? new Date(item.event_date).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' })
                : (item.created_at
                    ? new Date(item.created_at).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' })
                    : ''));
        const coverStyle = item.image
            ? `background-image:url('${item.image}');background-size:cover;background-position:center;`
            : `background:linear-gradient(135deg,#4a0000 0%,#8b0000 100%);`;
        const isLatest = latestOnly && idx === 0;

        return `
            <div class="nl-news-item${isLatest ? ' nl-news-item--featured' : ''}"
                 data-news-id="${item.id}"
                 role="button" tabindex="0"
                 aria-label="Read: ${title}">
                <div class="nl-news-thumb" style="${coverStyle}">
                    ${!item.image ? '<i class="fas fa-newspaper" style="color:rgba(255,255,255,0.3);font-size:1.4rem;"></i>' : ''}
                </div>
                <div class="nl-news-info">
                    ${isLatest ? '<span class="nl-badge">Latest</span>' : ''}
                    <div class="nl-news-date">
                        <i class="fas fa-calendar-alt"></i> ${displayDate}
                    </div>
                    <div class="nl-news-title">${title}</div>
                    <div class="nl-news-summary">${summary.substring(0, 110)}${summary.length > 110 ? '…' : ''}</div>
                </div>
                <div class="nl-news-arrow"><i class="fas fa-chevron-right"></i></div>
            </div>`;
    }).join('');

    // Attach click + keyboard navigation
    list.querySelectorAll('.nl-news-item').forEach(card => {
        const go = () => {
            _closeNewsletterModal();
            navigateTo(`/news/${card.dataset.newsId}`);
        };
        card.addEventListener('click', go);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
    });
}

if (newsletterLink) {
    newsletterLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const modal = getOrCreateNewsletterModal();

        try {
            // Sort published items newest-first
            const published = (newsItems || [])
                .filter(n => n.status === 'published' || !n.status)
                .sort((a, b) => {
                    const da = a.event_date ? new Date(a.event_date) : 0;
                    const db = b.event_date ? new Date(b.event_date) : 0;
                    return db - da;
                });

            _renderNlItems(published.slice(0, 5), true);

            // Sidebar nav tab behaviour
            const navAll    = document.getElementById('nlNavAll');
            const navLatest = document.getElementById('nlNavLatest');
            const titleEl   = document.getElementById('nlBodyTitle');

            navAll?.addEventListener('click', () => {
                navAll.classList.add('active');
                navLatest?.classList.remove('active');
                if (titleEl) titleEl.textContent = 'Latest Updates';
                _renderNlItems(published.slice(0, 5), true);
            });
            navLatest?.addEventListener('click', () => {
                navLatest.classList.add('active');
                navAll?.classList.remove('active');
                if (titleEl) titleEl.textContent = 'Most Recent';
                _renderNlItems(published.slice(0, 1), true);
            });

        } catch (err) {
            console.error('Error loading newsletter:', err);
            const list = document.getElementById('nlNewsList');
            if (list) list.innerHTML = '<p class="acc-empty" style="color:#ff0000;">Error loading news. Please try again.</p>';
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    });
}

// Backdrop click handled inside getOrCreateNewsletterModal; also allow Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _closeNewsletterModal();
});

// Regular login
async function doLogin() {
    const email    = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errEl    = document.getElementById('loginError');
    if (!email && !password) { if(errEl) errEl.textContent = 'Please enter your email and password.'; return; }
    if (!email)    { if(errEl) errEl.textContent = 'Please enter your email.'; return; }
    if (!password) { if(errEl) errEl.textContent = 'Please enter your password.'; return; }
    await login(email, password);
}
loginBtn?.addEventListener('click', doLogin);
['loginUsername','loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
});

// After login: refresh admin nav + page content
window.addEventListener('userLogin', async () => {
    const { adminMode, updateAdminNavLink } = await import('./auth.js');
    updateAdminNavLink();
    updateAdminToggleVisibility();
    if (adminMode) {
        await handleRoute();
    }
});

// After logout: refresh UI
window.addEventListener('userLogout', async () => {
    updateAdminToggleVisibility();
});

// Password toggles
document.getElementById('loginPwToggle')?.addEventListener('click', () => {
    const inp = document.getElementById('loginPassword');
    const ico = document.querySelector('#loginPwToggle i');
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text';     if(ico) ico.className = 'fas fa-eye-slash'; }
    else                         { inp.type = 'password'; if(ico) ico.className = 'fas fa-eye'; }
});
document.getElementById('signupPwToggle')?.addEventListener('click', () => {
    const inp = document.getElementById('signupPassword');
    const ico = document.querySelector('#signupPwToggle i');
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text';     if(ico) ico.className = 'fas fa-eye-slash'; }
    else                         { inp.type = 'password'; if(ico) ico.className = 'fas fa-eye'; }
});
document.getElementById('signupPwToggle2')?.addEventListener('click', () => {
    const inp = document.getElementById('signupConfirmPassword');
    const ico = document.querySelector('#signupPwToggle2 i');
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text';     if(ico) ico.className = 'fas fa-eye-slash'; }
    else                         { inp.type = 'password'; if(ico) ico.className = 'fas fa-eye'; }
});

// Forgot password
document.getElementById('forgotPasswordLink')?.addEventListener('click', e => {
    e.preventDefault();
    loginOverlay?.classList.remove('active');
    document.getElementById('resetPasswordOverlay')?.classList.add('active');
    document.getElementById('resetMsg') && (document.getElementById('resetMsg').textContent = '');
});
document.getElementById('resetPasswordClose')?.addEventListener('click', () => {
    document.getElementById('resetPasswordOverlay')?.classList.remove('active');
});
document.getElementById('resetPasswordOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('resetPasswordOverlay'))
        document.getElementById('resetPasswordOverlay').classList.remove('active');
});
document.getElementById('backToLoginFromReset')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('resetPasswordOverlay')?.classList.remove('active');
    openLoginModal('user');
});
document.getElementById('sendResetBtn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('resetMsg');
    const email = document.getElementById('resetEmail')?.value.trim();
    if (!email) { if(msgEl){msgEl.textContent='Please enter your email.'; msgEl.className='login-error';} return; }
    try {
        const { resetPassword } = await import('./auth.js');
        await resetPassword(email);
        if(msgEl) { msgEl.textContent = 'Password reset email sent!'; msgEl.className = 'login-error success'; }
    } catch(err) { if(msgEl) { msgEl.textContent = err.message; msgEl.className = 'login-error'; } }
});

// Signup
async function doSignup() {
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm = document.getElementById('signupConfirmPassword')?.value;
    const displayName = document.getElementById('signupDisplayName')?.value.trim();
    const errEl = document.getElementById('signupError');
    if (!email) { if(errEl) errEl.textContent = 'Please enter an email.'; return; }
    if (!password) { if(errEl) errEl.textContent = 'Please enter a password.'; return; }
    if (password.length < 6) { if(errEl) errEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (password !== confirm) { if(errEl) errEl.textContent = 'Passwords do not match.'; return; }
    if (!displayName) { if(errEl) errEl.textContent = 'Please enter a display name.'; return; }
    try {
        await signup(email, password, displayName);
        if(errEl) { errEl.textContent = 'Signup successful! Please check your email to confirm.'; errEl.className = 'login-error success'; }
        ['signupEmail','signupPassword','signupConfirmPassword','signupDisplayName'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    } catch(err) { if(errEl) { errEl.textContent = err.message; errEl.className = 'login-error'; } }
}
signupBtn?.addEventListener('click', doSignup);
['signupEmail','signupPassword','signupConfirmPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSignup();
    });
});

// Cart operations
cartIcon?.addEventListener('click', async () => {
    await renderCartModal();
    cartModal?.classList.add('active');
});
cartModalClose?.addEventListener('click', () => {
    cartModal?.classList.remove('active');
});
cartModal?.addEventListener('click', e => {
    if (e.target === cartModal) cartModal.classList.remove('active');
});

// Newsletter Checkout
window.addEventListener('openCheckoutFromCart', () => {
    cartModal?.classList.remove('active');
    checkoutModal?.classList.add('active');
    document.getElementById('checkoutSteps')?.scrollIntoView({ behavior: 'smooth' });
});

// Checkout Modal
checkoutModalClose?.addEventListener('click', () => {
    checkoutModal?.classList.remove('active');
});
checkoutModal?.addEventListener('click', e => {
    if (e.target === checkoutModal) checkoutModal.classList.remove('active');
});

// Checkout navigation
document.getElementById('coNext1')?.addEventListener('click', () => {
    const firstName = document.getElementById('shipFirstName')?.value.trim();
    const lastName = document.getElementById('shipLastName')?.value.trim();
    const email = document.getElementById('shipEmail')?.value.trim();
    const address = document.getElementById('shipAddress')?.value.trim();
    const city = document.getElementById('shipCity')?.value.trim();
    const province = document.getElementById('shipProvince')?.value.trim();
    const postal = document.getElementById('shipPostal')?.value.trim();
    const errEl = document.getElementById('coErr1');
    if (!firstName || !lastName || !email || !address || !city || !province || !postal) {
        if(errEl) errEl.textContent = 'Please fill in all required fields.';
        return;
    }
    if(!errEl) return;
    errEl.textContent = '';
    document.getElementById('coStep1')?.classList.add('hidden');
    document.getElementById('coStep2')?.classList.remove('hidden');
    document.querySelector('[data-step="1"]')?.classList.add('completed');
    document.querySelector('[data-step="2"]')?.classList.add('active');
});

document.getElementById('coBack2')?.addEventListener('click', () => {
    document.getElementById('coStep2')?.classList.add('hidden');
    document.getElementById('coStep1')?.classList.remove('hidden');
    document.querySelector('[data-step="1"]')?.classList.remove('completed');
    document.querySelector('[data-step="2"]')?.classList.remove('active');
});

document.getElementById('coNext2')?.addEventListener('click', () => {
    document.getElementById('coStep2')?.classList.add('hidden');
    document.getElementById('coStep3')?.classList.remove('hidden');
    document.querySelector('[data-step="2"]')?.classList.add('completed');
    document.querySelector('[data-step="3"]')?.classList.add('active');
});

document.getElementById('coBack3')?.addEventListener('click', () => {
    document.getElementById('coStep3')?.classList.add('hidden');
    document.getElementById('coStep2')?.classList.remove('hidden');
    document.querySelector('[data-step="2"]')?.classList.remove('completed');
    document.querySelector('[data-step="3"]')?.classList.remove('active');
});

document.getElementById('coNext3')?.addEventListener('click', () => {
    const cardName = document.getElementById('cardName')?.value.trim();
    const cardNumber = document.getElementById('cardNumber')?.value.trim();
    const expiry = document.getElementById('expiry')?.value.trim();
    const cvv = document.getElementById('cvv')?.value.trim();
    const errEl = document.getElementById('paymentError');
    if (!cardName || !cardNumber || !expiry || !cvv) {
        if(errEl) errEl.textContent = 'Please fill in all payment details.';
        return;
    }
    if(!errEl) return;
    errEl.textContent = '';
    document.getElementById('coStep3')?.classList.add('hidden');
    document.getElementById('coStep4')?.classList.remove('hidden');
    document.querySelector('[data-step="3"]')?.classList.add('completed');
    document.querySelector('[data-step="4"]')?.classList.add('active');
    _renderCoReview();
});

document.getElementById('coBack4')?.addEventListener('click', () => {
    document.getElementById('coStep4')?.classList.add('hidden');
    document.getElementById('coStep3')?.classList.remove('hidden');
    document.querySelector('[data-step="3"]')?.classList.remove('completed');
    document.querySelector('[data-step="4"]')?.classList.remove('active');
});

document.getElementById('coPlaceOrder')?.addEventListener('click', async () => {
    const firstName = document.getElementById('shipFirstName')?.value;
    const lastName = document.getElementById('shipLastName')?.value;
    const email = document.getElementById('shipEmail')?.value;
    const address = document.getElementById('shipAddress')?.value;
    const city = document.getElementById('shipCity')?.value;
    const province = document.getElementById('shipProvince')?.value;
    const postal = document.getElementById('shipPostal')?.value;
    const country = document.getElementById('shipCountry')?.value;
    const shippingMethod = document.querySelector('input[name="shippingMethod"]:checked')?.value;
    
    const order = {
        user_id: currentUser?.id || null,
        items: cart.map(item => ({
            title: item.title,
            qty: item.quantity,
            price: item.price
        })),
        total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + (shippingMethod === 'express' ? 15 : shippingMethod === 'standard' ? 5 : 0) + (cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.1),
        shipping_method: shippingMethod,
        shipping_address: { firstName, lastName, address, city, province, postal, country },
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    try {
        await saveOrder(order);
        // Success
        checkoutModal?.classList.remove('active');
        confirmationModal?.classList.add('active');
        cart.length = 0;
        saveCart();
        renderCartModal();
    } catch(err) {
        const errEl = document.getElementById('coReviewError');
        if(errEl) errEl.textContent = 'Error placing order: ' + err.message;
    }
});

function _renderCoReview() {
    const el = document.getElementById('coReviewContent');
    if (!el) return;
    const firstName = document.getElementById('shipFirstName')?.value;
    const lastName = document.getElementById('shipLastName')?.value;
    const email = document.getElementById('shipEmail')?.value;
    const address = document.getElementById('shipAddress')?.value;
    const city = document.getElementById('shipCity')?.value;
    const province = document.getElementById('shipProvince')?.value;
    const postal = document.getElementById('shipPostal')?.value;
    const country = document.getElementById('shipCountry')?.value;
    const shippingMethod = document.querySelector('input[name="shippingMethod"]:checked')?.value;
    const cardName = document.getElementById('cardName')?.value;
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = shippingMethod === 'express' ? 15 : shippingMethod === 'standard' ? 5 : 0;
    const tax = subtotal * 0.1;
    const total = subtotal + shipping + tax;
    
    let itemsHtml = cart.map(item => `<div class="review-item"><span>${item.title}</span> × ${item.quantity} <span style="color:#ff0000;font-weight:600;">$${(item.price * item.quantity).toFixed(2)}</span></div>`).join('');
    
    el.innerHTML = `
        <div class="co-review">
            <h4 style="margin-bottom:1rem;">Order Summary</h4>
            <div style="background:#f9f9f9;padding:1rem;border-radius:8px;margin-bottom:1rem;">
                <h5 style="margin-bottom:0.5rem;font-weight:600;">Items</h5>
                ${itemsHtml}
            </div>
            <div style="background:#f9f9f9;padding:1rem;border-radius:8px;margin-bottom:1rem;">
                <h5 style="margin-bottom:0.5rem;font-weight:600;">Shipping Address</h5>
                <p>${firstName} ${lastName}</p>
                <p>${address}</p>
                <p>${city}, ${province} ${postal}</p>
                <p>${country}</p>
            </div>
            <div class="review-totals" style="background:#f9f9f9;padding:1rem;border-radius:8px;">
                <div class="total-row" style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><span>Subtotal:</span><strong>$${subtotal.toFixed(2)}</strong></div>
                <div class="total-row" style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><span>Shipping (${shippingMethod}):</span><strong>$${shipping.toFixed(2)}</strong></div>
                <div class="total-row" style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><span>Tax:</span><strong>$${tax.toFixed(2)}</strong></div>
                <div class="total-row" style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:0.5rem;"><span>Total:</span><strong style="color:#ff0000;font-size:1.2rem;">$${total.toFixed(2)}</strong></div>
            </div>
        </div>
    `;
}

// Confirmation Modal
confirmationModalClose?.addEventListener('click', () => {
    confirmationModal?.classList.remove('active');
});
continueShoppingConfirmBtn?.addEventListener('click', () => {
    confirmationModal?.classList.remove('active');
    navigateTo('/');
});

// Language switching
langEn?.addEventListener('click', e => {
    e.preventDefault();
    import('./ui.js').then(({ setLanguage }) => setLanguage('en'));
});
langFr?.addEventListener('click', e => {
    e.preventDefault();
    import('./ui.js').then(({ setLanguage }) => setLanguage('fr'));
});

// Hamburger menu
hamburger?.addEventListener('click', () => {
    navLinks?.classList.toggle('show');
    hamburger?.classList.toggle('active');
});

// Hero button
document.querySelector('.hero button')?.addEventListener('click', e => {
    e.preventDefault();
    const section = document.getElementById('sectionBooks');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
});

// Back buttons
backToHomeFromBooks?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/');
});
backToBooks?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/books');
});
backToHomeFromNews?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/');
});
backToNewsList?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/news');
});
booksViewAllLink?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/books');
});
newsMoreLink?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('/news');
});

// About button → open contact modal (no login required)
document.querySelector('.about-text button')?.addEventListener('click', e => {
    e.preventDefault();
    const contactModal = document.getElementById('contactModal');
    if (contactModal) contactModal.classList.add('active');
});

// Contact modal: close
document.getElementById('contactModalClose')?.addEventListener('click', () => {
    document.getElementById('contactModal')?.classList.remove('active');
});

// Contact modal: submit → mailto
document.getElementById('contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const firstName = document.getElementById('contactFirstName')?.value.trim();
    const lastName  = document.getElementById('contactLastName')?.value.trim();
    const email     = document.getElementById('contactEmail')?.value.trim();
    const message   = document.getElementById('contactMessage')?.value.trim();
    if (!firstName || !lastName || !email || !message) return;
    const subject = encodeURIComponent(`Message from ${firstName} ${lastName}`);
    const body    = encodeURIComponent(`From: ${firstName} ${lastName}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:acerbookscanada@gmail.com?subject=${subject}&body=${body}`;
    document.getElementById('contactModal')?.classList.remove('active');
    document.getElementById('contactForm')?.reset();
});

// Admin pages
backToHomeFromAdmin?.addEventListener('click', e => {
    e.preventDefault();
    import('./admin.js').then(({ hideAdminBooksPage, hideAdminNewsPage }) => {
        hideAdminBooksPage();
        hideAdminNewsPage();
        navigateTo('/');
    });
});

addNewBookBtn?.addEventListener('click', () => {
    import('./admin.js').then(({ openBookFormModal }) => openBookFormModal());
});

document.getElementById('cancelFormBtn')?.addEventListener('click', () => {
    bookFormModal?.classList.remove('active');
});

bookFormModal?.addEventListener('click', e => {
    if (e.target === bookFormModal) bookFormModal.classList.remove('active');
});

document.getElementById('submitBookForm')?.addEventListener('click', async () => {
    const { getAdminBookFormData, saveBooks } = await import('./admin.js');
    const newBooks = getAdminBookFormData();
    try {
        await saveBooks([...books, ...newBooks]);
        bookFormModal?.classList.remove('active');
    } catch(err) {
        alert('Error: ' + err.message);
    }
});

// ========== Back to Home 和 Add News 按钮 ==========
document.addEventListener('click', function(e) {
    // Back to Home 按钮
    if (e.target.textContent.includes('Back to Home') || 
        e.target.classList.contains('admin-back-btn') ||
        e.target.id.includes('backToHome')) {
        e.preventDefault();
        e.stopPropagation();
        import('./routing.js').then(({ navigateTo }) => {
            navigateTo('/');
        });
    }
    
    // Add News 按钮
    if (e.target.id === 'addNewsBtn' || 
        e.target.textContent.includes('Add news')) {
        e.preventDefault();
        e.stopPropagation();
        // 打开新闻表单模态框
        const newsModal = document.getElementById('newsFormModal') || 
                         document.querySelector('[id*="newsForm"]');
        if (newsModal) newsModal.classList.add('active');
    }
});

// Book modal
modalClose?.addEventListener('click', () => {
    modalOverlay?.classList.remove('active');
});
modalOverlay?.addEventListener('click', e => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

modalAddToCart?.addEventListener('click', () => {
    if (!currentModalBook) return;
    import('./ui.js').then(({ currentModalFormat }) => {
        addToCart(currentModalBook, currentModalFormat);
        alert(`${currentModalBook.title} added to cart!`);
        renderCartModal();
    });
});

modalAddToWishList?.addEventListener('click', () => {
    if (!currentModalBook) return;
    if (!currentUser) { openLoginModal('user'); return; }
    import('./account.js').then(({ toggleWishlist, updateWishlistButtons }) => {
        toggleWishlist(currentModalBook);
        updateWishlistButtons();
    });
});

// Account modal close
document.getElementById('accountModalClose')?.addEventListener('click', () => {
    import('./account.js').then(({ closeAccountDashboard }) => closeAccountDashboard());
});

// Account
document.querySelectorAll('.acc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        import('./account.js').then(({ switchAccTab }) => switchAccTab(tab.dataset.tab));
    });
});

document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('profileMsg');
    const name  = document.getElementById('profileDisplayName')?.value.trim();
    if (!name) { _accMsg(msgEl,'Please enter a display name.','error'); return; }
    try {
        const { updateDisplayName } = await import('./account.js');
        await updateDisplayName(name);
        document.getElementById('accHeaderName').textContent = name;
        document.getElementById('accAvatarInitial').textContent = name.charAt(0).toUpperCase();
        _accMsg(msgEl,'Name updated successfully!','success');
    } catch(err) { _accMsg(msgEl, err.message, 'error'); }
});

document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('profileMsg');
    const pw1 = document.getElementById('profileNewPw')?.value;
    const pw2 = document.getElementById('profileConfirmPw')?.value;
    if (!pw1||pw1.length<6) { _accMsg(msgEl,'Password must be at least 6 characters.','error'); return; }
    if (pw1 !== pw2)         { _accMsg(msgEl,'Passwords do not match.','error'); return; }
    try {
        const { updateUserPassword } = await import('./account.js');
        await updateUserPassword(pw1);
        document.getElementById('profileNewPw').value = '';
        document.getElementById('profileConfirmPw').value = '';
        _accMsg(msgEl,'Password changed successfully!','success');
    } catch(err) { _accMsg(msgEl, err.message, 'error'); }
});

document.getElementById('addAddressBtn')?.addEventListener('click', () => {
    document.getElementById('addAddressForm')?.classList.toggle('visible');
});
document.getElementById('cancelAddressBtn')?.addEventListener('click', () => {
    document.getElementById('addAddressForm')?.classList.remove('visible');
});
document.getElementById('saveAddressBtn')?.addEventListener('click', async () => {
    const g = id => document.getElementById(id)?.value.trim();
    const addr = { firstName:g('addrFirstName'), lastName:g('addrLastName'),
        address:g('addrStreet'), city:g('addrCity'), province:g('addrProvince'),
        postal:g('addrPostal'), country:g('addrCountry')||'CA' };
    const msgEl = document.getElementById('addAddressMsg');
    if (!addr.firstName||!addr.address||!addr.city||!addr.postal) {
        _accMsg(msgEl,'Please fill in all required fields.','error'); return;
    }
    const { addSavedAddress, switchAccTab } = await import('./account.js');
    addSavedAddress(addr);
    document.getElementById('addAddressForm')?.classList.remove('visible');
    ['addrFirstName','addrLastName','addrStreet','addrCity','addrProvince','addrPostal']
        .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    switchAccTab('addresses');
});

document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-wishlist-bookid]');
    if (!btn) return;
    e.stopPropagation();
    if (!currentUser) { openLoginModal('user'); return; }
    const bookId = btn.dataset.wishlistBookid;
    import('./data.js').then(({ books }) => {
        const book = books.find(b => b.id === bookId);
        if (!book) return;
        import('./account.js').then(({ toggleWishlist }) => {
            toggleWishlist(book);
        });
    });
});

function _accMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className   = 'acc-msg' + (type ? ' ' + type : '');
}

window.addEventListener('openAccountDashboard', () => {
    import('./account.js').then(({ openAccountDashboard }) => openAccountDashboard());
});

window.addEventListener('openPasswordRecovery', () => {
    import('./account.js').then(({ openAccountDashboard, switchAccTab }) => {
        openAccountDashboard().then(() => {
            switchAccTab('profile');
            const pwSection = document.getElementById('profileNewPw');
            if (pwSection) {
                pwSection.focus();
                pwSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const msgEl = document.getElementById('profileMsg');
            if (msgEl) {
                msgEl.textContent = 'Please enter your new password below.';
                msgEl.className = 'acc-msg success';
            }
        });
    });
});

document.body.addEventListener('click', (e) => {
    const avatarBtn = e.target.closest('.user-avatar-btn');
    if (avatarBtn && avatarBtn.id === 'userNameBtn') {
        e.preventDefault();
        import('./auth.js').then(({ currentUser }) => {
            import('./account.js').then(({ openAccountDashboard }) => {
                openAccountDashboard(currentUser);
            });
        });
    }
});

// ---------- Initialization ----------
async function init() {
    loadCart();
    await initAuth();
    await Promise.all([loadBooks(), loadNews(), loadReviews()]);
    initQuillEditors();
    bindInactivityEvents();
    translateUI(currentLang);
    checkHashForReview();
    handleRoute();
    updateAdminToggleVisibility();
    updateAdminNavLink();

    const redirect = sessionStorage.redirect;
    if (redirect) {
        sessionStorage.removeItem('redirect');
        history.replaceState(null, '', redirect);
        await handleRoute();
        updateAdminToggleVisibility();
        updateAdminNavLink();
    }
}

init();

// Fix for session persistence after leaving page (bfcache)
window.addEventListener('pageshow', async (e) => {
    if (e.persisted) {
        await import('./auth.js').then(async ({ initAuth, currentUser: newUser }) => {
            await initAuth();  // re-sync session
            // Force UI update
            const { updateUserUI } = await import('./auth.js');
            await updateUserUI();
            // Re-render current page content
            const mainContent = document.getElementById('mainContent');
            const booksPage = document.getElementById('booksPage');
            const detailPage = document.getElementById('bookDetailPage');
            const newsListPage = document.getElementById('newsListPage');
            const newsDetailPage = document.getElementById('newsDetailPage');
            if (mainContent.style.display === 'block') {
                await renderBooks();
                await renderNews();
            } else if (booksPage.style.display === 'block') {
                await renderAllBooks();
            } else if (detailPage.style.display === 'block' && window.currentModalBook) {
                renderBookDetail(window.currentModalBook);
            } else if (newsListPage.style.display === 'block') {
                await renderAllNews();
            } else if (newsDetailPage.style.display === 'block' && window.currentNewsItem) {
                renderNewsDetail(window.currentNewsItem);
            }
        });
    }
});