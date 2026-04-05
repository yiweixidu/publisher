// newsletter.js — Subscription management & email dispatch
import { supabase } from './supabaseClient.js';
import { SUPABASE_URL } from './constants.js';

// ── Subscription status ──────────────────────────────────────────────────────

/**
 * Returns the subscriber row for a given userId, or null if not found.
 * Shape: { id, status: 'active'|'unsubscribed' }
 */
export async function getSubscriptionStatus(userId) {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('subscribers')
            .select('id, status')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    } catch (e) {
        console.warn('getSubscriptionStatus:', e.message);
        return null;
    }
}

/**
 * Subscribe a user.  Uses upsert so repeated calls are idempotent.
 */
export async function subscribeUser(userId, email) {
    const { error } = await supabase
        .from('subscribers')
        .upsert(
            { user_id: userId, email, status: 'active', subscribed_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        );
    if (error) throw error;
    return true;
}

/**
 * Unsubscribe a user, saving an optional plain-text reason.
 */
export async function unsubscribeUser(userId, reason = '') {
    const { error } = await supabase
        .from('subscribers')
        .update({
            status: 'unsubscribed',
            unsubscribe_reason: reason || null,
            unsubscribed_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    if (error) throw error;
    return true;
}

// ── Admin helpers ────────────────────────────────────────────────────────────

/** Returns the count of active subscribers (admin use). */
export async function getSubscriberCount() {
    const { count, error } = await supabase
        .from('subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
    if (error) return 0;
    return count ?? 0;
}

/**
 * Admin: dispatch a newsletter for a given news item via the
 * Supabase Edge Function `send-newsletter`.
 *
 * Requires:
 *   - subscribers table populated
 *   - Edge Function deployed at supabase/functions/send-newsletter/
 *   - RESEND_API_KEY set as a Supabase secret
 *
 * @param {string} newsItemId  – ID of the news item to send
 * @param {string} accessToken – Admin JWT (from auth.js currentAccessToken)
 * @returns {number}           – Number of emails sent
 */
export async function sendNewsletterEmail(newsItemId, accessToken) {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ newsItemId })
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Edge Function error ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    return json.sent ?? 0;
}