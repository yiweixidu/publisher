// main.js
import { BASE_PATH } from './constants.js';
import { 
    setLanguage, renderBooks, renderAllBooks, renderNews, renderAllNews, renderNewsDetail,
    renderBookDetail, updateDetailLanguage, openModal, closeModal, translateUI, resetMetaTags, 
    updateMetaTags, currentModalBook, currentNewsItem
} from './ui.js';
import { langPack, currentLang } from './i18n.js';
import { 
    adminMode, currentUser, adminLogin, adminLogout, initAdminSession, ensureAdminSession,
    login, logout, updateUserUI, bindInactivityEvents, openAdminLoginModal, closeAdminLoginModal,
    updateAdminNavLink
} from './auth.js';
import { cart, loadCart, saveCart, addToCart, renderCartModal } from './cart.js';
import { 
    showAdminBooksPage, hideAdminBooksPage, renderAdminBookList, openBookFormModal, initQuillEditors,
    setAdminSearchTerm, setAdminSortBy, showAdminNewsPage, hideAdminNewsPage, attachAdminNewsEvents 
} from './admin.js';
import { renderReviews, renderDetailReviews, checkHashForReview } from './review.js';
import { navigateTo, handleRoute } from './routing.js';

// DOM elements for event listeners
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

// ---------- Helper: Admin Toggle Visibility ----------
function updateAdminToggleVisibility() {
    const adminToggle = document.getElementById('adminToggle');
    if (!adminToggle) return;
    let path = window.location.pathname.replace(/\/+/g, '/');
    const basePattern = new RegExp('^' + BASE_PATH.replace(/\/+$/, '') + '/?');
    const relativePath = path.replace(basePattern, '') || '/';
    if (adminMode || relativePath === 'admin') {
        adminToggle.classList.remove('hidden');
    } else {
        adminToggle.classList.add('hidden');
    }
}

// ---------- Event Listeners ----------

// Admin toggle
adminSwitch?.addEventListener('click', () => {
    if (adminMode) {
        adminLogout();
    } else {
        openAdminLoginModal();
    }
});

// Admin login modal
adminLoginBtn?.addEventListener('click', async () => {
    const pwd = document.getElementById('adminPassword').value.trim();
    const code = document.getElementById('adminTOTP').value.trim();
    if (!pwd || !code) {
        document.getElementById('adminLoginError').textContent = 'Both fields are required';
        return;
    }
    await adminLogin(pwd, code);
});
adminLoginClose?.addEventListener('click', closeAdminLoginModal);
adminLoginOverlay?.addEventListener('click', (e) => {
    if (e.target === adminLoginOverlay) closeAdminLoginModal();
});

// Regular login
loginBtn?.addEventListener('click', () => {
    login(document.getElementById('loginUsername')?.value, document.getElementById('loginPassword')?.value);
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

// Payment form
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
booksViewAllLink?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('/books'); });
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

// In initialization, after other admin events:
attachAdminNewsEvents();

// Add back button handler for admin news page
document.getElementById('backToHomeFromAdminNews')?.addEventListener('click', () => {
    hideAdminNewsPage();
    navigateTo('/');
});

const contactModal = document.getElementById('contactModal');
const contactModalClose = document.getElementById('contactModalClose');
const contactForm = document.getElementById('contactForm');
const contactError = document.getElementById('contactError');

// Open contact modal when about button is clicked
document.querySelector('.about-text .btn-outline-red').addEventListener('click', (e) => {
    e.preventDefault();
    contactModal.classList.add('active');
});

contactModalClose.addEventListener('click', () => contactModal.classList.remove('active'));
contactModal.addEventListener('click', (e) => {
    if (e.target === contactModal) contactModal.classList.remove('active');
});

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName = document.getElementById('contactLastName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const contactError = document.getElementById('contactError');

    if (contactError) contactError.textContent = '';

    function isValidName(name) {
        if (name.length === 0) return false;
        return /[\p{L}]/u.test(name);
    }

    if (!isValidName(firstName)) {
        contactError.textContent = 'Please enter a valid first name (letters only).';
        return;
    }
    if (!isValidName(lastName)) {
        contactError.textContent = 'Please enter a valid last name (letters only).';
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        contactError.textContent = 'Invalid email address.';
        return;
    }

    if (message.length === 0) {
        contactError.textContent = 'Message cannot be empty.';
        return;
    }

    const subject = 'Contact Form Submission from Acer Books';
    const body = `First Name: ${firstName}\nLast Name: ${lastName}\nEmail: ${email}\nMessage:\n${message}`;
    const mailtoLink = `mailto:yiweixidu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoLink;
    contactModal.classList.remove('active');
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
    // Re-render current page based on visibility
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage');
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
    updateAdminToggleVisibility(); // added
});

window.addEventListener('adminLogout', () => {
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage');
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
    updateAdminToggleVisibility(); // added
});

window.addEventListener('userLogin', () => {
    // Refresh reviews if modal or detail open
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
});

window.addEventListener('userLogout', () => {
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
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

// Listen for route changes
window.addEventListener('routeChanged', updateAdminToggleVisibility);

// 移除旧的 adminNavBooks/adminNavNews 事件监听，因为现在通过路由导航

window.addEventListener('popstate', handleRoute);

// ---------- Initialization ----------
loadCart();
initAdminSession();
initQuillEditors();
bindInactivityEvents();
translateUI(currentLang);
checkHashForReview();
// We need to call handleRoute after everything is set
handleRoute();
updateAdminToggleVisibility(); // initial call

// Handle redirect from 404.html
(function() {
    const redirect = sessionStorage.redirect;
    if (redirect) {
        sessionStorage.removeItem('redirect');
        history.replaceState(null, '', redirect);
        handleRoute();
        updateAdminToggleVisibility(); // after redirect
    }
})();