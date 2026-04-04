// cart.js
import { getCurrentLang } from './i18n.js';
import { currentUser, openLoginModal } from './auth.js';

// DOM elements
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartShipping = document.getElementById('cartShipping');
const cartTax = document.getElementById('cartTax');
const cartTotal = document.getElementById('cartTotal');
const cartBadge = document.querySelector('.cart-badge');

// Cart state
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

function normalizeCover(cover) {
    if (!cover) return '';
    if (cover.startsWith('http') || cover.startsWith('/') || cover.startsWith('data:')) return cover;
    return '/' + cover;
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

export function renderCartModal() {
    const currentLang = getCurrentLang();
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
        if (cartSubtotal) cartSubtotal.textContent = '$0.00';
        if (cartTax) cartTax.textContent = '$0.00';
        if (cartTotal) cartTotal.textContent = '$0.00';
        // 即使空购物车也要渲染按钮（保持界面一致）
        renderCartButtons();
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

    // 重新绑定数量/删除事件
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
}

function renderCartButtons() {
    const cartActions = document.querySelector('.cart-actions');
    if (!cartActions) return;

    const isLoggedIn = !!currentUser;
    const continueBtn = document.createElement('button');
    continueBtn.id = 'continueShoppingBtn';
    continueBtn.className = 'btn-outline-red';
    continueBtn.innerHTML = `<span>${getCurrentLang() === 'fr' ? 'Continuer vos achats' : 'Continue Shopping'}</span>`;

    let checkoutBtn;
    if (isLoggedIn) {
        checkoutBtn = document.createElement('button');
        checkoutBtn.id = 'checkoutBtn';
        checkoutBtn.className = 'btn-primary';
        checkoutBtn.innerHTML = `<i class="fas fa-lock"></i> <span>${getCurrentLang() === 'fr' ? 'Passer à la caisse' : 'Proceed to Checkout'}</span>`;
        checkoutBtn.addEventListener('click', () => {
            const event = new CustomEvent('openCheckoutFromCart');
            window.dispatchEvent(event);
        });
    } else {
        checkoutBtn = document.createElement('button');
        checkoutBtn.id = 'loginToCheckoutBtn';
        checkoutBtn.className = 'btn-primary';
        checkoutBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> <span>${getCurrentLang() === 'fr' ? 'Connectez-vous pour passer à la caisse' : 'Login to proceed to checkout'}</span>`;
        checkoutBtn.addEventListener('click', () => {
            openLoginModal('user');
        });
    }

    // 清空原有内容并添加新按钮（左边 Continue，右边 登录/结账）
    cartActions.innerHTML = '';
    cartActions.appendChild(continueBtn);
    cartActions.appendChild(checkoutBtn);

    // 重新绑定 Continue Shopping 事件（关闭购物车模态窗）
    continueBtn.addEventListener('click', () => {
        const cartModal = document.getElementById('cartModal');
        if (cartModal) cartModal.classList.remove('active');
    });
}