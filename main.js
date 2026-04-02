// main.js
import { BASE_PATH } from './constants.js';
import { 
    setLanguage, renderBooks, renderAllBooks, renderNews, renderAllNews, renderNewsDetail,
    renderBookDetail, updateDetailLanguage, openModal, closeModal, translateUI, resetMetaTags, 
    updateMetaTags, currentModalBook, currentNewsItem, resetBooksPageState
} from './ui.js';
import { langPack, currentLang } from './i18n.js';
import { 
    adminMode, currentUser, logout, updateUserUI, bindInactivityEvents, openAdminLoginModal,
    updateAdminNavLink, login, signup, initAuth, isAdminUser
} from './auth.js';
import { cart, loadCart, saveCart, addToCart, renderCartModal } from './cart.js';
import { 
    showAdminBooksPage, hideAdminBooksPage, renderAdminBookList, openBookFormModal, initQuillEditors,
    setAdminSearchTerm, setAdminSortBy, showAdminNewsPage, hideAdminNewsPage, attachAdminNewsEvents 
} from './admin.js';
import { renderReviews, renderDetailReviews, checkHashForReview } from './review.js';
import { navigateTo, handleRoute } from './routing.js';
import { loadBooks, loadNews, loadReviews } from './data.js';

// DOM elements (same as original, but we'll keep the selectors)
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
const paymentForm = document.getElementById('paymentForm');
const paymentError = document.getElementById('paymentError');
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
const formModalClose = document.getElementById('bookFormModalClose');
const cancelFormBtn = document.getElementById('cancelFormBtn');
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

// Admin toggle: now simply shows login modal if not admin, else logs out
adminSwitch?.addEventListener('click', () => {
    import('./auth.js').then(({ toggleAdminMode }) => toggleAdminMode());
});

// Admin login modal is no longer separate – we reuse the regular login modal
// So we just open the regular login modal when admin toggle is clicked while not logged in.
// The adminLoginBtn and adminLoginOverlay can be removed or repurposed; we'll keep them but disable.
adminLoginBtn?.addEventListener('click', () => { /* no-op */ });
adminLoginClose?.addEventListener('click', () => { /* no-op */ });
adminLoginOverlay?.addEventListener('click', () => { /* no-op */ });

// Regular login – updated to use email instead of username
loginBtn?.addEventListener('click', async () => {
    const email = document.getElementById('loginUsername')?.value; // field reused for email
    const password = document.getElementById('loginPassword')?.value;
    const success = await login(email, password);
    if (!success) {
        // error already displayed in loginError
    }
});

loginClose?.addEventListener('click', () => {
    loginOverlay?.classList.remove('active');
    document.getElementById('loginError').textContent = '';
});

loginOverlay?.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
        loginOverlay.classList.remove('active');
        document.getElementById('loginError').textContent = '';
    }
});

// Signup
goToSignupLink?.addEventListener('click', (e) => {
    e.preventDefault();
    loginOverlay?.classList.remove('active');
    signupOverlay?.classList.add('active');
});

goToLoginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    signupOverlay?.classList.remove('active');
    loginOverlay?.classList.add('active');
});

signupClose?.addEventListener('click', () => {
    signupOverlay?.classList.remove('active');
    document.getElementById('signupError').textContent = '';
});

signupOverlay?.addEventListener('click', (e) => {
    if (e.target === signupOverlay) {
        signupOverlay.classList.remove('active');
        document.getElementById('signupError').textContent = '';
    }
});

signupBtn?.addEventListener('click', async () => {
    const email = document.getElementById('signupUsername').value.trim(); // email
    const displayName = document.getElementById('signupDisplayName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirmPassword').value;

    if (!email || !password || !confirm) {
        document.getElementById('signupError').textContent = langPack[currentLang].bothFieldsRequired;
        return;
    }
    if (password.length < 6) {
        document.getElementById('signupError').textContent = langPack[currentLang].passwordTooShort;
        return;
    }
    if (password !== confirm) {
        document.getElementById('signupError').textContent = langPack[currentLang].passwordMismatch;
        return;
    }

    try {
        await signup(email, password, displayName);
        alert(langPack[currentLang].signupSuccess);
        signupOverlay.classList.remove('active');
        loginOverlay.classList.add('active');
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupDisplayName').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupConfirmPassword').value = '';
        document.getElementById('signupError').textContent = '';
    } catch (err) {
        document.getElementById('signupError').textContent = err.message;
    }
});

// Language switch
langEn?.addEventListener('click', (e) => { e.preventDefault(); setLanguage('en'); });
langFr?.addEventListener('click', (e) => { e.preventDefault(); setLanguage('fr'); });

// Cart
cartIcon?.addEventListener('click', () => {
    if (cartModal) {
        renderCartModal();
        cartModal.classList.add('active');
    } else {
        alert('Cart is not available.');
    }
});
cartModalClose?.addEventListener('click', () => cartModal?.classList.remove('active'));
cartModal?.addEventListener('click', (e) => {
    if (e.target === cartModal) cartModal.classList.remove('active');
});
continueShoppingBtn?.addEventListener('click', () => cartModal?.classList.remove('active'));

// Checkout
checkoutBtn?.addEventListener('click', () => {
    if (cart.length === 0) {
        alert(langPack[currentLang].emptyCart);
        return;
    }
    if (!currentUser) {
        loginOverlay?.classList.add('active');
        return;
    }
    cartModal?.classList.remove('active');
    checkoutModal?.classList.add('active');
});
checkoutModalClose?.addEventListener('click', () => {
    checkoutModal?.classList.remove('active');
    if (paymentError) paymentError.textContent = '';
});
checkoutModal?.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
        checkoutModal.classList.remove('active');
        if (paymentError) paymentError.textContent = '';
    }
});

// Payment form (unchanged)
if (paymentForm) {
    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cardName = document.getElementById('cardName')?.value.trim();
        const cardNumber = document.getElementById('cardNumber')?.value.trim();
        const expiry = document.getElementById('expiry')?.value.trim();
        const cvv = document.getElementById('cvv')?.value.trim();

        if (!cardName || !cardNumber || !expiry || !cvv) {
            if (paymentError) paymentError.textContent = 'Please fill in all fields.';
            return;
        }
        if (cardNumber.replace(/\s/g, '').length < 16) {
            if (paymentError) paymentError.textContent = 'Invalid card number.';
            return;
        }

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shipping = 5.00;
        const tax = subtotal * 0.10;
        const total = subtotal + shipping + tax;
        const orderItems = cart.map(item => `${item.title} x${item.quantity}`).join('<br>');

        const orderSummaryDiv = document.getElementById('orderSummary');
        if (orderSummaryDiv) {
            orderSummaryDiv.innerHTML = `
                <p><strong>${langPack[currentLang].orderNumber}:</strong> ${Math.floor(Math.random()*1000000)}</p>
                <p><strong>${langPack[currentLang].items}:</strong><br> ${orderItems}</p>
                <p><strong>${langPack[currentLang].subtotal}:</strong> $${subtotal.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].shipping}:</strong> $${shipping.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].tax}:</strong> $${tax.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].total}:</strong> $${total.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].paymentMethod}:</strong> Visa ending in ${cardNumber.slice(-4)}</p>
            `;
        }

        cart.length = 0;
        saveCart();

        checkoutModal?.classList.remove('active');
        confirmationModal?.classList.add('active');
        if (paymentError) paymentError.textContent = '';
        paymentForm.reset();
    });
}

// Confirmation modal
confirmationModalClose?.addEventListener('click', () => confirmationModal?.classList.remove('active'));
confirmationModal?.addEventListener('click', (e) => {
    if (e.target === confirmationModal) confirmationModal.classList.remove('active');
});
continueShoppingConfirmBtn?.addEventListener('click', () => confirmationModal?.classList.remove('active'));
printReceiptBtn?.addEventListener('click', () => {
    const orderSummary = document.getElementById('orderSummary').innerHTML;
    const printWindow = window.open('', '_blank');
    const titleText = currentLang === 'fr' ? 'Merci pour votre commande !' : 'Thank You for Your Order!';
    const footerText = currentLang === 'fr' ? 'Acer Books · Montréal' : 'Acer Books · Montreal';
    printWindow.document.write(`
        <html>
        <head>
            <title>${currentLang === 'fr' ? 'Reçu de commande' : 'Order Receipt'}</title>
            <style>
                body { font-family: 'Inter', sans-serif; padding: 2rem; }
                .receipt { max-width: 600px; margin: 0 auto; }
                h2 { color: #ff0000; }
                .order-summary { background: #f9f9f9; padding: 1.5rem; border-radius: 12px; }
                p { margin: 0.5rem 0; }
                .footer { margin-top: 2rem; text-align: center; color: #5a5a5a; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <h2>${titleText}</h2>
                <div class="order-summary">
                    ${orderSummary}
                </div>
                <div class="footer">${footerText}</div>
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    printWindow.document.close();
});

// Navigation links
booksViewAllLink?.addEventListener('click', (e) => { e.preventDefault(); resetBooksPageState(); navigateTo('/books'); });
newsMoreLink?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('/news'); });
backToHomeFromNews?.addEventListener('click', () => navigateTo('/'));
backToNewsList?.addEventListener('click', () => navigateTo('/news'));
backToHomeFromBooks?.addEventListener('click', () => navigateTo('/'));
backToBooks?.addEventListener('click', () => navigateTo('/books'));
viewLink?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('/books'); });

// Admin management
addNewBookBtn?.addEventListener('click', () => openBookFormModal());
searchInput?.addEventListener('input', (e) => setAdminSearchTerm(e.target.value));
sortSelect?.addEventListener('change', (e) => setAdminSortBy(e.target.value));
backToHomeFromAdmin?.addEventListener('click', () => {
    hideAdminBooksPage();
    navigateTo('/');
});
formModalClose?.addEventListener('click', () => bookFormModal?.classList.remove('active'));
cancelFormBtn?.addEventListener('click', () => bookFormModal?.classList.remove('active'));
bookFormModal?.addEventListener('click', (e) => {
    if (e.target === bookFormModal) bookFormModal.classList.remove('active');
});

// Book modal
modalClose?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});
modalAddToCart?.addEventListener('click', () => {
    if (currentModalBook) {
        addToCart(currentModalBook);
        alert(langPack[currentLang].itemAddedToCart);
        closeModal();
    }
});
modalAddToWishList?.addEventListener('click', () => {
    alert(langPack[currentLang].addedToWishList);
});

attachAdminNewsEvents();

document.getElementById('backToHomeFromAdminNews')?.addEventListener('click', () => {
    hideAdminNewsPage();
    navigateTo('/');
});

const contactModal = document.getElementById('contactModal');
const contactModalClose = document.getElementById('contactModalClose');
const contactForm = document.getElementById('contactForm');
const contactError = document.getElementById('contactError');

document.querySelector('.about-text .btn-outline-red').addEventListener('click', (e) => {
    e.preventDefault();
    contactModal.classList.add('active');
});

contactModalClose.addEventListener('click', () => contactModal.classList.remove('active'));
contactModal.addEventListener('click', (e) => {
    if (e.target === contactModal) contactModal.classList.remove('active');
});

// ── Contact form → Formspree ──────────────────────────────────────────────
// Sign up at https://formspree.io, create a form, and replace the ID below.
// Free tier: 50 submissions / month, no backend needed.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'; // ← replace

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName  = document.getElementById('contactLastName').value.trim();
    const email     = document.getElementById('contactEmail').value.trim();
    const message   = document.getElementById('contactMessage').value.trim();
    const contactError = document.getElementById('contactError');
    const sendBtn   = contactForm.querySelector('[type="submit"]');

    if (contactError) contactError.textContent = '';

    function isValidName(name) {
        return name.length > 0 && /[\p{L}]/u.test(name);
    }
    if (!isValidName(firstName)) {
        contactError.textContent = currentLang === 'fr'
            ? 'Veuillez entrer un prénom valide.'
            : 'Please enter a valid first name.';
        return;
    }
    if (!isValidName(lastName)) {
        contactError.textContent = currentLang === 'fr'
            ? 'Veuillez entrer un nom de famille valide.'
            : 'Please enter a valid last name.';
        return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        contactError.textContent = currentLang === 'fr'
            ? 'Adresse courriel invalide.'
            : 'Invalid email address.';
        return;
    }
    if (!message) {
        contactError.textContent = currentLang === 'fr'
            ? 'Le message ne peut pas être vide.'
            : 'Message cannot be empty.';
        return;
    }

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, message,
                _subject: `Acer Books — message from ${firstName} ${lastName}` })
        });

        if (res.ok) {
            contactModal.classList.remove('active');
            contactForm.reset();
            alert(currentLang === 'fr'
                ? '✅ Message envoyé ! Nous vous répondrons sous peu.'
                : '✅ Message sent! We\'ll get back to you shortly.');
        } else {
            const data = await res.json().catch(() => ({}));
            contactError.textContent = data.error
                || (currentLang === 'fr' ? 'Erreur d\'envoi. Réessayez.' : 'Send failed. Please try again.');
        }
    } catch (_) {
        contactError.textContent = currentLang === 'fr'
            ? 'Erreur réseau. Réessayez plus tard.'
            : 'Network error. Please try again later.';
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = langPack[currentLang].send; }
    }
});

// Hamburger menu
if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('show');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('show');
        });
    });
}

// Responsive resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const mainContent = document.getElementById('mainContent');
        if (mainContent && mainContent.style.display !== 'none' && !adminMode) {
            renderBooks();
        }
    }, 150);
});

// Custom events for auth state changes
window.addEventListener('adminLogin', () => {
    // adminLogin is now triggered when user logs in with role admin
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage'); // <-- added
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');

    if (mainContent.style.display === 'block') {
        renderBooks();
        renderNews();
    } else if (booksPage.style.display === 'block') {
        renderAllBooks();
    } else if (detailPage.style.display === 'block' && currentModalBook) {
        renderBookDetail(currentModalBook);
    } else if (newsListPage.style.display === 'block') {
        renderAllNews();
    } else if (newsDetailPage.style.display === 'block' && currentNewsItem) {
        renderNewsDetail(currentNewsItem);
    } else if (adminBooksPage.style.display === 'block') {
        renderAdminBookList();
    }
    updateAdminToggleVisibility();
});

const adminToggleText = document.getElementById('adminToggleText');
adminToggleText?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) {
        logout();
    }
});

window.addEventListener('adminLogout', () => {
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage'); // <-- added
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');

    if (mainContent.style.display === 'block') {
        renderBooks();
        renderNews();
    } else if (booksPage.style.display === 'block') {
        renderAllBooks();
    } else if (detailPage.style.display === 'block' && currentModalBook) {
        renderBookDetail(currentModalBook);
    } else if (newsListPage.style.display === 'block') {
        renderAllNews();
    } else if (newsDetailPage.style.display === 'block' && currentNewsItem) {
        renderNewsDetail(currentNewsItem);
    } else if (adminBooksPage.style.display === 'block') {
        hideAdminBooksPage();
        mainContent.style.display = 'block';
        renderBooks();
        renderNews();
    }
    updateAdminToggleVisibility();
});

window.addEventListener('userLogin', () => {
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    const detailPage = document.getElementById('bookDetailPage'); // <-- added
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
    updateAdminNavLink(); // in case role changed
    updateAdminToggleVisibility();
});

window.addEventListener('userLogout', () => {
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    const detailPage = document.getElementById('bookDetailPage'); // <-- added
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
    updateAdminNavLink();
    updateAdminToggleVisibility();
});

window.addEventListener('hashReview', (e) => {
    const { book, reviewId } = e.detail;
    openModal(book);
    setTimeout(() => {
        const reviewsTab = Array.from(document.querySelectorAll('.modal-tab')).find(t => t.dataset.tab === 'reviews');
        if (reviewsTab) {
            reviewsTab.click();
        }
    }, 100);
});

window.addEventListener('routeChanged', updateAdminToggleVisibility);

window.addEventListener('popstate', handleRoute);

// ---------- Initialization ----------
async function init() {
    loadCart();
    await initAuth(); // sets up user session and auth listener
    await Promise.all([loadBooks(), loadNews(), loadReviews()]);
    initQuillEditors();
    bindInactivityEvents();
    translateUI(currentLang);
    checkHashForReview();
    handleRoute();
    updateAdminToggleVisibility();

    // Handle redirect from 404.html
    const redirect = sessionStorage.redirect;
    if (redirect) {
        sessionStorage.removeItem('redirect');
        history.replaceState(null, '', redirect);
        handleRoute();
        updateAdminToggleVisibility();
    }
}

init();