// cart.js
import { getCurrentLang } from './i18n.js';
import { currentUser, openLoginModal } from './auth.js';
import { books, loadBooks } from './data.js';
import { normalizeCover } from './utils.js';

// DOM elements
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartShipping = document.getElementById('cartShipping');
const cartTax = document.getElementById('cartTax');
const cartTotal = document.getElementById('cartTotal');
const cartBadge = document.querySelector('.cart-badge');

export let cart = [];

export function loadCart() {
    const storedCart = localStorage.getItem('acerCart');
    cart = storedCart ? JSON.parse(storedCart) : [];
    updateCartBadge();
}

export function saveCart() {
    localStorage.setItem('acerCart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    if (cartBadge) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = totalItems;
    }
}

export function addToCart(book, format = 'paperback') {
    const price = (format === 'hardcover' && book.price_hardcover)
        ? parseFloat(book.price_hardcover)
        : parseFloat(book.price);
    const existingItem = cart.find(item => item.bookId === book.id && item.format === format);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            bookId: book.id,
            title: book.title,
            title_fr: book.title_fr,
            author: book.author,
            author_fr: book.author_fr,
            price: price,
            price_paperback: parseFloat(book.price),
            price_hardcover: book.price_hardcover ? parseFloat(book.price_hardcover) : null,
            cover: normalizeCover(book.cover),
            quantity: 1,
            format: format
        });
    }
    saveCart();
}

function getWishlist() {
    return JSON.parse(localStorage.getItem('acerWishlist') || '[]');
}

async function getBookById(bookId) {
    if (!books.length) await loadBooks();
    return books.find(b => b.id === bookId);
}

async function renderWishlistSection() {
    const wishlistContainer = document.getElementById('cartWishlistContainer');
    if (!wishlistContainer) return;

    const wishlist = getWishlist();
    if (!wishlist.length) {
        wishlistContainer.innerHTML = '<p class="wishlist-empty">Your wishlist is empty. Click <i class="fas fa-heart"></i> on any book to save it here.</p>';
        return;
    }

    const lang = getCurrentLang();
    let html = '<div class="cart-wishlist-grid">';
    for (const item of wishlist) {
        const book = await getBookById(item.bookId);
        if (!book) continue;
        const displayTitle = (lang === 'fr' && book.title_fr) ? book.title_fr : book.title;
        const displayAuthor = (lang === 'fr' && book.author_fr) ? book.author_fr : book.author;
        const cover = normalizeCover(book.cover);
        const price = parseFloat(book.price || 0).toFixed(2);
        const hasHardcover = !!book.price_hardcover;

        html += `
            <div class="cart-wishlist-item" data-book-id="${book.id}">
                <div class="cart-wishlist-cover" style="background-image: url('${cover}');"></div>
                <div class="cart-wishlist-info">
                    <div class="cart-wishlist-title">${displayTitle}</div>
                    <div class="cart-wishlist-author">${displayAuthor}</div>
                    <div class="cart-wishlist-price">$${price}</div>
                    ${hasHardcover ? `<div class="cart-wishlist-format">
                        <button class="fmt-wishlist-btn active" data-fmt="paperback">PB</button>
                        <span class="fmt-sep">|</span>
                        <button class="fmt-wishlist-btn" data-fmt="hardcover">HC</button>
                    </div>` : ''}
                </div>
                <button class="cart-wishlist-add btn-sm" data-book-id="${book.id}">Add to Cart</button>
            </div>
        `;
    }
    html += '</div>';
    wishlistContainer.innerHTML = html;

    wishlistContainer.querySelectorAll('.fmt-wishlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parent = btn.closest('.cart-wishlist-item');
            const bookId = parent.dataset.bookId;
            const fmt = btn.dataset.fmt;
            parent.querySelectorAll('.fmt-wishlist-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            parent.dataset.selectedFormat = fmt;
        });
    });

    wishlistContainer.querySelectorAll('.cart-wishlist-add').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const bookId = btn.dataset.bookId;
            const book = await getBookById(bookId);
            if (!book) return;
            const parent = btn.closest('.cart-wishlist-item');
            const selectedFormat = parent?.dataset.selectedFormat || 'paperback';
            addToCart(book, selectedFormat);
            alert(`${book.title} added to cart!`);
            renderCartModal();
        });
    });
}

export async function renderCartModal() {
    const currentLang = getCurrentLang();
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
        if (cartSubtotal) cartSubtotal.textContent = '$0.00';
        if (cartTax) cartTax.textContent = '$0.00';
        if (cartTotal) cartTotal.textContent = '$0.00';
        renderCartButtons();
        await renderWishlistSection();
        return;
    }

    let html = '';
    cart.forEach((item, index) => {
        const displayTitle = (currentLang === 'fr' && item.title_fr) ? item.title_fr : item.title;
        const displayAuthor = (currentLang === 'fr' && item.author_fr) ? item.author_fr : item.author;
        const fmtLabel = item.format === 'hardcover' ? ' <span class="cart-fmt-badge">HC</span>' : ' <span class="cart-fmt-badge">PB</span>';
        html += `
            <div class="cart-item" data-index="${index}">
                <div class="cart-item-cover" style="background-image: url('${item.cover || ''}');"></div>
                <div class="cart-item-details">
                    <div class="cart-item-title">${displayTitle}${fmtLabel}</div>
                    <div class="cart-item-author">${displayAuthor}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                </div>
                <div class="cart-item-quantity">
                    <input type="number" min="1" value="${item.quantity}" class="cart-quantity-input" data-index="${index}">
                </div>
                <button class="cart-item-remove" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    });
    cartItemsContainer.innerHTML = html;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = 5.00;
    const tax = subtotal * 0.10;
    const total = subtotal + shipping + tax;

    if (cartSubtotal) cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    if (cartShipping) cartShipping.textContent = `$${shipping.toFixed(2)}`;
    if (cartTax) cartTax.textContent = `$${tax.toFixed(2)}`;
    if (cartTotal) cartTotal.textContent = `$${total.toFixed(2)}`;

    document.querySelectorAll('.cart-quantity-input').forEach(input => {
        input.addEventListener('change', function(e) {
            const index = this.dataset.index;
            let newQty = parseInt(this.value);
            if (isNaN(newQty) || newQty < 1) newQty = 1;
            cart[index].quantity = newQty;
            saveCart();
            renderCartModal();
        });
    });

    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const index = this.dataset.index;
            cart.splice(index, 1);
            saveCart();
            renderCartModal();
        });
    });

    renderCartButtons();
    await renderWishlistSection();
}

function renderCartButtons() {
    const cartActions = document.querySelector('.cart-actions');
    if (!cartActions) return;

    const isLoggedIn = !!currentUser;
    const lang = getCurrentLang();
    const continueText = lang === 'fr' ? 'Continuer vos achats' : 'Continue Shopping';

    const continueBtn = document.createElement('button');
    continueBtn.id = 'continueShoppingBtn';
    continueBtn.className = 'btn-outline-red';
    continueBtn.innerHTML = `<span>${continueText}</span>`;
    continueBtn.addEventListener('click', () => {
        const cartModal = document.getElementById('cartModal');
        if (cartModal) cartModal.classList.remove('active');
    });

    let rightBtn;
    if (isLoggedIn) {
        rightBtn = document.createElement('button');
        rightBtn.id = 'checkoutBtn';
        rightBtn.className = 'btn-primary';
        rightBtn.innerHTML = `<i class="fas fa-lock"></i> <span>${lang === 'fr' ? 'Passer à la caisse' : 'Proceed to Checkout'}</span>`;
        rightBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('openCheckoutFromCart'));
        });
    } else {
        rightBtn = document.createElement('button');
        rightBtn.id = 'loginToCheckoutBtn';
        rightBtn.className = 'btn-primary';
        rightBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> <span>${lang === 'fr' ? 'Connectez-vous pour passer à la caisse' : 'Login to Proceed to Checkout'}</span>`;
        rightBtn.addEventListener('click', () => {
            openLoginModal('user');
        });
    }

    cartActions.innerHTML = '';
    cartActions.appendChild(continueBtn);
    cartActions.appendChild(rightBtn);
}