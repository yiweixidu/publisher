// amazon.js — Amazon redirect helper
// Author: Lewei Rong
import { AMAZON_BASE, AMAZON_AFFILIATE_TAG } from './constants.js';

// Builds the Amazon URL for a book — direct link > ISBN link > search fallback
export function getAmazonUrl(book) {
    let url;
    if (book.amazon_url) {
        url = book.amazon_url;
    } else if (book.isbn) {
        // ISBN-10 usually equals the ASIN for print books
        const isbn10 = book.isbn.replace(/-/g, '');
        url = isbn10.length === 10
            ? `${AMAZON_BASE}/dp/${isbn10}`
            : `${AMAZON_BASE}/s?k=${encodeURIComponent(book.isbn)}`;
    } else {
        url = `${AMAZON_BASE}/s?k=${encodeURIComponent(book.title + ' ' + (book.author || ''))}`;
    }
    if (AMAZON_AFFILIATE_TAG) {
        url += (url.includes('?') ? '&' : '?') + 'tag=' + AMAZON_AFFILIATE_TAG;
    }
    return url;
}