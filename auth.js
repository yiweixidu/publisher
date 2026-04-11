// ============================================
// auth.js
// Publisher E-commerce Platform
// ============================================
// Authors:
//   Lewei Rong            — All existing auth logic
//                           (login, logout, signup,
//                            session management, admin
//                            nav wiring, inactivity timer)
//   Ana-Laurya Lefrancois — MANAGE ORDERS nav link (Card 8)
//                           MANAGE STATIC PAGES nav link (Card 10)
// ============================================

import { langPack } from './i18n.js';
import { currentLang } from './i18n.js';
import { navigateTo } from './routing.js';
import { supabase } from './supabaseClient.js';
import { getUserRole } from './data.js';

// ============================================
// STATE
// Author: Lewei Rong
// ============================================

export let currentUser = null;
export let isAdminUser = false;
export let adminMode = false;
let authListener = null;

// Access token stored here so admin.js and data.js can use it for
// raw fetch calls that bypass the Supabase JS client RLS quirks
export let currentAccessToken = null;

// ============================================
// DOM ELEMENTS
// Author: Lewei Rong
// ============================================

const adminSwitch  = document.getElementById('adminSwitch');
const loginOverlay = document.getElementById('loginOverlay');
const loginError   = document.getElementById('loginError');
const userSection  = document.getElementById('userSection');

// ============================================
// HELPERS
// Author: Lewei Rong
// ============================================

// Toggles the admin switch visual state to match adminMode
function updateAdminSwitch() {
    if (adminSwitch) {
        if (adminMode) {
            adminSwitch.classList.add('active');
        } else {
            adminSwitch.classList.remove('active');
        }
    }
}

// Restores forgot password and signup links to visible — called after admin login modal closes
export function resetLoginModalLinks() {
    const forgotLink  = document.getElementById('forgotPasswordLink');
    const signupLink  = document.getElementById('goToSignupLink');
    if (forgotLink) forgotLink.style.display = 'block';
    if (signupLink) signupLink.style.display = 'block';
}

// Opens login modal — hides forgot/signup links when source is 'admin'
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

// ============================================
// USER UI
// Author: Lewei Rong
// Renders the user section in the navbar based on login state
// ============================================

export async function updateUserUI() {
    if (currentUser) {
        if (isAdminUser) {
            userSection.innerHTML = '';
            return;
        }
        // Resolve display name — profiles table takes priority over metadata
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

// ============================================
// AUTHENTICATION
// Author: Lewei Rong
// ============================================

// Signs in with email/password — sets user, role, and admin mode
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

// Signs out and resets all auth state — caller decides where to redirect
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
}

// Creates a new user account with display name stored in metadata
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

// Sends a password reset email — redirects to acerbooks.ca after reset
export async function resetPassword(email) {
    const siteUrl = 'https://acerbooks.ca/';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl
    });
    if (error) throw error;
}

// ============================================
// SESSION INIT
// Author: Lewei Rong
// Restores session on page load and binds Supabase auth state listener
// ============================================

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

    // Unsubscribe stale listener before re-binding — prevents duplicate handlers
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
            // Delay dispatch so account modal has time to open
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

// ============================================
// ADMIN NAV LINK WIRING
// Author: Lewei Rong
// Ana-Laurya Lefrancois added MANAGE ORDERS binding (Card 8)
// Ana-Laurya Lefrancois added MANAGE STATIC PAGES binding (Card 10)
// ============================================

// Shows admin nav links when in admin mode, hides them otherwise.
// Uses cloneNode to remove stale listeners before re-binding each button.
export function updateAdminNavLink() {
    const nav               = document.getElementById('navLinks');
    const adminNavContainer = document.getElementById('adminNavContainer');
    if (!nav || !adminNavContainer) return;

    if (adminMode) {
        nav.classList.add('admin-nav-active');
        adminNavContainer.style.display = 'flex';

        // MANAGE BOOKS
        const booksLink = document.getElementById('adminManageBooksLink');
        if (booksLink) {
            booksLink.replaceWith(booksLink.cloneNode(true));
            document.getElementById('adminManageBooksLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/books');
            });
        }

        // MANAGE NEWS
        const newsLink = document.getElementById('adminManageNewsLink');
        if (newsLink) {
            newsLink.replaceWith(newsLink.cloneNode(true));
            document.getElementById('adminManageNewsLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/news');
            });
        }

        // MANAGE USERS
        const usersLink = document.getElementById('adminManageUsersLink');
        if (usersLink) {
            usersLink.replaceWith(usersLink.cloneNode(true));
            document.getElementById('adminManageUsersLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/users');
            });
        }

        // MANAGE COMMENTS
        const commentsLink = document.getElementById('adminManageCommentsLink');
        if (commentsLink) {
            commentsLink.replaceWith(commentsLink.cloneNode(true));
            document.getElementById('adminManageCommentsLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/comments');
            });
        }

        // MANAGE ORDERS — Ana-Laurya Lefrancois (Card 8)
        // Same clone + rebind pattern as all other admin nav links above
        const ordersLink = document.getElementById('adminManageOrdersLink');
        if (ordersLink) {
            ordersLink.replaceWith(ordersLink.cloneNode(true));
            document.getElementById('adminManageOrdersLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/orders');
            });
        }

        // MANAGE STATIC PAGES — Ana-Laurya Lefrancois (Card 10)
        // Same clone + rebind pattern as all other admin nav links above
        const staticPagesLink = document.getElementById('adminManageStaticPagesLink');
        if (staticPagesLink) {
            staticPagesLink.replaceWith(staticPagesLink.cloneNode(true));
            document.getElementById('adminManageStaticPagesLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('/admin/static-pages');
            });
        }

        // LOGOUT
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.replaceWith(logoutBtn.cloneNode(true));
            document.getElementById('adminLogoutBtn')?.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAdminMode();
            });
        }

    } else {
        // Regular user mode — hide admin nav, show user nav
        nav.classList.remove('admin-nav-active');
        adminNavContainer.style.display = 'none';
    }
}

// ============================================
// ADMIN MODE TOGGLE
// Author: Lewei Rong
// ============================================

export function openAdminLoginModal() {
    openLoginModal('admin');
}

export function closeAdminLoginModal() {
    loginOverlay?.classList.remove('active');
    resetLoginModalLinks();
}

// Toggles admin mode on/off — logs out first in all cases for clean state
export function toggleAdminMode() {
    if (adminMode) {
        // Turn OFF — logout and go to homepage
        logout().then(() => {
            window.location.href = '/';
        });
    } else {
        // Turn ON — logout any existing user session first, then show admin login
        if (currentUser) {
            logout().then(() => {
                openAdminLoginModal();
            });
        } else {
            openAdminLoginModal();
        }
    }
}

// ============================================
// INACTIVITY TIMER
// Author: Lewei Rong
// Auto-logs out admin after 5 minutes of inactivity
// ============================================

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

// Resets the inactivity timer on every user interaction — only active in admin mode
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
