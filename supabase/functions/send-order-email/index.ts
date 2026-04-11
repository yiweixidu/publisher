// @ts-nocheck
// ============================================
// supabase/functions/send-order-email/index.ts
// Publisher E-commerce Platform
// ============================================
// Author: Ana-Laurya Lefrancois — Card 15
// ============================================
// Sends transactional order emails via Resend:
//   - Order confirmation to customer + admin
//   - Shipping notification to customer
//
// Follows Lewei Rong's send-newsletter/index.ts
// pattern exactly — same auth guard, same Resend
// call shape, same CORS headers, same error style.
//
// Deploy:
//   supabase functions deploy send-order-email
//
// Secrets needed (already set by Lewei Rong):
//   RESEND_API_KEY
//   FROM_EMAIL
//   SERVICE_ROLE_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Same CORS headers as send-newsletter — required for browser fetch calls
const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight — same pattern as send-newsletter
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ── Environment variables ─────────────────────────────────────────────
        // Same vars as send-newsletter — all already set as Supabase secrets
        const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const SERVICE_ROLE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!;
        const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY');
        // Placeholder from-address — update once Lewei confirms verified domain
        // e.g. 'newsletter@acerbooks.ca' → 'noreply@acerbooks.ca'
        const FROM_EMAIL        = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';
        const ADMIN_EMAIL       = 'acerbookscanada@gmail.com';

        // ── 1. Verify caller has a valid session ──────────────────────────────
        // Exact same auth guard as send-newsletter — reject missing/invalid tokens
        const authHeader = req.headers.get('Authorization') ?? '';
        const token = authHeader.replace('Bearer ', '').trim();

        if (!token || token === 'null' || token === 'undefined') {
            return new Response(
                JSON.stringify({ error: 'Missing auth token — please log in again' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify JWT with user-scoped client — same as send-newsletter
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized — session invalid or expired' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── 2. Parse request body ─────────────────────────────────────────────
        // type: 'order_confirmation' | 'shipping_confirmation'
        const { type, orderId, trackingNumber } = await req.json();

        if (!type || !orderId) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: type, orderId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── 3. Load order + line items via service role (bypasses RLS) ────────
        // Same adminClient pattern as send-newsletter
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const { data: order, error: orderError } = await adminClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: items, error: itemsError } = await adminClient
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);
        if (itemsError) throw itemsError;

        // ── 4. Check Resend key — same guard as send-newsletter ───────────────
        if (!RESEND_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'RESEND_API_KEY not set' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── 5. Send emails based on type ──────────────────────────────────────
        const customerEmail = order.customer_email || order.shipping_email;
        let sent = 0;
        const errors: string[] = [];

        if (type === 'order_confirmation') {
            // Email to customer
            if (customerEmail) {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from:    `Acer Books <${FROM_EMAIL}>`,
                        to:      [customerEmail],
                        subject: `Order Confirmed — #${order.id.substring(0, 8).toUpperCase()} | Acer Books`,
                        html:    buildOrderConfirmationCustomer(order, items || [])
                    })
                });
                if (res.ok) { sent++; } else {
                    const txt = await res.text();
                    errors.push(`customer: ${txt}`);
                    console.error('Customer email error:', txt);
                }
            }

            // Admin notification — always sent regardless of customer email
            const adminRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from:    `Acer Books <${FROM_EMAIL}>`,
                    to:      [ADMIN_EMAIL],
                    subject: `🛍️ New Order #${order.id.substring(0, 8).toUpperCase()} — $${parseFloat(order.total || 0).toFixed(2)}`,
                    html:    buildOrderConfirmationAdmin(order, items || [])
                })
            });
            if (adminRes.ok) { sent++; } else {
                const txt = await adminRes.text();
                errors.push(`admin: ${txt}`);
                console.error('Admin email error:', txt);
            }

        } else if (type === 'shipping_confirmation') {
            // Shipping notification to customer only
            if (customerEmail) {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from:    `Acer Books <${FROM_EMAIL}>`,
                        to:      [customerEmail],
                        subject: `Your Acer Books order has shipped! 🚚 #${order.id.substring(0, 8).toUpperCase()}`,
                        html:    buildShippingConfirmation(order, trackingNumber)
                    })
                });
                if (res.ok) { sent++; } else {
                    const txt = await res.text();
                    errors.push(`shipping: ${txt}`);
                    console.error('Shipping email error:', txt);
                }
            }

        } else {
            return new Response(
                JSON.stringify({ error: `Unknown email type: ${type}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`send-order-email: sent=${sent}, type=${type}, orderId=${orderId}`);
        return new Response(
            JSON.stringify({ sent, errors }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('Fatal:', err);
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// ── Email templates ───────────────────────────────────────────────────────────
// Table-based layouts — same approach as send-newsletter's buildEmailHTML().
// Styled to match Acer Books' red-and-white brand identity.

/**
 * Order confirmation email sent to the customer.
 * Includes order ID, item list, totals, and shipping address.
 */
function buildOrderConfirmationCustomer(order: any, items: any[]): string {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a;">${item.title_at_purchase}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#555;">× ${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#1a1a1a;">$${parseFloat(item.price_at_purchase).toFixed(2)}</td>
        </tr>`).join('');

    const date = new Date(order.created_at).toLocaleDateString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Order Confirmed | Acer Books</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
<tr><td style="background:linear-gradient(135deg,#1a0000 0%,#6b0000 100%);padding:28px 36px;text-align:center;">
  <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Acer Books · Montréal</p>
  <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;color:#fff;font-weight:700;">Order Confirmed 📚</h1>
</td></tr>
<tr><td style="padding:32px 36px 0;">
  <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7;">Thank you for your order! We'll process it shortly and send another email when your books ship.</p>
  <div style="background:#f9f9f9;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
    <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Order ID</p>
    <p style="margin:4px 0 8px;font-weight:700;color:#1a1a1a;">#${order.id.substring(0, 8).toUpperCase()}</p>
    <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Order Date</p>
    <p style="margin:4px 0 0;color:#1a1a1a;">${date}</p>
  </div>
  <h3 style="margin:0 0 12px;font-family:Georgia,serif;color:#1a1a1a;border-bottom:2px solid #cc0000;padding-bottom:6px;">Your Books</h3>
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead><tr style="font-size:11px;color:#888;text-transform:uppercase;">
      <th style="text-align:left;padding-bottom:8px;">Title</th>
      <th style="text-align:center;padding-bottom:8px;">Qty</th>
      <th style="text-align:right;padding-bottom:8px;">Price</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #1a1a1a;padding-top:12px;">
    <tr><td style="padding:4px 0;color:#555;font-size:14px;">Subtotal</td><td style="text-align:right;font-size:14px;">$${parseFloat(order.subtotal || 0).toFixed(2)}</td></tr>
    <tr><td style="padding:4px 0;color:#555;font-size:14px;">Shipping</td><td style="text-align:right;font-size:14px;">$${parseFloat(order.shipping_cost || 0).toFixed(2)}</td></tr>
    <tr><td style="padding:4px 0;color:#555;font-size:14px;">Tax</td><td style="text-align:right;font-size:14px;">$${parseFloat(order.tax || 0).toFixed(2)}</td></tr>
    <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td><td style="text-align:right;font-weight:700;font-size:16px;color:#cc0000;">$${parseFloat(order.total || 0).toFixed(2)}</td></tr>
  </table>
  <h3 style="margin:24px 0 12px;font-family:Georgia,serif;color:#1a1a1a;border-bottom:2px solid #cc0000;padding-bottom:6px;">Shipping Address</h3>
  <p style="margin:0 0 32px;color:#555;font-size:14px;line-height:1.8;">
    ${order.shipping_name || ''}<br>
    ${order.shipping_address || ''}<br>
    ${order.shipping_city || ''}${order.shipping_province ? ', ' + order.shipping_province : ''} ${order.shipping_postal || ''}<br>
    ${order.shipping_country || ''}
  </p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:18px 36px;text-align:center;">
  <p style="margin:0 0 6px;font-size:11px;color:#aaa;">Questions? <a href="mailto:acerbookscanada@gmail.com" style="color:#cc0000;">acerbookscanada@gmail.com</a></p>
  <p style="margin:0;font-size:11px;color:#ccc;">© ${new Date().getFullYear()} Acer Books · 5470 rue Saint-Laurent, Montréal · acerbooks.ca</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Order notification email sent to the admin.
 * Simpler layout — just the essentials for quick action.
 */
function buildOrderConfirmationAdmin(order: any, items: any[]): string {
    const itemsHtml = items.map(item =>
        `<li style="margin-bottom:6px;">${item.title_at_purchase} × ${item.quantity} — $${parseFloat(item.price_at_purchase).toFixed(2)}</li>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>New Order | Acer Books Admin</title></head>
<body style="margin:0;padding:32px;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
  <h2 style="margin:0 0 16px;color:#cc0000;font-family:Georgia,serif;">🛍️ New Order Received</h2>
  <p style="margin:0 0 8px;"><strong>Order ID:</strong> #${order.id.substring(0, 8).toUpperCase()}</p>
  <p style="margin:0 0 8px;"><strong>Customer:</strong> ${order.shipping_name || 'Guest'}</p>
  <p style="margin:0 0 8px;"><strong>Email:</strong> ${order.customer_email || order.shipping_email || '—'}</p>
  <p style="margin:0 0 8px;"><strong>Total:</strong> $${parseFloat(order.total || 0).toFixed(2)}</p>
  <p style="margin:0 0 16px;"><strong>Ship to:</strong> ${order.shipping_address || ''}, ${order.shipping_city || ''} ${order.shipping_postal || ''}</p>
  <h3 style="margin:0 0 8px;">Items:</h3>
  <ul style="margin:0 0 20px;padding-left:20px;color:#555;">${itemsHtml}</ul>
  <a href="https://acerbooks.ca" style="display:inline-block;background:#cc0000;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;">Go to Manage Orders →</a>
</div>
</body></html>`;
}

/**
 * Shipping confirmation email sent to the customer.
 * Includes tracking number if provided by admin when marking as shipped.
 */
function buildShippingConfirmation(order: any, trackingNumber?: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Your Order Has Shipped | Acer Books</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
<tr><td style="background:linear-gradient(135deg,#1a0000 0%,#6b0000 100%);padding:28px 36px;text-align:center;">
  <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Acer Books · Montréal</p>
  <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;color:#fff;font-weight:700;">Your Order Has Shipped 🚚</h1>
</td></tr>
<tr><td style="padding:32px 36px;">
  <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">Great news — your books are on their way!</p>
  <div style="background:#f9f9f9;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
    <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Order ID</p>
    <p style="margin:4px 0 10px;font-weight:700;color:#1a1a1a;">#${order.id.substring(0, 8).toUpperCase()}</p>
    <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Ship to</p>
    <p style="margin:4px 0 0;color:#555;font-size:14px;line-height:1.7;">
      ${order.shipping_name || ''}<br>
      ${order.shipping_address || ''}<br>
      ${order.shipping_city || ''} ${order.shipping_postal || ''}
    </p>
    ${trackingNumber ? `
    <p style="margin:12px 0 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Tracking Number</p>
    <p style="margin:4px 0 0;font-weight:700;color:#cc0000;font-size:16px;">${trackingNumber}</p>
    ` : ''}
  </div>
  <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">Standard shipping takes 5–10 business days. Express shipping takes 2–3 business days. Thank you for supporting independent publishing!</p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:18px 36px;text-align:center;">
  <p style="margin:0 0 6px;font-size:11px;color:#aaa;">Questions? <a href="mailto:acerbookscanada@gmail.com" style="color:#cc0000;">acerbookscanada@gmail.com</a></p>
  <p style="margin:0;font-size:11px;color:#ccc;">© ${new Date().getFullYear()} Acer Books · 5470 rue Saint-Laurent, Montréal · acerbooks.ca</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
