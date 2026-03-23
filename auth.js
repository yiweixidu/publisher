// auth.js
import { DataService, saveUsers, users } from './data.js';
import { langPack } from './i18n.js';
import { SESSION_DURATION, ADMIN_INACTIVITY_TIMEOUT } from './constants.js';
import { currentLang } from './i18n.js'; 
import { navigateTo } from './routing.js';

const USER_STORAGE_KEY = 'acerCurrentUser';

// store user in localStorage
function saveUserToStorage(user) {
    if (user) {
        // only store necessary info to identify user, not password or sensitive data
        const userToStore = {
            id: user.id,
            username: user.username,
            displayName: user.displayName
        };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userToStore));
    } else {
        localStorage.removeItem(USER_STORAGE_KEY);
    }
}

// restore user login state from localStorage
function loadUserFromStorage() {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
        try {
            const userData = JSON.parse(stored);
            // need to verify if this user still exists in our users list (in case of deletion)
            // if you just want to keep the user logged in, you can use the stored user info,
            // but features like reviews may require the full currentUser object
            // here we simply look up the full user from the users array by id
            const fullUser = users.find(u => u.id === userData.id);
            if (fullUser) {
                currentUser = fullUser;
            } else {
                // user no longer exists, clear storage
                localStorage.removeItem(USER_STORAGE_KEY);
            }
        } catch (e) {
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    }
}

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

export function initUserSession() {
    loadUserFromStorage();
    updateUserUI();
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

// ---------- Regular User Authentication ----------
export function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        saveUserToStorage(user);
        loginOverlay?.classList.remove('active');
        updateUserUI();
        window.dispatchEvent(new CustomEvent('userLogin'));
        return true;
    } else {
        if (loginError) loginError.textContent = 'Invalid username or password';
        return false;
    }
}

export function logout() {
    currentUser = null;
    saveUserToStorage(null);
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

/**
 * Register a new user account
 * @param {string} username - Desired username
 * @param {string} displayName - Display name (optional)
 * @param {string} password - Password
 * @param {string} confirmPassword - Password confirmation
 * @returns {boolean} - True if registration successful
 */
export function signup(username, displayName, password, confirmPassword) {
    // Clear previous error
    const errorEl = document.getElementById('signupError');
    if (errorEl) errorEl.textContent = '';

    // Validation
    if (!username || !password || !confirmPassword) {
        if (errorEl) errorEl.textContent = langPack[currentLang].bothFieldsRequired || 'All fields are required.';
        return false;
    }
    if (password.length < 6) {
        if (errorEl) errorEl.textContent = langPack[currentLang].passwordTooShort || 'Password must be at least 6 characters.';
        return false;
    }
    if (password !== confirmPassword) {
        if (errorEl) errorEl.textContent = langPack[currentLang].passwordMismatch || 'Passwords do not match.';
        return false;
    }

    // Check if username already exists
    const existing = users.find(u => u.username === username);
    if (existing) {
        if (errorEl) errorEl.textContent = langPack[currentLang].usernameExists || 'Username already exists.';
        return false;
    }

    // Create new user
    const newUser = {
        id: 'u' + Date.now() + Math.random().toString(36).substr(2, 6),
        username: username,
        password: password,  // In production, this should be hashed
        displayName: displayName || username
    };

    const newUsers = [...users, newUser];
    saveUsers(newUsers);

    // Optional: auto-login after registration (uncomment if desired)
    // login(username, password);

    alert(langPack[currentLang].signupSuccess || 'Registration successful!');
    return true;
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

        // Insert the container after the cart icon
        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon && cartIcon.parentNode === nav) {
            nav.insertBefore(container, cartIcon.nextSibling);
        } else {
            nav.appendChild(container); // fallback
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