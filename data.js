// data.js
import { supabase } from './supabaseClient.js';
import { currentAccessToken } from './auth.js';

// Exported arrays (initially empty, filled by load functions)
export let books = [];
export let newsItems = [];
export let reviews = [];

// ---------- Books ----------
export async function loadBooks() {
    console.log('loadBooks called');
    const { data, error } = await supabase.from('books').select('*');
    if (error) throw error;
    books = data;
    console.log('Books loaded:', books.length);
    return books;
}

export async function saveBooks(newBooks) {
    console.log('saveBooks called with', newBooks.length, 'books');

    if (!currentAccessToken) {
        console.error('No access token available. Please log in.');
        throw new Error('Not authenticated. Please log in.');
    }
    console.log('Using stored token, length:', currentAccessToken.length);

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
    await loadBooks();
}

export async function deleteBook(bookId) {
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) throw error;
    books = books.filter(b => b.id !== bookId);
}

// ---------- News ----------
export async function loadNews() {
    console.log('loadNews called');
    const { data, error } = await supabase.from('news').select('*');
    if (error) throw error;
    newsItems = data;
    console.log('News loaded:', newsItems.length);
    return newsItems;
}

export async function saveNews(newNews) {
    console.log('saveNews called with', newNews.length, 'news items');
    console.log('currentAccessToken:', currentAccessToken ? 'exists' : 'null');

    if (!currentAccessToken) {
        console.error('No access token available. Please log in.');
        throw new Error('Not authenticated. Please log in.');
    }

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
    await loadNews();
}

export async function deleteNews(newsId) {
    const { error } = await supabase.from('news').delete().eq('id', newsId);
    if (error) throw error;
    newsItems = newsItems.filter(n => n.id !== newsId);
}

// ---------- Reviews ----------
export async function loadReviews() {
    const { data, error } = await supabase.from('reviews').select('*');
    if (error) throw error;
    reviews = data;
    return reviews;
}

export async function saveReviews(newReviews) {
    const { error } = await supabase.from('reviews').upsert(newReviews, { onConflict: 'id' });
    if (error) throw error;
    reviews = newReviews;
}

// ---------- Orders ----------
export async function saveOrder(order) {
    try {
        const { error } = await supabase.from('orders').insert([order]);
        if (error) console.warn('Order save warning (table may not exist yet):', error.message);
    } catch (err) {
        console.warn('saveOrder failed:', err);
    }
}
export async function getUserRole(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    if (error) return 'user';
    return data?.role || 'user';
}