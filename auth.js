// auth.js
import { langPack } from './i18n.js';
import { currentLang } from './i18n.js';
import { navigateTo } from './routing.js';
import { supabase } from '/publisher/supabaseClient.js';
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

// Helper: update UI based on user login state
export async function updateUserUI() {
    if (currentUser) {
        if (isAdminUser) {
            userSection.innerHTML = '';
            return;
        }
        // Get display name from profiles or use email
        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', currentUser.id)
            .single();
        const displayName = profile?.display_name || currentUser.email;
        userSection.innerHTML = `
            <span class="user-name">${displayName}</span>
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
    adminMode = isAdminUser; // 管理员登录后直接开启 admin 模式
    updateAdminSwitch();
    updateUserUI();
    loginOverlay?.classList.remove('active');
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
}

export async function signup(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, role: 'user' } }
    });
    if (error) throw error;
    // Profile will be created automatically by the database trigger
    return true;
}

// Initialize session from Supabase
export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        currentAccessToken = session.access_token;
        const role = await getUserRole(currentUser.id);
        isAdminUser = (role === 'admin');
        adminMode = false; // 刷新后始终关闭 admin 模式
        updateAdminSwitch();
        updateUserUI();
    } else {
        currentUser = null;
        currentAccessToken = null;
        adminMode = false;
        isAdminUser = false;
        updateUserUI();
    }

    // Listen for auth changes
    if (authListener) authListener.unsubscribe();
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            currentAccessToken = session.access_token;
            const role = await getUserRole(currentUser.id);
            isAdminUser = (role === 'admin');
            // 注意：不修改 adminMode，保留当前值（由 login 或刷新后的 false 决定）
            updateAdminSwitch();
            updateUserUI();
            window.dispatchEvent(new CustomEvent('userLogin'));
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
    loginOverlay?.classList.add('active');
}

export function closeAdminLoginModal() {
    loginOverlay?.classList.remove('active');
}

export function toggleAdminMode() {
    if (adminMode) {
        logout(); // 关闭 admin 模式：登出用户
    } else {
        // 开启 admin 模式：先确保登出（如果已登录），再弹出登录框
        if (currentUser) {
            logout();
        }
        openAdminLoginModal();
    }
}

// ---------- Inactivity timer (optional) – keep as is ----------
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
                logout();
                alert(langPack[currentLang].adminSessionExpired);
            }
        }, 300000); // 5 minutes
    }
}