// amazon.js — Amazon redirect helper
// Author: Lewei Rong
import { AMAZON_BASE, AMAZON_AFFILIATE_TAG } from './constants.js';

// Converts ISBN-13 to ISBN-10 (only possible for 978-prefixed ISBNs).
// Amazon's /dp/ path only accepts ASINs — for print books, ASIN = ISBN-10.
function isbn13ToIsbn10(isbn13) {
    if (!/^978\d{10}$/.test(isbn13)) return null; // 979- ISBNs have no ISBN-10 form
    const core = isbn13.slice(3, 12);             // drop '978' prefix and old check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(core[i], 10);
    const check = (11 - (sum % 11)) % 11;
    return core + (check === 10 ? 'X' : String(check));
}

// Builds the Amazon URL for a book — direct link > ISBN link > search fallback
export function getAmazonUrl(book) {
    let url;
    if (book.amazon_url) {
        url = book.amazon_url;
    } else if (book.isbn) {
        const digits = book.isbn.replace(/[^0-9Xx]/g, '');
        let asin = null;
        if (digits.length === 10) {
            asin = digits;                       // already ISBN-10
        } else if (digits.length === 13) {
            asin = isbn13ToIsbn10(digits);       // convert; null if 979-prefixed
        }
        url = asin
            ? `${AMAZON_BASE}/dp/${asin}`
            : `${AMAZON_BASE}/s?k=${encodeURIComponent(digits)}`;  // search fallback
    }
}