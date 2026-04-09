# Acer Books — Publisher E-commerce Platform

A bilingual (EN/FR) e-commerce platform for Acer Books, a Montréal-based independent publisher. Built with vanilla JavaScript, HTML/CSS, and Supabase as the backend.

---

## Authors

| Contributor | Scope |
|---|---|
| **Lewei Rong** | Core architecture, books, news, reviews, auth, admin (books/news/users/comments), routing, UI, cart, checkout, i18n, CSS |
| **Ana-Laurya Lefrancois** | Order Management System (Card 8), Customer Management (Card 11), Security & Reliability documentation (Card 20), Static Page Editor (Card 10), language switcher dynamic re-render (Card 18) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML5, CSS3 |
| Backend | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage + Edge Functions) |
| Rich Text | [Quill.js 1.3.6](https://quilljs.com) |
| Icons | [Font Awesome 6](https://fontawesome.com) |
| Fonts | Google Fonts — Inter + Lora |
| Hosting | GitHub Pages (custom domain: acerbooks.ca) |
| i18n | Custom `i18n.js` — English and French |

---

## Project Structure

```
publisher/
├── index.html          # Single-page app shell — all pages and modals
├── main.js             # Entry point — event listeners and app init
├── auth.js             # Supabase Auth — login, logout, signup, session
├── admin.js            # Admin pages — books, news, users, comments, orders
├── data.js             # Supabase data layer — all CRUD functions
├── ui.js               # Public page rendering — books, news, book detail
├── routing.js          # Client-side routing — navigateTo, handleRoute
├── cart.js             # Shopping cart — localStorage persistence
├── review.js           # Book reviews — CRUD, star ratings, share cards
├── newsletter.js       # Newsletter subscription management
├── account.js          # Customer account dashboard
├── i18n.js             # Bilingual strings — EN/FR language pack
├── constants.js        # Supabase config and app constants
├── supabaseClient.js   # Supabase JS client initialization
├── style.css           # Global styles
└── supabase/
    └── functions/
        ├── og-card/        # Edge Function — review share card image generation
        └── send-newsletter/ # Edge Function — newsletter email dispatch
```

---

## Features

### Public (Visitor)
- Browse books with filters (language, author, series) and pagination
- Search by title, author, or ISBN
- View book detail pages with tabs (description, author bio, details, reviews)
- Read news and events
- Switch between English and French — preserves current page context
- Add books to cart (guest checkout supported)

### Customer (Registered)
- Secure login and signup via Supabase Auth
- Account dashboard — profile, order history, wishlist, saved addresses
- Write, edit, and delete book reviews with star ratings
- Share reviews as social cards (Facebook, Twitter, WeChat)
- Subscribe and unsubscribe from newsletter

### Admin (2FA Protected)
- Manage books — add, edit, duplicate, delete, image upload
- Manage news — bilingual articles, publish/unpublish, send newsletter
- Manage users — view profiles, role management, subscriber status
- Manage comments — moderate reviews and comments
- Manage orders — view all orders, update status, expand line items, print invoices
- Customer management — view order history per customer

---

## Security

> Card 20 — Security & Reliability (NFR)
> Audit and documentation by Ana-Laurya Lefrancois

### HTTPS
Enforced automatically by GitHub Pages on the custom domain `acerbooks.ca`. The `CNAME` file in the repository root configures this. No additional setup required — all traffic is redirected to HTTPS.

### Password Hashing
All user passwords are hashed with **bcrypt** by Supabase Auth — this is the default and cannot be disabled. The previously used SHA-256 hashing (in the legacy `admins.js` file) has been removed. Admin login now uses Supabase Auth exclusively.

### Admin Two-Factor Authentication
Implemented by Lewei Rong using TOTP (Time-based One-Time Password). Admins must verify with an authenticator app (e.g. Google Authenticator) in addition to their password. Session timeout after 5 minutes of inactivity (`ADMIN_INACTIVITY_TIMEOUT` in `constants.js`).

### XSS Prevention
Two layers of output escaping are in place:
- `_esc()` in `admin.js` (author: Lewei Rong) — sanitizes all user-generated content before `innerHTML` injection in the admin UI
- `escapeHtml()` in `review.js` (author: Lewei Rong) — sanitizes review text, usernames, and comment content before rendering

### SQL Injection Prevention
All database queries use the Supabase JS client with parameterized queries. No raw SQL string concatenation is used in any client-side code.

### Row Level Security (RLS)
Supabase RLS policies are enabled on the `orders` and `order_items` tables (added by Ana-Laurya Lefrancois, Card 8):
- Customers can only insert and read their own orders
- Admins have full access via role check on the `profiles` table

### Payment Data
No payment card data is stored anywhere in the system. Stripe and PayPal integrations are gateway-side only — raw card details never touch our server or database.

### Database Backups
The project currently runs on Supabase **Nano** (free tier). Automated daily backups require the **Pro plan** ($25/month). This is a known limitation and is recommended before moving to full production.

**Recommended action:** Upgrade to Supabase Pro to enable Point-in-Time Recovery and daily automated backups.

### Uptime Monitoring
Recommended: Set up [UptimeRobot](https://uptimerobot.com) (free tier) to monitor `https://acerbooks.ca` with email alerts. Target uptime: 99.5% (excluding planned maintenance).

### Dependency Security
This project uses CDN-loaded dependencies with pinned versions:

| Dependency | Version | CDN |
|---|---|---|
| Font Awesome | 6.0.0-beta3 | cdnjs.cloudflare.com |
| Quill.js | 1.3.6 | cdn.quilljs.com |
| Supabase JS | 2 (latest) | cdn.jsdelivr.net |
| Google Fonts | — | fonts.googleapis.com |

To update: change the version number in the `<script>` or `<link>` tag in `index.html`. Check [cdnjs.com](https://cdnjs.com) for latest stable versions. Review changelogs before upgrading Supabase JS — breaking changes between major versions.

---

## Database Schema

### Core Tables (Author: Lewei Rong)
- `books` — catalog with full metadata, cover images, bilingual content
- `news` — bilingual articles with publish/draft status
- `reviews` — book reviews with star ratings, comments, likes
- `profiles` — user profiles with display name and role
- `subscribers` — newsletter subscription status

### Orders Tables (Author: Ana-Laurya Lefrancois — Card 8)
- `orders` — one record per customer checkout, with snapshotted shipping address and financials
- `order_items` — line items per order with price and title snapshotted at purchase time

See `create-orders-tables-final.sql` (attached to Card 8 on Trello) for the full schema with RLS policies.

---

## Environment Setup

No `.env` file needed — Supabase config uses the **publishable anon key** which is safe to expose in client-side code. The anon key has no elevated permissions — RLS policies enforce data access rules.

Config values live in `constants.js`:
```js
export const SUPABASE_URL     = 'https://asjiiftlxyihlayydfju.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

To run locally: open `index.html` with a live server (VS Code Live Server extension recommended).

---

## Deployment

Deployed automatically via GitHub Actions to GitHub Pages on every push to `master`. The workflow file is in `.github/workflows/`. Custom domain `acerbooks.ca` is configured via the `CNAME` file in the repo root.

---

## Branch Strategy

| Branch pattern | Purpose |
|---|---|
| `master` | Production — live at acerbooks.ca |
| `liwei_publisher` | Lewei Rong's development branch |
| `feat/card8-order-management` | Ana-Laurya — OMS (Card 8) |
| `feat/card11-customer-management` | Ana-Laurya — Customer Management (Card 11) |
| `feat/card20-security` | Ana-Laurya — Security & Reliability (Card 20) |
| `feat/card10-static-page-editor` | Ana-Laurya — Static Page Editor (Card 10) |

---

## Known Limitations

- **Payment gateway** — Stripe/PayPal integration is scaffolded but not live. Add `STRIPE_PK` and `PAYPAL_CLIENT_ID` to `constants.js` to activate.
- **Automated backups** — Requires Supabase Pro plan upgrade.
- **Shipping calculator** — Currently fixed rates. Real-time carrier API integration is planned (Card 14).
- **Orders schema** — `create-orders-tables-final.sql` is ready but pending alignment with Lewei's existing `orders` table before running in production.
