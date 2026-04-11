// ============================================
// data.js
// Publisher E-commerce Platform
// ============================================
// Authors:
//   Lewei Rong            — Books, News, Reviews,
//                           Auth Helpers
//   Ana-Laurya Lefrancois — Orders (Card 8)
//                           Order email trigger (Card 15)
// ============================================

import { supabase } from './supabaseClient.js';
import { currentAccessToken } from './auth.js';
import { SUPABASE_URL } from './constants.js'; // Ana-Laurya — Card 15

// Exported arrays (initially empty, filled by load functions)
export let books = [];
export let newsItems = [];
export let reviews = [];
export let orders = []; // Ana-Laurya Lefrancois — added for Card 8 OMS

// ============================================
// BOOKS
// Author: Lewei Rong
// ============================================

// Fetches all books from Supabase and updates local cache
export async function loadBooks() {
    console.log('loadBooks called');
    const { data, error } = await supabase.from('books').select('*');
    if (error) throw error;
    books = data;
    console.log('Books loaded:', books.length);
    return books;
}

// Saves updated book list to Supabase — uses raw fetch instead of supabase
// client to work around RLS quirks on admin writes
export async function saveBooks(newBooks) {
    console.log('saveBooks called with', newBooks.length, 'books');

    if (!currentAccessToken) {
        console.error('No access token available. Please log in.');
        throw new Error('Not authenticated. Please log in.');
    }
    console.log('Using stored token, length:', currentAccessToken.length);

    // Strip server-managed fields before upserting
    const cleanedBooks = newBooks.map(book => {
        const { created_at, interior_previews, description_fr, author_bio_fr, ...clean } = book;
        return clean;
    });

    const SUPABASE_URL = 'https://asjiiftlxyihlayydfju.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_W9OZS-Qu8r_N6PQ7dpZ-wA_1FDD8XO6';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${currentAccessToken}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(cleanedBooks)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase error ${response.status}: ${errorText}`);
    }

    console.log('Save successful');
    // Reload after save to keep local cache in sync — failure here is non-critical
    try { await loadBooks(); } catch(e) { console.warn('Reload after saveBooks failed (non-fatal):', e.message); }
}

// Deletes a single book by ID and removes it from the local cache
export async function deleteBook(bookId) {
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) throw error;
    books = books.filter(b => b.id !== bookId);
}

// ============================================
// NEWS
// Author: Lewei Rong
// ============================================

// Fetches all news items from Supabase and updates local cache
export async function loadNews() {
    console.log('loadNews called');
    const { data, error } = await supabase.from('news').select('*');
    if (error) throw error;
    newsItems = data;
    console.log('News loaded:', newsItems.length);
    return newsItems;
}

// Saves updated news list to Supabase — raw fetch used, same RLS workaround as saveBooks
export async function saveNews(newNews) {
    console.log('saveNews called with', newNews.length, 'news items');
    console.log('currentAccessToken:', currentAccessToken ? 'exists' : 'null');

    if (!currentAccessToken) {
        console.error('No access token available. Please log in.');
        throw new Error('Not authenticated. Please log in.');
    }

    // Strip server-managed fields before upserting
    const cleanedNews = newNews.map(item => {
        const { created_at, ...clean } = item;
        return clean;
    });

    const SUPABASE_URL = 'https://asjiiftlxyihlayydfju.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_W9OZS-Qu8r_N6PQ7dpZ-wA_1FDD8XO6';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/news`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${currentAccessToken}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(cleanedNews)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase error ${response.status}: ${errorText}`);
    }

    console.log('Save news successful');
    // Reload after save to keep local cache in sync — failure here is non-critical
    try { await loadNews(); } catch(e) { console.warn('Reload after saveNews failed (non-fatal):', e.message); }
}

// Deletes a single news item by ID and removes it from the local cache
export async function deleteNews(newsId) {
    const { error } = await supabase.from('news').delete().eq('id', newsId);
    if (error) throw error;
    newsItems = newsItems.filter(n => n.id !== newsId);
}

// ============================================
// REVIEWS
// Author: Lewei Rong
// ============================================

// Fetches all reviews from Supabase and updates local cache
export async function loadReviews() {
    const { data, error } = await supabase.from('reviews').select('*');
    if (error) throw error;
    reviews = data;
    return reviews;
}

// Inserts a brand-new review row — respects RLS INSERT policy
export async function insertReview(review) {
    const { error } = await supabase.from('reviews').insert([review]);
    if (error) throw error;
    reviews = [...reviews, review];
}

// Updates an existing review row — respects RLS UPDATE policy (own rows only)
export async function updateReview(review) {
    const { error } = await supabase
        .from('reviews')
        .update({
            text:     review.text,
            comments: review.comments,
            likes:    review.likes,
            rating:   review.rating ?? null
        })
        .eq('id', review.id);
    if (error) throw error;
    const idx = reviews.findIndex(r => r.id === review.id);
    if (idx >= 0) reviews[idx] = review;
}

/** @deprecated — use insertReview / updateReview instead to respect RLS policies */
export async function saveReviews(newReviews) {
    // Legacy function: splits into inserts vs updates to avoid RLS issues
    const existingIds = new Set(reviews.map(r => r.id));
    for (const rev of newReviews) {
        if (existingIds.has(rev.id)) {
            await updateReview(rev);
        } else {
            await insertReview(rev);
        }
    }
}

// ============================================
// ORDERS
// Author: Ana-Laurya Lefrancois — Card 8
// ============================================

/**
 * Fetches all orders from Supabase for the admin order list.
 * Mirrors the loadBooks() pattern — assigns to local cache and returns.
 *
 * @returns {Promise<Object[]>} Array of order records from the orders table.
 * @throws {Error} If the Supabase query fails.
 */
export async function loadOrders() {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) throw error;
    orders = data;
    console.log('Orders loaded:', orders.length);
    return orders;
}

/**
 * Fetches all line items for a specific order from order_items.
 * Called when expanding an order row in the admin view.
 *
 * @param {string} orderId - UUID of the parent order.
 * @returns {Promise<Object[]>} Array of order_items records.
 * @throws {Error} If the Supabase query fails.
 */
export async function loadOrderItems(orderId) {
    const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
    if (error) throw error;
    return data;
}

/**
 * Saves a new order and its line items to Supabase.
 * Replaces the placeholder saveOrder() — now writes to both
 * orders and order_items tables. Throws on failure so the
 * checkout UI can surface the error to the user.
 *
 * Ana-Laurya Lefrancois — Card 15: triggers order confirmation
 * email via send-order-email Edge Function after successful save.
 * Email failure is non-fatal — order is still saved if email fails.
 *
 * @param {Object} order - Order data from the checkout form.
 * @param {Object[]} items - Line items: [{book_id, title, quantity, price}].
 * @returns {Promise<Object>} The saved order record.
 * @throws {Error} If either the order or line item insert fails.
 */
export async function saveOrder(order, items = []) {
    // Insert the parent order row first — get the generated ID back
    const { data: savedOrder, error: orderError } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single();
    if (orderError) throw orderError;

    // Insert line items linked to the new order — snapshot price and title at sale
    if (items.length > 0) {
        const lineItems = items.map(item => ({
            order_id:          savedOrder.id,
            book_id:           item.book_id || null,
            quantity:          item.quantity,
            price_at_purchase: item.price,
            title_at_purchase: item.title
        }));
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(lineItems);
        if (itemsError) throw itemsError;
    }

    // Update local cache so admin view reflects new order immediately
    orders = [...orders, savedOrder];

    // ── Card 15: Trigger order confirmation email ─────────────────────────────
    // Fire-and-forget — email failure must not block checkout completion.
    // Calls send-order-email Edge Function with type 'order_confirmation'.
    // Uses latest session token — same pattern as sendNewsletterEmail() in newsletter.js.
    _sendOrderEmail('order_confirmation', savedOrder.id).catch(err => {
        console.warn('Order confirmation email failed (non-fatal):', err.message);
    });

    return savedOrder;
}

/**
 * Updates the status of a single order in Supabase.
 * Called from the inline status dropdown in the admin order list.
 *
 * @param {string} orderId - UUID of the order to update.
 * @param {string} newStatus - New status (must match CHECK constraint in schema).
 * @throws {Error} If the Supabase update fails.
 */
export async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
    if (error) throw error;

    // Reflect change in local cache immediately — no full reload needed
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) orders[idx].status = newStatus;
}

/**
 * Decreases a book's stock count by the quantity ordered.
 * Called when an order status changes to 'processing' (payment confirmed).
 * Uses fetch-then-update since Supabase doesn't support relative decrements directly.
 *
 * @param {string} bookId - UUID of the book to update.
 * @param {number} quantity - Number of copies to deduct.
 * @throws {Error} If the stock fetch or update fails.
 */
export async function decreaseStock(bookId, quantity) {
    // Fetch current stock before decrementing
    const { data: book, error: fetchError } = await supabase
        .from('books')
        .select('stock')
        .eq('id', bookId)
        .single();
    if (fetchError) throw fetchError;

    // Floor at 0 — stock cannot go negative
    const newStock = Math.max(0, (book.stock || 0) - quantity);
    const { error: updateError } = await supabase
        .from('books')
        .update({ stock: newStock })
        .eq('id', bookId);
    if (updateError) throw updateError;
}

// ============================================
// EMAIL HELPERS
// Author: Ana-Laurya Lefrancois — Card 15
// ============================================

/**
 * Calls the send-order-email Supabase Edge Function.
 * Follows sendNewsletterEmail() pattern from newsletter.js exactly —
 * fetches fresh session token, calls Edge Function with Bearer auth.
 *
 * @param {'order_confirmation'|'shipping_confirmation'} type - Email type to send.
 * @param {string} orderId - UUID of the order to email about.
 * @param {string} [trackingNumber] - Optional tracking number for shipping emails.
 * @returns {Promise<number>} Number of emails successfully sent.
 * @throws {Error} If the Edge Function call fails.
 */
export async function _sendOrderEmail(type, orderId, trackingNumber) {
    // Always get the latest session token — same as newsletter.js
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('No active session — cannot send order email.');
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
        method: 'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ type, orderId, trackingNumber })
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`send-order-email Edge Function error ${resp.status}: ${txt}`);
    }

    const json = await resp.json();
    return json.sent ?? 0;
}

// ============================================
// AUTH HELPERS
// Author: Lewei Rong
// ============================================

// Returns the role of a user from the profiles table — defaults to 'user' on error
export async function getUserRole(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    if (error) return 'user';
    return data?.role || 'user';
}
