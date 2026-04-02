// account.js — User account dashboard: profile, orders, wishlist, addresses
import { currentUser } from './auth.js';
import { supabase }     from './supabaseClient.js';

// ─── Wishlist (localStorage) ─────────────────────────────────────────────────
export function getWishlist() {
    return JSON.parse(localStorage.getItem('acerWishlist') || '[]');
}

function _saveWishlist(list) {
    localStorage.setItem('acerWishlist', JSON.stringify(list));
}

export function isInWishlist(bookId) {
    return getWishlist().some(w => w.bookId === bookId);
}

/** Toggle a book in/out of the wishlist. Returns true if added, false if removed. */
export function toggleWishlist(book) {
    const list = getWishlist();
    const idx  = list.findIndex(w => w.bookId === book.id);
    if (idx >= 0) {
        list.splice(idx, 1);
        _saveWishlist(list);
        updateWishlistButtons();
        return false;
    }
    const cover = book.cover || '';
    list.push({
        bookId:    book.id,
        title:     book.title,
        title_fr:  book.title_fr  || '',
        author:    book.author,
        author_fr: book.author_fr || '',
        cover:     cover.startsWith('/') || cover.startsWith('http') ? cover : (cover ? '/' + cover : ''),
        price:     parseFloat(book.price || 0)
    });
    _saveWishlist(list);
    updateWishlistButtons();
    return true;
}

/** Sync heart-button visual state across all currently rendered cards / detail pages */
export function updateWishlistButtons() {
    const ids = new Set(getWishlist().map(w => w.bookId));
    document.querySelectorAll('[data-wishlist-bookid]').forEach(btn => {
        const active = ids.has(btn.dataset.wishlistBookid);
        btn.classList.toggle('wishlisted', active);
        btn.title = active ? 'Remove from wishlist' : 'Add to wishlist';
    });
}

// ─── Saved Addresses (localStorage) ─────────────────────────────────────────
export function getSavedAddresses() {
    return JSON.parse(localStorage.getItem('acerAddresses') || '[]');
}

export function addSavedAddress(addr) {
    const list = getSavedAddresses();
    list.push(addr);
    localStorage.setItem('acerAddresses', JSON.stringify(list));
}

export function deleteSavedAddress(idx) {
    const list = getSavedAddresses();
    list.splice(idx, 1);
    localStorage.setItem('acerAddresses', JSON.stringify(list));
}

// ─── Orders (Supabase) ──────────────────────────────────────────────────────
export async function loadUserOrders() {
    if (!currentUser) return [];
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('loadUserOrders failed:', e);
        return [];
    }
}

// ─── Profile updates ─────────────────────────────────────────────────────────
export async function updateDisplayName(displayName) {
    if (!currentUser) throw new Error('Not authenticated');
    // Auth metadata (so user_metadata.display_name is updated)
    const { error: authErr } = await supabase.auth.updateUser({
        data: { display_name: displayName }
    });
    if (authErr) throw authErr;
    // Profiles table
    const { error: profileErr } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', currentUser.id);
    if (profileErr) console.warn('profiles table update:', profileErr.message);
}

export async function updateUserPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

// ─── Dashboard open / close / tab ───────────────────────────────────────────
export function openAccountDashboard() {
    if (!currentUser) return;
    const overlay = document.getElementById('accountModal');
    if (!overlay) return;

    const name = currentUser.user_metadata?.display_name
        || currentUser.email.split('@')[0];

    _set('accAvatarInitial', el => { el.textContent = name.charAt(0).toUpperCase(); });
    _set('accHeaderName',    el => { el.textContent = name; });
    _set('accHeaderEmail',   el => { el.textContent = currentUser.email; });
    _set('profileDisplayName', el => { el.value = name; });
    _set('profileEmail',       el => { el.value = currentUser.email; });
    _set('profileMsg',         el => { el.textContent = ''; el.className = 'acc-msg'; });

    // Reset password fields
    ['profileNewPw', 'profileConfirmPw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    overlay.classList.add('active');
    switchAccTab('profile');
}

export function closeAccountDashboard() {
    document.getElementById('accountModal')?.classList.remove('active');
}

export function switchAccTab(tabName) {
    document.querySelectorAll('.acc-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tabName)
    );
    document.querySelectorAll('.acc-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('acc-' + tabName)?.classList.add('active');

    if (tabName === 'orders')    _renderOrders();
    if (tabName === 'wishlist')  renderWishlistTab();
    if (tabName === 'addresses') _renderAddresses();
}

// ─── Tab renders ─────────────────────────────────────────────────────────────
async function _renderOrders() {
    const el = document.getElementById('orderHistoryList');
    if (!el) return;
    el.innerHTML = '<p class="acc-loading"><i class="fas fa-spinner fa-spin"></i>&nbsp;Loading…</p>';
    const orders = await loadUserOrders();
    if (!orders.length) {
        el.innerHTML = '<p class="acc-empty">No orders yet. Start shopping to see your history here.</p>';
        return;
    }
    el.innerHTML = orders.map(o => {
        const date  = new Date(o.created_at).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' });
        const items = (o.items || []).map(i => `${i.title} × ${i.qty}`).join(' · ');
        const total = parseFloat(o.total || 0).toFixed(2);
        const st    = (o.status || 'pending').toLowerCase();
        return `
            <div class="order-card">
                <div class="order-card-top">
                    <span class="order-date">${date}</span>
                    <span class="order-badge order-badge--${st}">${o.status || 'Pending'}</span>
                    <span class="order-total">$${total}</span>
                </div>
                <div class="order-card-items">${items || '—'}</div>
                ${o.shipping_address
                    ? `<div class="order-card-ship"><i class="fas fa-map-marker-alt"></i> ${o.shipping_address.city}, ${o.shipping_address.province}</div>`
                    : ''}
            </div>`;
    }).join('');
}

export function renderWishlistTab() {
    const el = document.getElementById('wishlistItems');
    if (!el) return;
    const list = getWishlist();
    if (!list.length) {
        el.innerHTML = '<p class="acc-empty">Your wishlist is empty.<br>Click <i class="fas fa-heart"></i> on any book to save it here.</p>';
        return;
    }
    el.innerHTML = list.map((item, idx) => `
        <div class="wishlist-item">
            <div class="wishlist-cover"
                 style="${item.cover ? `background-image:url('${item.cover}');background-size:cover;background-position:center;` : 'background:#eee;'}">
            </div>
            <div class="wishlist-info">
                <div class="wishlist-title">${item.title}</div>
                <div class="wishlist-author">${item.author}</div>
                <div class="wishlist-price">$${item.price?.toFixed(2)}</div>
            </div>
            <button class="btn-icon wishlist-remove" data-idx="${idx}" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>`).join('');

    el.querySelectorAll('.wishlist-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const i    = parseInt(btn.dataset.idx);
            const list = getWishlist();
            list.splice(i, 1);
            _saveWishlist(list);
            renderWishlistTab();
            updateWishlistButtons();
        });
    });
}

function _renderAddresses() {
    const el = document.getElementById('savedAddressesList');
    if (!el) return;
    const list = getSavedAddresses();
    if (!list.length) {
        el.innerHTML = '<p class="acc-empty">No saved addresses yet.</p>';
        return;
    }
    el.innerHTML = list.map((a, idx) => `
        <div class="address-card">
            <div class="address-card-body">
                <strong>${a.firstName} ${a.lastName}</strong><br>
                ${a.address}<br>
                ${a.city}, ${a.province} ${a.postal}<br>
                ${a.country}
            </div>
            <button class="btn-icon address-delete" data-idx="${idx}" title="Delete">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>`).join('');

    el.querySelectorAll('.address-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteSavedAddress(parseInt(btn.dataset.idx));
            _renderAddresses();
        });
    });
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function _set(id, fn) {
    const el = document.getElementById(id);
    if (el) fn(el);
}