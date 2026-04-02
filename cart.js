// cart.js
import { getCurrentLang } from './i18n.js';

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

export function addToCart(book) {
    const existingItem = cart.find(item => item.bookId === book.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            bookId: book.id,
            title: book.title,
            title_fr: book.title_fr,
            author: book.author,
            author_fr: book.author_fr,
            price: parseFloat(book.price),
            cover: book.cover,
            quantity: 1
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
        return;
    }

    let html = '';
    cart.forEach((item, index) => {
        const displayTitle = (currentLang === 'fr' && item.title_fr) ? item.title_fr : item.title;
        const displayAuthor = (currentLang === 'fr' && item.author_fr) ? item.author_fr : item.author;
        html += `
            <div class="cart-item" data-index="${index}">
                <div class="cart-item-cover" style="background-image: url('${item.cover || ''}');"></div>
                <div class="cart-item-details">
                    <div class="cart-item-title">${displayTitle}</div>
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

    // Attach event listeners
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
}