// review.js
import { reviews, saveReviews, loadReviews } from './data.js';
import { langPack } from './i18n.js';
import { supabase } from './supabaseClient.js';

const modalReviews = document.getElementById('modalReviews');

function fallbackCopy(review, shareUrl) {
    const message = `【Review】${review.username} reviewed this book:\n“${review.text}”\nView full review: ${shareUrl}`;
    navigator.clipboard.writeText(message).then(() => {
        alert('Review copied. You can paste and send it to friends.');
    }).catch(() => {
        alert('Copy failed. Please manually copy the link: ' + shareUrl);
    });
}

function attachEventsToContainer(container, bookId, currentLang, currentUser) {
    if (!container) return;

    container.querySelectorAll('.wechat-share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reviewId = btn.dataset.reviewId;
            const review = reviews.find(r => r.id === reviewId);
            if (!review) return;

            const shareTitle = `review by ${review.username}`;
            const shareText = review.text.substring(0, 100) + (review.text.length > 100 ? '…' : '');
            const shareUrl = window.location.href.split('#')[0] + '#review-' + reviewId;

            if (navigator.share) {
                navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl,
                }).catch(() => fallbackCopy(review, shareUrl));
            } else {
                fallbackCopy(review, shareUrl);
            }
        });
    });

    container.querySelectorAll('.wechat-comment-submit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) return;
            const reviewId = btn.dataset.reviewId;
            const input = container.querySelector(`.wechat-comment-input[data-review-id="${reviewId}"]`);
            const text = input?.value.trim();
            if (!text) return;
            const review = reviews.find(r => r.id === reviewId);
            if (review) {
                review.comments.push({
                    user_id: currentUser.id,
                    username: currentUser.email.split('@')[0], // fallback
                    text: text,
                    timestamp: new Date().toISOString()
                });
                await saveReviews(reviews);
                if (container === modalReviews) {
                    renderReviews(bookId, currentLang, currentUser);
                } else {
                    renderDetailReviews(bookId, currentLang, currentUser);
                }
            }
        });
    });

    const submitReview = container.querySelector('.review-submit');
    if (submitReview && currentUser) {
        submitReview.addEventListener('click', async () => {
            const textarea = container.querySelector('.review-textarea');
            const text = textarea?.value.trim();
            if (!text) return;
            const newReview = {
                id: 'rev_' + Date.now() + Math.random().toString(36).substr(2,6),
                book_id: bookId,
                user_id: currentUser.id,
                username: currentUser.email.split('@')[0], // fallback
                text: text,
                timestamp: new Date().toISOString(),
                likes: [],
                comments: []
            };
            const updatedReviews = [...reviews, newReview];
            await saveReviews(updatedReviews);
            if (container === modalReviews) {
                renderReviews(bookId, currentLang, currentUser);
            } else {
                renderDetailReviews(bookId, currentLang, currentUser);
            }
        });
    }
}

function generateReviewsHTML(bookReviews, currentLang, currentUser) {
    let html = '<div class="wechat-review-list">';

    if (bookReviews.length === 0) {
        html += `<p class="no-reviews">${langPack[currentLang].noReviews}</p>`;
    }

    bookReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    bookReviews.forEach(r => {
        if (!r.comments) r.comments = [];

        const date = new Date(r.timestamp).toLocaleDateString(
            currentLang === 'fr' ? 'fr-CA' : 'en-CA',
            { year: 'numeric', month: '2-digit', day: '2-digit' }
        );

        html += `
            <div class="wechat-review-item" data-review-id="${r.id}">
                <div class="wechat-review-header">
                    <span class="wechat-review-user">${r.username}</span>
                    <span class="wechat-review-date">${date}</span>
                </div>
                <div class="wechat-review-content">${r.text}</div>
                <div class="wechat-review-footer">
                    <button class="wechat-share-btn" data-review-id="${r.id}">${langPack[currentLang].share || 'share to wechat'}</button>
                </div>
                <div class="wechat-comment-section" id="comments-${r.id}">
        `;

        r.comments.forEach(c => {
            const commentDate = new Date(c.timestamp).toLocaleDateString(
                currentLang === 'fr' ? 'fr-CA' : 'en-CA',
                { month: '2-digit', day: '2-digit' }
            );
            html += `
                <div class="wechat-comment-item">
                    <span class="wechat-comment-user">${c.username}</span>
                    <span class="wechat-comment-text">${c.text}</span>
                    <span class="wechat-comment-date">${commentDate}</span>
                </div>
            `;
        });

        if (currentUser) {
            html += `
                <div class="wechat-comment-form">
                    <input type="text" class="wechat-comment-input" placeholder="${langPack[currentLang].writeReviewPlaceholder}" data-review-id="${r.id}">
                    <button class="wechat-comment-submit" data-review-id="${r.id}">${langPack[currentLang].submitReview}</button>
                </div>
            `;
        } else {
            html += `<p class="login-prompt">${langPack[currentLang].loginPrompt}</p>`;
        }

        html += `</div></div>`;
    });

    if (currentUser) {
        html += `
            <div class="review-form wechat-review-form">
                <textarea class="review-textarea" placeholder="${langPack[currentLang].writeReviewPlaceholder}"></textarea>
                <button class="review-submit wechat-submit">${langPack[currentLang].submitReview}</button>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

export async function renderReviews(bookId, currentLang, currentUser) {
    await loadReviews(); // ensure latest
    if (!modalReviews) return;
    const bookReviews = reviews.filter(r => r.book_id === bookId);
    modalReviews.innerHTML = generateReviewsHTML(bookReviews, currentLang, currentUser);
    attachEventsToContainer(modalReviews, bookId, currentLang, currentUser);
}

export async function renderDetailReviews(bookId, currentLang, currentUser) {
    await loadReviews();
    const detailReviews = document.getElementById('detailReviews');
    if (!detailReviews) return;
    const bookReviews = reviews.filter(r => r.book_id === bookId);
    detailReviews.innerHTML = generateReviewsHTML(bookReviews, currentLang, currentUser);
    attachEventsToContainer(detailReviews, bookId, currentLang, currentUser);
}

export function checkHashForReview() {
    // hash handling remains the same; relies on reviews array
    if (window.location.hash.startsWith('#review-')) {
        const reviewId = window.location.hash.substring(8);
        const review = reviews.find(r => r.id === reviewId);
        if (review) {
            // need books array – it's imported from data.js, but we must ensure it's loaded
            import('./data.js').then(({ books }) => {
                const book = books.find(b => b.id === review.book_id);
                if (book) {
                    window.dispatchEvent(new CustomEvent('hashReview', { detail: { book, reviewId } }));
                }
            });
        }
    }
}