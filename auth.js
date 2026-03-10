// auth.js
import { DataService, saveUsers, users } from './data.js';
import { langPack } from './i18n.js';
import { SESSION_DURATION, ADMIN_INACTIVITY_TIMEOUT } from './constants.js';
import { currentLang } from './i18n.js'; 
import { navigateTo } from './routing.js'; // 新增导入

// State variables
export let adminMode = false;
export let currentUser = null;
let adminSession = null;
let adminInactivityTimer = null;
let sessionCheckInterval = null;
let inactivityEventsBound = false;

// DOM elements (will be accessed later)
const adminToggleText = document.getElementById('adminToggleText');
const adminSwitch = document.getElementById('adminSwitch');
const loginOverlay = document.getElementById('loginOverlay');
const loginError = document.getElementById('loginError');
const userSection = document.getElementById('userSection');

// Helper: update admin toggle text
function updateAdminToggleText() {
    if (adminToggleText) {
        adminToggleText.textContent = adminMode ? 'Logout' : 'Admin';
    }
}

// ---------- Admin Authentication ----------
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminPassword(password) {
    const admin = DataService.loadAdmin();
    const hash = await hashPassword(password);
    return hash === admin.passwordHash;
}

function verifyAdminTOTP(token) {
    const admin = DataService.loadAdmin();
    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(admin.totpSecret)
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

export async function adminLogin(password, token) {
    const passwordValid = await verifyAdminPassword(password);
    if (!passwordValid) {
        document.getElementById('adminLoginError').textContent = 'Invalid password';
        return false;
    }
    const totpValid = verifyAdminTOTP(token);
    if (!totpValid) {
        document.getElementById('adminLoginError').textContent = 'Invalid 2FA code';
        return false;
    }
    const expiry = Date.now() + SESSION_DURATION;
    adminSession = { token: 'admin-' + Math.random().toString(36), expiry };
    sessionStorage.setItem('adminSession', JSON.stringify(adminSession));
    adminMode = true;
    updateAdminToggleText();
    resetAdminInactivityTimer();
    adminSwitch?.classList.add('active');
    closeAdminLoginModal();
    updateAdminNavLink();
    // Trigger a custom event so main can re-render appropriate pages
    window.dispatchEvent(new CustomEvent('adminLogin'));
    return true;
}

export function adminLogout() {
    if (adminInactivityTimer) {
        clearTimeout(adminInactivityTimer);
        adminInactivityTimer = null;
    }
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    sessionStorage.removeItem('adminSession');
    adminSession = null;
    adminMode = false;
    adminSwitch?.classList.remove('active');
    updateAdminNavLink();
    updateAdminToggleText();
    // Trigger custom event for main to handle re-rendering
    window.dispatchEvent(new CustomEvent('adminLogout'));
}

export function initAdminSession() {
    const stored = sessionStorage.getItem('adminSession');
    if (stored) {
        const session = JSON.parse(stored);
        if (session.expiry > Date.now()) {
            adminSession = session;
            adminMode = true;
            updateAdminToggleText();
            adminSwitch?.classList.add('active');
            resetAdminInactivityTimer();
            updateAdminNavLink();
        } else {
            sessionStorage.removeItem('adminSession');
        }
    }

    if (sessionCheckInterval) clearInterval(sessionCheckInterval);
    sessionCheckInterval = setInterval(() => {
        if (adminSession && adminSession.expiry < Date.now()) {
            adminLogout();
            alert(langPack[currentLang].adminSessionExpired);
        }
    }, 300000);
}

export function ensureAdminSession() {
    if (!adminSession) return false;
    if (adminSession.expiry < Date.now()) {
        adminLogout();
        alert(langPack[currentLang].adminSessionExpired);
        return false;
    }
    return true;
}

function resetAdminInactivityTimer() {
    if (adminInactivityTimer) {
        clearTimeout(adminInactivityTimer);
        adminInactivityTimer = null;
    }
    if (adminMode) {
        adminInactivityTimer = setTimeout(() => {
            if (adminMode) {
                adminLogout();
                alert(langPack[currentLang].adminSessionExpired);
            }
        }, ADMIN_INACTIVITY_TIMEOUT);
    }
}

export function bindInactivityEvents() {
    if (inactivityEventsBound) return;
    inactivityEventsBound = true;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetAdminInactivityTimer);
    });
}

// ---------- Regular User Login ----------
export function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        loginOverlay?.classList.remove('active');
        updateUserUI();
        // Refresh reviews if modal or detail page open (handled by event)
        window.dispatchEvent(new CustomEvent('userLogin'));
    } else {
        if (loginError) loginError.textContent = 'Invalid username or password';
    }
}

export function logout() {
    currentUser = null;
    updateUserUI();
    window.dispatchEvent(new CustomEvent('userLogout'));
}

export function updateUserUI() {
    if (currentUser) {
        userSection.innerHTML = `
            <span class="user-name">${currentUser.displayName || currentUser.username}</span>
            <button class="logout-btn" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    } else {
        userSection.innerHTML = `<button class="btn-outline-red" id="showLoginBtn">Login</button>`;
        document.getElementById('showLoginBtn')?.addEventListener('click', () => {
            loginOverlay?.classList.add('active');
        });
    }
}

// ---------- Admin Nav Link ----------
export function updateAdminNavLink() {
    const nav = document.getElementById('navLinks');
    const existingContainer = document.getElementById('adminNavContainer');
    if (existingContainer) existingContainer.remove();
    if (adminMode) {
        const container = document.createElement('div');
        container.id = 'adminNavContainer';
        container.className = 'admin-nav-container';
        container.style.display = 'flex';
        container.style.gap = '1rem';
        container.style.alignItems = 'center';

        const booksLink = document.createElement('a');
        booksLink.id = 'adminManageBooksLink';
        booksLink.href = '#';
        booksLink.setAttribute('data-i18n', 'adminNavManageBooks');
        booksLink.innerText = 'MANAGE BOOKS'; // fallback
        booksLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('/admin/books');
        });
        const newsLink = document.createElement('a');
        newsLink.id = 'adminManageNewsLink';
        newsLink.href = '#';
        newsLink.setAttribute('data-i18n', 'adminNavManageNews');
        newsLink.innerText = 'MANAGE NEWS'; // fallback
        newsLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('/admin/news');
        });

        container.appendChild(booksLink);
        container.appendChild(newsLink);

        // 将容器插入到购物车图标之后
        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon && cartIcon.parentNode === nav) {
            nav.insertBefore(container, cartIcon.nextSibling);
        } else {
            nav.appendChild(container); // 后备方案
        }
    }
}

// ---------- Admin Login Modal ----------
export function openAdminLoginModal() {
    const modal = document.getElementById('adminLoginOverlay');
    if (modal) modal.classList.add('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminTOTP').value = '';
    document.getElementById('adminLoginError').textContent = '';
}

export function closeAdminLoginModal() {
    document.getElementById('adminLoginOverlay')?.classList.remove('active');
}