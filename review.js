// review.js
import { reviews, insertReview, updateReview, loadReviews } from './data.js';
import { langPack } from './i18n.js';
import { supabase } from './supabaseClient.js';

const modalReviews = document.getElementById('modalReviews');

// Helper: get user's display name by userId (from profiles table)
async function getUserDisplayName(userId) {
    if (!userId) return 'User';
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .single();
        if (profile?.display_name) return profile.display_name;
        // fallback: get email prefix from auth
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email) return userData.user.email.split('@')[0];
        return 'User';
    } catch (e) {
        console.warn('getUserDisplayName error:', e);
        return 'User';
    }
}

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

    // Share button (circle icon)
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

    // Submit comment (reply) – button placed in right column
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
                const commenterName = await getUserDisplayName(currentUser.id);
                review.comments.push({
                    user_id: currentUser.id,
                    username: commenterName,
                    text: text,
                    timestamp: new Date().toISOString()
                });
                await updateReview(review);
                // Force reload reviews from DB and re-render
                await loadReviews();
                if (container === modalReviews) {
                    await renderReviews(bookId, currentLang, currentUser);
                } else {
                    await renderDetailReviews(bookId, currentLang, currentUser);
                }
                // Clear input after submission
                if (input) input.value = '';
            }
        });
    });

    // Submit a new review (post)
    const submitReview = container.querySelector('.review-submit');
    if (submitReview && currentUser) {
        submitReview.addEventListener('click', async () => {
            const textarea = container.querySelector('.review-textarea');
            const text = textarea?.value.trim();
            if (!text) return;
            const displayName = await getUserDisplayName(currentUser.id);
            const newReview = {
                id: 'rev_' + Date.now() + Math.random().toString(36).substr(2, 6),
                book_id: bookId,
                user_id: currentUser.id,
                username: displayName,
                text: text,
                timestamp: new Date().toISOString(),
                likes: [],
                comments: []
            };
            await insertReview(newReview);
            // Force reload reviews from DB and re-render
            await loadReviews();
            if (container === modalReviews) {
                await renderReviews(bookId, currentLang, currentUser);
            } else {
                await renderDetailReviews(bookId, currentLang, currentUser);
            }
            // Clear textarea
            if (textarea) textarea.value = '';
        });
    }
}

function generateReviewsHTML(bookReviews, currentLang, currentUser) {
    let html = '<div class="wechat-review-list">';

    if (bookReviews.length === 0) {
        html += `<p class="no-reviews">${langPack[currentLang].noReviews}</p>`;
    }

    bookReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    for (const r of bookReviews) {
        if (!r.comments) r.comments = [];

        const date = new Date(r.timestamp).toLocaleDateString(
            currentLang === 'fr' ? 'fr-CA' : 'en-CA',
            { year: 'numeric', month: '2-digit', day: '2-digit' }
        );
        let displayUsername = r.username;
        if (currentUser && r.user_id === currentUser.id) {
            const currentDisplayName = currentUser.user_metadata?.display_name || 
                                       currentUser.email.split('@')[0];
            displayUsername = currentDisplayName;
        }
        const userInitial = (displayUsername && displayUsername.length > 0) ? displayUsername.charAt(0).toUpperCase() : '?';

        html += `
            <div class="wechat-review-item" data-review-id="${r.id}">
                <div class="wechat-review-content-area">
                    <div class="wechat-review-header">
                        <div class="review-user-avatar">
                            <span class="review-avatar-circle">${userInitial}</span>
                            <span class="wechat-review-user">${escapeHtml(displayUsername)}</span>
                        </div>
                        <span class="wechat-review-date">${date}</span>
                    </div>
                    <div class="wechat-review-content">${escapeHtml(r.text)}</div>
                    <div class="wechat-comment-section" id="comments-${r.id}">
        `;

        // Display existing comments
        for (const c of r.comments) {
            const commentDate = new Date(c.timestamp).toLocaleDateString(
                currentLang === 'fr' ? 'fr-CA' : 'en-CA',
                { month: '2-digit', day: '2-digit' }
            );
            let commentUsername = c.username;
            if (currentUser && c.user_id === currentUser.id) {
                const currentDisplayName = currentUser.user_metadata?.display_name || 
                                           currentUser.email.split('@')[0];
                commentUsername = currentDisplayName;
            }
            const commentInitial = (commentUsername && commentUsername.length > 0) ? commentUsername.charAt(0).toUpperCase() : '?';
            html += `
                <div class="wechat-comment-item">
                    <div class="comment-user-avatar">
                        <span class="comment-avatar-circle">${commentInitial}</span>
                        <span class="wechat-comment-user">${escapeHtml(commentUsername)}</span>
                    </div>
                    <span class="wechat-comment-text">${escapeHtml(c.text)}</span>
                    <span class="wechat-comment-date">${commentDate}</span>
                </div>
            `;
        }

        // Comment input form
        if (currentUser) {
            html += `
                <div class="wechat-comment-form">
                    <input type="text" class="wechat-comment-input" placeholder="Write comment..." data-review-id="${r.id}">
                    <div class="comment-submit-wrapper">
                        <button class="wechat-comment-submit btn-post" data-review-id="${r.id}">Post comment</button>
                    </div>
                </div>
            `;
        } else {
            html += `<p class="login-prompt">${langPack[currentLang].loginPrompt}</p>`;
        }

        html += `</div></div>`;

        // Right side: share button only (comment button moved to below input)
        html += `
            <div class="wechat-review-footer">
                <button class="wechat-share-btn circle-icon" data-review-id="${r.id}" title="Share to WeChat">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        </div>`;
    }

    // Form to write a new review
    if (currentUser) {
        const currentDisplayName = currentUser.user_metadata?.display_name || 
                                   currentUser.email.split('@')[0];
        const currentUserInitial = currentDisplayName.charAt(0).toUpperCase();
        html += `
            <div class="review-form wechat-review-form">
                <div class="review-form-header">
                    <div class="review-user-avatar">
                        <span class="review-avatar-circle">${currentUserInitial}</span>
                        <span class="review-form-username">${escapeHtml(currentDisplayName)}</span>
                    </div>
                </div>
                <textarea class="review-textarea" placeholder="Write a review..."></textarea>
                <div class="review-submit-wrapper">
                    <button class="review-submit btn-post">Post review</button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// Simple XSS escape helper
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

export async function renderReviews(bookId, currentLang, currentUser) {
    await loadReviews();  // ensure fresh data
    if (!modalReviews) return;
    const bookReviews = reviews.filter(r => r.book_id === bookId);
    modalReviews.innerHTML = generateReviewsHTML(bookReviews, currentLang, currentUser);
    attachEventsToContainer(modalReviews, bookId, currentLang, currentUser);
}

export async function renderDetailReviews(bookId, currentLang, currentUser) {
    await loadReviews();  // ensure fresh data
    const detailReviews = document.getElementById('detailReviews');
    if (!detailReviews) return;
    const bookReviews = reviews.filter(r => r.book_id === bookId);
    detailReviews.innerHTML = generateReviewsHTML(bookReviews, currentLang, currentUser);
    attachEventsToContainer(detailReviews, bookId, currentLang, currentUser);
}

export function checkHashForReview() {
    if (window.location.hash.startsWith('#review-')) {
        const reviewId = window.location.hash.substring(8);
        const review = reviews.find(r => r.id === reviewId);
        if (review) {
            import('./data.js').then(({ books }) => {
                const book = books.find(b => b.id === review.book_id);
                if (book) {
                    window.dispatchEvent(new CustomEvent('hashReview', { detail: { book, reviewId } }));
                }
            });
        }
    }
}