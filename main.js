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
   ✅ 修复 3: Newsletter 功能 - Modal版本
   ============================================ */

const newsletterLink = document.getElementById('newsletterLink');

/**
 * 创建或获取 Newsletter Modal
 */
function getOrCreateNewsletterModal() {
    let modal = document.getElementById('newsletterModal');
    
    if (!modal) {
        // 如果不存在，创建一个新的modal
        modal = document.createElement('div');
        modal.id = 'newsletterModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="modal-close" onclick="document.getElementById('newsletterModal').classList.remove('active'); document.getElementById('newsletterModal').style.display = 'none';">
                    <i class="fas fa-times"></i>
                </span>
                <div id="newsletterModalContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    return modal;
}

if (newsletterLink) {
    newsletterLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            // 获取最新的新闻
            const latestNews = newsItems && newsItems.length > 0 ? newsItems.slice(0, 3) : [];
            
            if (latestNews.length === 0) {
                // 如果没有新闻，显示提示
                const modal = getOrCreateNewsletterModal();
                const content = document.getElementById('newsletterModalContent');
                if (content) {
                    content.innerHTML = `
                        <h3 style="font-family: 'Lora', serif; font-size: 1.5rem; margin-bottom: 1rem; color: #ff0000;">
                            📰 Latest News & Updates
                        </h3>
                        <p style="text-align: center; color: #666; padding: 2rem 0;">
                            No news available yet. Please check back soon!
                        </p>
                        <button class="btn-primary" style="width: 100%; margin-top: 1rem;"
                                onclick="document.getElementById('newsletterModal').classList.remove('active'); document.getElementById('newsletterModal').style.display = 'none';">
                            Close
                        </button>
                    `;
                }
                modal.classList.add('active');
                modal.style.display = 'flex';
                return;
            }
            
            // 创建modal内容
            let html = `
                <h3 style="font-family: 'Lora', serif; font-size: 1.5rem; margin-bottom: 1.5rem; color: #ff0000;">
                    📰 Latest News & Updates
                </h3>
            `;
            
            latestNews.forEach((item, index) => {
                const date = new Date(item.created_at).toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const title = item.title?.en || item.title || 'Untitled';
                const summary = item.summary?.en || item.summary || 'No summary available';
                
                // 添加视觉层级
                const bgColor = index === 0 ? '#fff0f0' : '#f9f9f9';
                const borderColor = index === 0 ? '#ff0000' : '#e0e0e0';
                const isBold = index === 0 ? 'font-weight: 700;' : 'font-weight: 600;';
                
                html += `
                    <div style="
                        text-align: left;
                        margin-bottom: 1.2rem;
                        padding: 1.2rem;
                        background: ${bgColor};
                        border: 2px solid ${borderColor};
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    "
                         onmouseover="this.style.backgroundColor='#ffe6e6'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255,0,0,0.1)'"
                         onmouseout="this.style.backgroundColor='${bgColor}'; this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                         onclick="
                            document.getElementById('newsletterModal').classList.remove('active');
                            document.getElementById('newsletterModal').style.display = 'none';
                            navigateTo('/news/${item.id}');
                         ">
                        ${index === 0 ? '<div style="color: #ff0000; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.3rem;">🔴 Latest News</div>' : ''}
                        <div style="font-weight: 600; color: #ff0000; font-size: 0.8rem; margin-bottom: 0.3rem;">
                            📅 ${date}
                        </div>
                        <div style="${isBold} font-size: 1rem; margin-bottom: 0.5rem; color: #333;">
                            ${title}
                        </div>
                        <div style="color: #666; font-size: 0.9rem; line-height: 1.5;">
                            ${summary.substring(0, 120)}${summary.length > 120 ? '...' : ''}
                        </div>
                        <div style="margin-top: 0.8rem; color: #ff0000; font-size: 0.85rem; font-weight: 500;">
                            Read More →
                        </div>
                    </div>
                `;
            });
            
            // 添加查看全部新闻按钮
            html += `
                <button class="btn-primary" style="width: 100%; margin-top: 1.5rem;"
                        onclick="
                            document.getElementById('newsletterModal').classList.remove('active');
                            document.getElementById('newsletterModal').style.display = 'none';
                            navigateTo('/news');
                        ">
                    View All News & Events →
                </button>
            `;
            
            // 显示modal
            const modal = getOrCreateNewsletterModal();
            const content = document.getElementById('newsletterModalContent');
            if (content) {
                content.innerHTML = html;
            }
            modal.classList.add('active');
            modal.style.display = 'flex';
            
        } catch (err) {
            console.error('Error loading newsletter:', err);
            const modal = getOrCreateNewsletterModal();
            const content = document.getElementById('newsletterModalContent');
            if (content) {
                content.innerHTML = `
                    <h3 style="font-family: 'Lora', serif; font-size: 1.5rem; margin-bottom: 1rem; color: #ff0000;">
                        📰 Latest News & Updates
                    </h3>
                    <p style="text-align: center; color: #ff0000; padding: 2rem 0;">
                        Error loading news. Please try again later.
                    </p>
                    <button class="btn-primary" style="width: 100%; margin-top: 1rem;"
                            onclick="document.getElementById('newsletterModal').classList.remove('active'); document.getElementById('newsletterModal').style.display = 'none';">
                        Close
                    </button>
                `;
            }
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    });
}

// 点击modal外部关闭
document.addEventListener('click', (e) => {
    const modal = document.getElementById('newsletterModal');
    if (modal && e.target === modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
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

// About button → open contact modal
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
    window.location.href = `mailto:info@acerbooks.ca?subject=${subject}&body=${body}`;
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