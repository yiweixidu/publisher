// data.js
import { supabase } from '/publisher/supabaseClient.js';

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
    
    console.log('supabase.auth:', supabase.auth);
    console.log('Calling supabase.auth.getSession()...');
    
    let sessionResult;
    try {
        sessionResult = await supabase.auth.getSession();
    } catch (err) {
        console.error('getSession threw error:', err);
        throw err;
    }
    
    console.log('getSession result:', sessionResult);
    const session = sessionResult.data?.session;
    if (!session) {
        console.error('No session after getSession');
        throw new Error('Not authenticated');
    }
    const accessToken = session.access_token;
    console.log('Access token obtained, length:', accessToken.length);
    
    const cleanedBooks = newBooks.map(book => {
        const { created_at, ...clean } = book;
        return clean;
    });
    
    const SUPABASE_URL = 'https://asjiiftlxyihlayydfju.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_W9OZS-Qu8r_N6PQ7dpZ-wA_1FDD8XO6';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(cleanedBooks)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase error ${response.status}: ${errorText}`);
    }
    
    console.log('Save successful');
    books = newBooks;
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
    const { error } = await supabase.from('news').upsert(newNews, { onConflict: 'id' });
    if (error) throw error;
    newsItems = newNews;
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

// ---------- User roles (profiles) ----------
export async function getUserRole(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    if (error) return 'user';
    return data?.role || 'user';
}