// constants.js
export const BASE_PATH = '/';
export const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
export const ADMIN_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Supabase configuration – replace with your own values
export const SUPABASE_URL = 'https://asjiiftlxyihlayydfju.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_W9OZS-Qu8r_N6PQ7dpZ-wA_1FDD8XO6';

export const DATA_KEYS = {
    BOOKS: 'acerBooks',
    NEWS: 'acerNews',
    USERS: 'acerUsers',
    REVIEWS: 'acerReviews',
    ADMIN: 'acerAdmins'
};