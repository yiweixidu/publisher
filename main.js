// main.js (complete with fixes)
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
import { loadBooks, loadNews, loadReviews } from './data.js';

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

// Admin toggle
adminSwitch?.addEventListener('click', () => {
    import('./auth.js').then(({ toggleAdminMode }) => toggleAdminMode());
});

adminLoginBtn?.addEventListener('click', () => { /* no-op */ });
adminLoginClose?.addEventListener('click', () => { /* no-op */ });
adminLoginOverlay?.addEventListener('click', () => { /* no-op */ });

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
        if(msgEl){msgEl.textContent='Reset link sent! Check your inbox.'; msgEl.className='acc-msg success';}
    } catch (err) {
        if(msgEl){msgEl.textContent=err.message; msgEl.className='login-error';}
    }
});

function closeLoginModalAndReset() {
    loginOverlay?.classList.remove('active');
    resetLoginModalLinks();
    document.getElementById('loginError').textContent = '';
}
loginClose?.addEventListener('click', closeLoginModalAndReset);
loginOverlay?.addEventListener('click', (e) => {
    if (e.target === loginOverlay) closeLoginModalAndReset();
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
    openLoginModal('user');
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
    const email = document.getElementById('signupUsername').value.trim();
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
        openLoginModal('user');
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupDisplayName').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupConfirmPassword').value = '';
        document.getElementById('signupError').textContent = '';
    } catch (err) {
        document.getElementById('signupError').textContent = err.message;
    }
});

// Language
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

// Multi-Step Checkout (unchanged from original)
const SHIPPING_COSTS = { standard: 5.00, express: 15.00, pickup: 0.00 };
let coStep = 1;
let coShipData = {};
let coShipMethod = 'standard';
let coPayMethod  = 'card';

function goToCoStep(n) {
    coStep = n;
    document.querySelectorAll('.co-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`coStep${n}`)?.classList.remove('hidden');
    document.querySelectorAll('.co-step-dot').forEach(dot => {
        const s = parseInt(dot.dataset.step);
        dot.classList.toggle('active',    s === n);
        dot.classList.toggle('completed', s < n);
    });
}

function openCheckout() {
    coStep = 1;
    coShipMethod = 'standard';
    coPayMethod  = 'card';
    if (currentUser) {
        const emailEl = document.getElementById('shipEmail');
        if (emailEl && !emailEl.value) emailEl.value = currentUser.email;
    }
    goToCoStep(1);
    checkoutModal?.classList.add('active');
}

function closeCheckout() {
    checkoutModal?.classList.remove('active');
    document.getElementById('paymentError') && (document.getElementById('paymentError').textContent = '');
}

checkoutBtn?.addEventListener('click', () => {
    if (cart.length === 0) { alert(langPack[currentLang].emptyCart); return; }
    if (!currentUser) { openLoginModal('user'); return; }
    cartModal?.classList.remove('active');
    openCheckout();
});
checkoutModalClose?.addEventListener('click', closeCheckout);
checkoutModal?.addEventListener('click', e => { if (e.target === checkoutModal) closeCheckout(); });

document.getElementById('coNext1')?.addEventListener('click', () => {
    const fields = ['shipFirstName','shipLastName','shipEmail','shipAddress','shipCity','shipProvince','shipPostal'];
    const errEl  = document.getElementById('coErr1');
    for (const id of fields) {
        const el = document.getElementById(id);
        if (!el?.value.trim()) {
            if (errEl) errEl.textContent = currentLang === 'fr' ? 'Veuillez remplir tous les champs obligatoires.' : 'Please fill in all required fields.';
            el?.focus(); return;
        }
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(document.getElementById('shipEmail').value.trim())) {
        if (errEl) errEl.textContent = currentLang === 'fr' ? 'Adresse courriel invalide.' : 'Invalid email address.';
        return;
    }
    if (errEl) errEl.textContent = '';
    coShipData = {
        firstName: document.getElementById('shipFirstName').value.trim(),
        lastName:  document.getElementById('shipLastName').value.trim(),
        email:     document.getElementById('shipEmail').value.trim(),
        address:   document.getElementById('shipAddress').value.trim(),
        city:      document.getElementById('shipCity').value.trim(),
        province:  document.getElementById('shipProvince').value.trim(),
        postal:    document.getElementById('shipPostal').value.trim(),
        country:   document.getElementById('shipCountry').value,
    };
    goToCoStep(2);
});
document.getElementById('coBack2')?.addEventListener('click', () => goToCoStep(1));
document.getElementById('coNext2')?.addEventListener('click', () => {
    const sel = document.querySelector('input[name="shippingMethod"]:checked');
    coShipMethod = sel ? sel.value : 'standard';
    goToCoStep(3);
});
document.querySelectorAll('.pay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        coPayMethod = tab.dataset.method;
        document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('payCardPanel')?.classList.toggle('hidden', coPayMethod !== 'card');
        document.getElementById('payPaypalPanel')?.classList.toggle('hidden', coPayMethod !== 'paypal');
    });
});
document.getElementById('coBack3')?.addEventListener('click', () => goToCoStep(2));
document.getElementById('coNext3')?.addEventListener('click', () => {
    const errEl = document.getElementById('paymentError');
    if (errEl) errEl.textContent = '';
    if (coPayMethod === 'card') {
        const cardName   = document.getElementById('cardName')?.value.trim();
        const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g,'');
        const expiry     = document.getElementById('expiry')?.value.trim();
        const cvv        = document.getElementById('cvv')?.value.trim();
        if (!cardName || !cardNumber || !expiry || !cvv) {
            if (errEl) errEl.textContent = currentLang==='fr' ? 'Veuillez remplir tous les champs.' : 'Please fill in all payment fields.';
            return;
        }
        if (cardNumber.length < 16) {
            if (errEl) errEl.textContent = currentLang==='fr' ? 'Numéro de carte invalide.' : 'Invalid card number.';
            return;
        }
    }
    const subtotal = cart.reduce((s,i) => s + i.price * i.quantity, 0);
    const shipping = SHIPPING_COSTS[coShipMethod] ?? 5;
    const tax      = subtotal * 0.15;
    const total    = subtotal + shipping + tax;
    const isFr     = currentLang === 'fr';
    const shippingLabel = {
        standard: isFr ? 'Standard (5–10 jours)' : 'Standard (5–10 days)',
        express:  isFr ? 'Express (2–3 jours)'   : 'Express (2–3 days)',
        pickup:   isFr ? 'Cueillette locale'      : 'Local Pickup',
    }[coShipMethod];
    const itemsHtml = cart.map(i => {
        const t = (isFr && i.title_fr) ? i.title_fr : i.title;
        const fmt = i.format === 'hardcover' ? ' (HC)' : ' (PB)';
        return `<div class="review-item"><span>${t}${fmt} × ${i.quantity}</span><span>$${(i.price*i.quantity).toFixed(2)}</span></div>`;
    }).join('');
    const payDisplay = coPayMethod === 'paypal' ? 'PayPal'
        : `**** **** **** ${(document.getElementById('cardNumber')?.value||'').slice(-4)||'****'}`;
    document.getElementById('coReviewContent').innerHTML = `
        <div class="review-section">
            <h4>${isFr?'Adresse de livraison':'Shipping Address'}</h4>
            <p>${coShipData.firstName} ${coShipData.lastName}<br>
               ${coShipData.address}<br>${coShipData.city}, ${coShipData.province} ${coShipData.postal}<br>${coShipData.country}</p>
        </div>
        <div class="review-section">
            <h4>${isFr?'Mode de livraison':'Delivery Method'}</h4>
            <p>${shippingLabel}</p>
        </div>
        <div class="review-section">
            <h4>${isFr?'Articles':'Items'}</h4>
            ${itemsHtml}
        </div>
        <div class="review-section review-totals">
            <div class="review-item"><span>${langPack[currentLang].subtotal}</span><span>$${subtotal.toFixed(2)}</span></div>
            <div class="review-item"><span>${langPack[currentLang].shipping}</span><span>$${shipping.toFixed(2)}</span></div>
            <div class="review-item"><span>${isFr?'TPS+TVQ (15%)':'Tax (15% QC)'}</span><span>$${tax.toFixed(2)}</span></div>
            <div class="review-item total-row"><strong>${langPack[currentLang].total}</strong><strong>$${total.toFixed(2)}</strong></div>
        </div>
        <div class="review-section">
            <h4>${langPack[currentLang].paymentMethod}</h4>
            <p>${payDisplay}</p>
        </div>`;
    goToCoStep(4);
});
document.getElementById('coBack4')?.addEventListener('click', () => goToCoStep(3));
document.getElementById('coPlaceOrder')?.addEventListener('click', async () => {
    const placeBtn = document.getElementById('coPlaceOrder');
    const errEl    = document.getElementById('coReviewError');
    if (placeBtn) { placeBtn.disabled = true; placeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
        const subtotal = cart.reduce((s,i) => s + i.price * i.quantity, 0);
        const shipping = SHIPPING_COSTS[coShipMethod] ?? 5;
        const tax      = subtotal * 0.15;
        const total    = subtotal + shipping + tax;
        const orderId  = 'ord_' + Date.now() + Math.random().toString(36).substr(2,6);
        const order = {
            id: orderId,
            user_id: currentUser?.id || null,
            items: cart.map(i => ({ bookId:i.bookId, title:i.title, format:i.format, qty:i.quantity, price:i.price })),
            shipping_address: coShipData,
            shipping_method: coShipMethod,
            subtotal: parseFloat(subtotal.toFixed(2)),
            shipping_cost: shipping,
            tax: parseFloat(tax.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            payment_method: coPayMethod,
            status: 'pending',
        };
        await saveOrder(order);
        const isFr = currentLang === 'fr';
        const itemsHtml = cart.map(i => {
            const t = (isFr && i.title_fr) ? i.title_fr : i.title;
            return `${t} × ${i.quantity}`;
        }).join('<br>');
        const orderSummaryDiv = document.getElementById('orderSummary');
        if (orderSummaryDiv) {
            orderSummaryDiv.innerHTML = `
                <p><strong>${langPack[currentLang].orderNumber}:</strong> ${orderId.split('_')[1]}</p>
                <p><strong>${langPack[currentLang].items}:</strong><br>${itemsHtml}</p>
                <p><strong>${langPack[currentLang].subtotal}:</strong> $${subtotal.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].shipping}:</strong> $${shipping.toFixed(2)}</p>
                <p><strong>${isFr?'TPS+TVQ':'Tax (QC)'}:</strong> $${tax.toFixed(2)}</p>
                <p><strong>${langPack[currentLang].total}:</strong> $${total.toFixed(2)}</p>
                <p><strong>${isFr?'Livraison à':'Shipping to'}:</strong> ${coShipData.firstName} ${coShipData.lastName}, ${coShipData.city}</p>`;
        }
        cart.length = 0; saveCart();
        closeCheckout();
        confirmationModal?.classList.add('active');
    } catch (err) {
        if (errEl) errEl.textContent = err.message || (currentLang==='fr' ? 'Erreur lors de la commande.' : 'Order failed. Please try again.');
    } finally {
        if (placeBtn) { placeBtn.disabled = false; placeBtn.innerHTML = `<i class="fas fa-lock"></i> ${langPack[currentLang].placeOrder}`; }
    }
});
window.addEventListener('openCheckoutFromCart', () => {
    if (cart.length === 0) { alert(langPack[currentLang].emptyCart); return; }
    if (!currentUser) { openLoginModal('user'); return; }
    const cartModalEl = document.getElementById('cartModal');
    if (cartModalEl) cartModalEl.classList.remove('active');
    openCheckout();
});

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
            <script>window.onload = function() { window.print(); window.close(); }<\/script>
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
        addToCart(currentModalBook, currentModalFormat || 'paperback');
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
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName = document.getElementById('contactLastName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const contactErrorEl = document.getElementById('contactError');
    if (contactErrorEl) contactErrorEl.textContent = '';
    function isValidName(name) { return name.length > 0 && /[\p{L}]/u.test(name); }
    if (!isValidName(firstName)) { contactErrorEl.textContent = 'Please enter a valid first name (letters only).'; return; }
    if (!isValidName(lastName))  { contactErrorEl.textContent = 'Please enter a valid last name (letters only).'; return; }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) { contactErrorEl.textContent = 'Invalid email address.'; return; }
    if (message.length === 0) { contactErrorEl.textContent = 'Message cannot be empty.'; return; }
    const subject = 'Contact Form Submission from Acer Books';
    const body = `First Name: ${firstName}\nLast Name: ${lastName}\nEmail: ${email}\nMessage:\n${message}`;
    const mailtoLink = `mailto:yiweixidu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    contactModal.classList.remove('active');
});

// Hamburger
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

// Resize
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
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage');
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');
    if (mainContent.style.display === 'block') { renderBooks(); renderNews(); }
    else if (booksPage.style.display === 'block') { renderAllBooks(); }
    else if (detailPage.style.display === 'block' && currentModalBook) { renderBookDetail(currentModalBook); }
    else if (newsListPage.style.display === 'block') { renderAllNews(); }
    else if (newsDetailPage.style.display === 'block' && currentNewsItem) { renderNewsDetail(currentNewsItem); }
    else if (adminBooksPage.style.display === 'block') { renderAdminBookList(); }
    updateAdminToggleVisibility();
});

const adminToggleText = document.getElementById('adminToggleText');
adminToggleText?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) { logout(); }
});

window.addEventListener('adminLogout', () => {
    const mainContent = document.getElementById('mainContent');
    const booksPage = document.getElementById('booksPage');
    const detailPage = document.getElementById('bookDetailPage');
    const newsListPage = document.getElementById('newsListPage');
    const newsDetailPage = document.getElementById('newsDetailPage');
    const adminBooksPage = document.getElementById('adminBooksPage');
    if (mainContent.style.display === 'block') { renderBooks(); renderNews(); }
    else if (booksPage.style.display === 'block') { renderAllBooks(); }
    else if (detailPage.style.display === 'block' && currentModalBook) { renderBookDetail(currentModalBook); }
    else if (newsListPage.style.display === 'block') { renderAllNews(); }
    else if (newsDetailPage.style.display === 'block' && currentNewsItem) { renderNewsDetail(currentNewsItem); }
    else if (adminBooksPage.style.display === 'block') {
        hideAdminBooksPage();
        mainContent.style.display = 'block';
        renderBooks(); renderNews();
    }
    updateAdminToggleVisibility();
});

// 🔁 FIX #5: Refresh cart modal on user login so button changes
window.addEventListener('userLogin', () => {
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    const detailPage = document.getElementById('bookDetailPage');
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
    updateAdminNavLink();
    updateAdminToggleVisibility();

    // Refresh cart modal if open
    const cartModalEl = document.getElementById('cartModal');
    if (cartModalEl && cartModalEl.classList.contains('active')) {
        renderCartModal();
    }
});

window.addEventListener('userLogout', () => {
    if (modalOverlay?.classList.contains('active') && currentModalBook) {
        renderReviews(currentModalBook.id, currentLang, currentUser);
    }
    const detailPage = document.getElementById('bookDetailPage');
    if (detailPage && detailPage.style.display === 'block' && currentModalBook) {
        renderDetailReviews(currentModalBook.id, currentLang, currentUser);
    }
    updateAdminNavLink();
    updateAdminToggleVisibility();
});

// 🔁 FIX #1 & #2: Refresh wishlist UI components when wishlist changes
window.addEventListener('wishlistUpdated', () => {
    // Refresh cart modal if open
    const cartModalEl = document.getElementById('cartModal');
    if (cartModalEl && cartModalEl.classList.contains('active')) {
        renderCartModal();
    }
    // Refresh account dashboard wishlist tab if open
    const accountModal = document.getElementById('accountModal');
    if (accountModal && accountModal.classList.contains('active')) {
        const activeTab = document.querySelector('#accountModal .acc-tab.active');
        if (activeTab && activeTab.dataset.tab === 'wishlist') {
            import('./account.js').then(({ renderWishlistTab }) => renderWishlistTab());
        }
    }
});

window.addEventListener('hashReview', (e) => {
    const { book, reviewId } = e.detail;
    openModal(book);
    setTimeout(() => {
        const reviewsTab = Array.from(document.querySelectorAll('.modal-tab')).find(t => t.dataset.tab === 'reviews');
        if (reviewsTab) reviewsTab.click();
    }, 100);
});

window.addEventListener('routeChanged', updateAdminToggleVisibility);
window.addEventListener('popstate', handleRoute);

// Account Dashboard wiring
document.getElementById('accountModalClose')?.addEventListener('click', () => {
    import('./account.js').then(({ closeAccountDashboard }) => closeAccountDashboard());
});
document.getElementById('accountModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('accountModal'))
        import('./account.js').then(({ closeAccountDashboard }) => closeAccountDashboard());
});
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

    const redirect = sessionStorage.redirect;
    if (redirect) {
        sessionStorage.removeItem('redirect');
        history.replaceState(null, '', redirect);
        await handleRoute();
        updateAdminToggleVisibility();
    }
}

init();

window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        import('./auth.js').then(({ initAuth }) => initAuth());
    }
});