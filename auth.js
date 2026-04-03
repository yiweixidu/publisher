// auth.js
import { langPack } from './i18n.js';
import { currentLang } from './i18n.js';
import { navigateTo } from './routing.js';
import { supabase } from './supabaseClient.js';
import { getUserRole } from './data.js';

// State variables
export let currentUser = null;
export let isAdminUser = false;
export let adminMode = false;
let authListener = null;

export let currentAccessToken = null;

// DOM elements
const adminSwitch = document.getElementById('adminSwitch');
const loginOverlay = document.getElementById('loginOverlay');
const loginError = document.getElementById('loginError');
const userSection = document.getElementById('userSection');

// Helper: update admin switch appearance
function updateAdminSwitch() {
    if (adminSwitch) {
        if (adminMode) {
            adminSwitch.classList.add('active');
        } else {
            adminSwitch.classList.remove('active');
        }
    }
}

// Reset login modal links to normal (user) mode
export function resetLoginModalLinks() {
    const forgotLink = document.getElementById('forgotPasswordLink');
    const signupLink = document.getElementById('goToSignupLink');
    if (forgotLink) forgotLink.style.display = 'block';
    if (signupLink) signupLink.style.display = 'block';
}

// Open login modal with specified source ('user' or 'admin')
export function openLoginModal(source = 'user') {
    const forgotLink = document.getElementById('forgotPasswordLink');
    const signupLink = document.getElementById('goToSignupLink');
    if (forgotLink && signupLink) {
        if (source === 'admin') {
            forgotLink.style.display = 'none';
            signupLink.style.display = 'none';
        } else {
            forgotLink.style.display = 'block';
            signupLink.style.display = 'block';
        }
    }
    loginOverlay?.classList.add('active');
}

// Helper: update UI based on user login state
export async function updateUserUI() {
    if (currentUser) {
        if (isAdminUser) {
            userSection.innerHTML = '';
            return;
        }
        // Get display name from profiles or use email
        let displayName = currentUser.email.split('@')[0];
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', currentUser.id)
                .single();
            if (profile?.display_name) displayName = profile.display_name;
            else if (currentUser.user_metadata?.display_name) displayName = currentUser.user_metadata.display_name;
        } catch(_) {}
        const initial = displayName.charAt(0).toUpperCase();
        userSection.innerHTML = `
            <button class="user-avatar-btn" id="userNameBtn" title="${displayName} — My Account">
                <span class="user-avatar-circle">${initial}</span>
            </button>
            <button class="logout-btn" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            logout().then(() => { window.location.href = '/'; });
        });
        document.getElementById('userNameBtn')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('openAccountDashboard'));
        });
    } else {
        userSection.innerHTML = `<button class="btn-outline-red" id="showLoginBtn">Login</button>`;
        document.getElementById('showLoginBtn')?.addEventListener('click', () => {
            openLoginModal('user');
        });
    }
}

// ---------- Authentication ----------
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        if (loginError) loginError.textContent = error.message;
        return false;
    }
    currentUser = data.user;
    currentAccessToken = data.session.access_token;
    const role = await getUserRole(currentUser.id);
    isAdminUser = (role === 'admin');
    adminMode = isAdminUser;
    updateAdminSwitch();
    updateUserUI();
    loginOverlay?.classList.remove('active');
    resetLoginModalLinks();
    window.dispatchEvent(new CustomEvent('userLogin'));
    return true;
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error(error);
    currentUser = null;
    currentAccessToken = null;
    adminMode = false;
    isAdminUser = false;
    updateAdminSwitch();
    updateUserUI();
    window.dispatchEvent(new CustomEvent('userLogout'));
    // Note: no automatic redirect here – caller decides
}

export async function signup(email, password, displayName) {
    const siteUrl = window.location.origin + '/';
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: siteUrl,
            data: { display_name: displayName, role: 'user' }
        }
    });
    if (error) throw error;
    return true;
}

export async function resetPassword(email) {
    const siteUrl = 'https://acerbooks.ca/';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl
    });
    if (error) throw error;
}

// Initialize session from Supabase
export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        currentAccessToken = session.access_token;
        const role = await getUserRole(currentUser.id);
        isAdminUser = (role === 'admin');
        adminMode = isAdminUser;
        updateAdminSwitch();
        updateUserUI();
    } else {
        currentUser = null;
        currentAccessToken = null;
        adminMode = false;
        isAdminUser = false;
        updateUserUI();
    }

    if (authListener) authListener.unsubscribe();
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            currentAccessToken = session.access_token;
            const role = await getUserRole(currentUser.id);
            isAdminUser = (role === 'admin');
            updateAdminSwitch();
            updateUserUI();
            window.dispatchEvent(new CustomEvent('userLogin'));
        } else if (event === 'PASSWORD_RECOVERY') {
            currentUser = session.user;
            currentAccessToken = session.access_token;
            updateUserUI();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openPasswordRecovery'));
            }, 400);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentAccessToken = null;
            adminMode = false;
            isAdminUser = false;
            updateAdminSwitch();
            updateUserUI();
            window.dispatchEvent(new CustomEvent('userLogout'));
        }
    });
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
        booksLink.innerText = 'MANAGE BOOKS';
        booksLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('/admin/books');
        });
        const newsLink = document.createElement('a');
        newsLink.id = 'adminManageNewsLink';
        newsLink.href = '#';
        newsLink.setAttribute('data-i18n', 'adminNavManageNews');
        newsLink.innerText = 'MANAGE NEWS';
        newsLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('/admin/news');
        });

        container.appendChild(booksLink);
        container.appendChild(newsLink);

        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon && cartIcon.parentNode === nav) {
            nav.insertBefore(container, cartIcon.nextSibling);
        } else {
            nav.appendChild(container);
        }
    }
}

// ---------- Helper to open login modal (used by admin toggle) ----------
export function openAdminLoginModal() {
    openLoginModal('admin');
}

export function closeAdminLoginModal() {
    loginOverlay?.classList.remove('active');
    resetLoginModalLinks();
}

export function toggleAdminMode() {
    if (adminMode) {
        // Turn OFF admin mode: logout and go to homepage
        logout().then(() => {
            window.location.href = '/';
        });
    } else {
        // Turn ON admin mode: if a user is logged in, logout first (without redirect),
        // then show the admin login modal.
        if (currentUser) {
            logout().then(() => {
                openAdminLoginModal();
            });
        } else {
            openAdminLoginModal();
        }
    }
}

// ---------- Inactivity timer ----------
let adminInactivityTimer = null;
let inactivityEventsBound = false;

export function bindInactivityEvents() {
    if (inactivityEventsBound) return;
    inactivityEventsBound = true;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetAdminInactivityTimer);
    });
}

function resetAdminInactivityTimer() {
    if (adminInactivityTimer) {
        clearTimeout(adminInactivityTimer);
        adminInactivityTimer = null;
    }
    if (adminMode) {
        adminInactivityTimer = setTimeout(() => {
            if (adminMode) {
                logout().then(() => {
                    alert(langPack[currentLang].adminSessionExpired);
                    window.location.href = '/';
                });
            }
        }, 300000); // 5 minutes
    }
}