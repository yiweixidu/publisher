// ============================================
// constants.js
// Publisher E-commerce Platform
// ============================================
// Authors:
//   Lewei Rong            — All original constants
//                           (BASE_PATH, SESSION_DURATION,
//                            SUPABASE config, DATA_KEYS)
//   Ana-Laurya Lefrancois — Security documentation
//                           comments (Card 20)
// ============================================

// ============================================
// ROUTING
// Author: Lewei Rong
// ============================================

// Base path for client-side routing — '/' for root domain deployment
export const BASE_PATH = '/';

// ============================================
// SESSION TIMEOUTS
// Author: Lewei Rong
// ============================================

// Full session duration — currently unused directly but available for future use
export const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// Admin inactivity timeout — admin is logged out after this period of no interaction
// Enforced in auth.js bindInactivityEvents() / resetAdminInactivityTimer()
export const ADMIN_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ============================================
// SUPABASE CONFIGURATION
// Author: Lewei Rong
// Security notes: Ana-Laurya Lefrancois (Card 20)
// ============================================

// Supabase project URL — safe to expose in client-side code.
// The anon key below has no elevated permissions on its own.
// All data access is controlled by Row Level Security (RLS) policies
// defined in the Supabase dashboard and in create-orders-tables-final.sql.
export const SUPABASE_URL = 'https://asjiiftlxyihlayydfju.supabase.co';

// Supabase publishable anon key — intentionally public.
// This key can only perform operations that RLS policies permit.
// It does NOT grant admin access — admin operations require a valid
// user JWT with role='admin' in the profiles table.
// Never replace this with the service_role key in client-side code.
export const SUPABASE_ANON_KEY = 'sb_publishable_W9OZS-Qu8r_N6PQ7dpZ-wA_1FDD8XO6';

// ============================================
// LOCAL STORAGE KEYS
// Author: Lewei Rong
// Used by cart.js for guest cart persistence
// ============================================

export const DATA_KEYS = {
    BOOKS:   'acerBooks',
    NEWS:    'acerNews',
    USERS:   'acerUsers',
    REVIEWS: 'acerReviews',
    ADMIN:   'acerAdmins'
};
