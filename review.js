// review.js
import { reviews, insertReview, updateReview, loadReviews } from './data.js';
import { langPack } from './i18n.js';
import { supabase } from './supabaseClient.js';
import { currentUser, openLoginModal } from './auth.js';

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

async function attachEventsToContainer(container, bookId, currentLang, currentUser) {
    if (!container) return;

    // 分享按钮 (现在位于头部右侧)
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
                navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
                    .catch(() => fallbackCopy(review, shareUrl));
            } else {
                fallbackCopy(review, shareUrl);
            }
        });
    });

    // 删除书评
    container.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this review?')) return;
            const reviewId = btn.dataset.reviewId;
            const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
            if (error) {
                alert('Delete failed: ' + error.message);
                return;
            }
            await loadReviews();
            if (container === modalReviews) {
                await renderReviews(bookId, currentLang, currentUser);
            } else {
                await renderDetailReviews(bookId, currentLang, currentUser);
            }
        });
    });

    // 编辑书评
    container.querySelectorAll('.edit-review-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reviewId = btn.dataset.reviewId;
            const reviewDiv = container.querySelector(`.wechat-review-item[data-review-id="${reviewId}"]`);
            const contentDiv = reviewDiv.querySelector('.wechat-review-content');
            const oldText = contentDiv.innerText;
            // 替换为编辑框
            const editHtml = `
                <textarea class="edit-textarea" id="edit-review-${reviewId}">${escapeHtml(oldText)}</textarea>
                <div class="edit-actions">
                    <button class="save-review-edit btn-post" data-review-id="${reviewId}">Save</button>
                    <button class="cancel-review-edit btn-outline-red" data-review-id="${reviewId}">Cancel</button>
                </div>
            `;
            contentDiv.innerHTML = editHtml;
            // 保存
            const saveBtn = contentDiv.querySelector('.save-review-edit');
            const cancelBtn = contentDiv.querySelector('.cancel-review-edit');
            saveBtn.addEventListener('click', async () => {
                const newText = contentDiv.querySelector('textarea').value.trim();
                if (!newText) return;
                const review = reviews.find(r => r.id === reviewId);
                if (review) {
                    review.text = newText;
                    await updateReview(review);
                    await loadReviews();
                    if (container === modalReviews) {
                        await renderReviews(bookId, currentLang, currentUser);
                    } else {
                        await renderDetailReviews(bookId, currentLang, currentUser);
                    }
                }
            });
            cancelBtn.addEventListener('click', () => {
                contentDiv.innerHTML = escapeHtml(oldText);
            });
        });
    });

    // 提交评论
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
                const newComment = {
                    _id: Date.now() + Math.random().toString(36),
                    user_id: currentUser.id,
                    username: commenterName,
                    text: text,
                    timestamp: new Date().toISOString()
                };
                review.comments.push(newComment);
                await updateReview(review);
                await loadReviews();
                if (container === modalReviews) {
                    await renderReviews(bookId, currentLang, currentUser);
                } else {
                    await renderDetailReviews(bookId, currentLang, currentUser);
                }
                if (input) input.value = '';
            }
        });
    });

    // 删除评论
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this comment?')) return;
            const reviewId = btn.dataset.reviewId;
            const commentTs = btn.dataset.commentTs;
            const review = reviews.find(r => r.id === reviewId);
            if (review) {
                review.comments = review.comments.filter(c => c.timestamp != commentTs && c._id != commentTs);
                await updateReview(review);
                await loadReviews();
                if (container === modalReviews) {
                    await renderReviews(bookId, currentLang, currentUser);
                } else {
                    await renderDetailReviews(bookId, currentLang, currentUser);
                }
            }
        });
    });

    // 编辑评论
    container.querySelectorAll('.edit-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reviewId = btn.dataset.reviewId;
            const commentTs = btn.dataset.commentTs;
            const review = reviews.find(r => r.id === reviewId);
            const comment = review?.comments.find(c => c.timestamp == commentTs || c._id == commentTs);
            if (!comment) return;
            const commentElem = btn.closest('.wechat-comment-item');
            const textSpan = commentElem.querySelector('.wechat-comment-text');
            const oldText = textSpan.innerText;
            // 替换为编辑框
            const editHtml = `
                <textarea class="edit-textarea" style="width:100%">${escapeHtml(oldText)}</textarea>
                <div class="edit-actions">
                    <button class="save-comment-edit btn-post">Save</button>
                    <button class="cancel-comment-edit btn-outline-red">Cancel</button>
                </div>
            `;
            textSpan.innerHTML = editHtml;
            const saveBtn = textSpan.querySelector('.save-comment-edit');
            const cancelBtn = textSpan.querySelector('.cancel-comment-edit');
            saveBtn.addEventListener('click', async () => {
                const newText = textSpan.querySelector('textarea').value.trim();
                if (!newText) return;
                comment.text = newText;
                await updateReview(review);
                await loadReviews();
                if (container === modalReviews) {
                    await renderReviews(bookId, currentLang, currentUser);
                } else {
                    await renderDetailReviews(bookId, currentLang, currentUser);
                }
            });
            cancelBtn.addEventListener('click', () => {
                textSpan.innerHTML = escapeHtml(oldText);
            });
        });
    });

    // 提交新书评
    const submitReview = container.querySelector('.review-submit');
    if (submitReview && currentUser) {
        // 避免重复绑定
        submitReview.replaceWith(submitReview.cloneNode(true));
        const newSubmit = container.querySelector('.review-submit');
        newSubmit.addEventListener('click', async () => {
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
            await loadReviews();
            if (container === modalReviews) {
                await renderReviews(bookId, currentLang, currentUser);
            } else {
                await renderDetailReviews(bookId, currentLang, currentUser);
            }
            if (textarea) textarea.value = '';
        });
    }

    // 未登录时的“Login to comment”按钮
    container.querySelectorAll('.login-prompt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openLoginModal('user');
        });
    });
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
        const isOwnReview = currentUser && r.user_id === currentUser.id;
        if (isOwnReview) {
            const currentDisplayName = currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];
            displayUsername = currentDisplayName;
        }
        const userInitial = (displayUsername && displayUsername.length > 0) ? displayUsername.charAt(0).toUpperCase() : '?';

        html += `
            <div class="wechat-review-item" data-review-id="${r.id}">
                <div class="wechat-review-content-area">
                    <div class="wechat-review-header">
                        <div class="review-user-info">
                            <span class="review-avatar-circle">${userInitial}</span>
                            <span class="wechat-review-user">${escapeHtml(displayUsername)}</span>
                            <span class="wechat-review-date">${date}</span>
                        </div>
                        <div class="review-header-actions">
                            ${currentUser ? `<button class="wechat-share-btn icon-btn" data-review-id="${r.id}" title="Share">
                                <i class="fas fa-share-alt"></i>
                            </button>` : ''}
                            ${isOwnReview ? `
                                <button class="edit-review-btn icon-btn" data-review-id="${r.id}" title="Edit review">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="delete-review-btn icon-btn" data-review-id="${r.id}" title="Delete review">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="wechat-review-content" id="review-text-${r.id}">${escapeHtml(r.text)}</div>
                    <div class="wechat-comment-section" id="comments-${r.id}">
        `;

        // 显示现有评论
        for (const c of r.comments) {
            const commentDate = new Date(c.timestamp).toLocaleDateString(
                currentLang === 'fr' ? 'fr-CA' : 'en-CA',
                { month: '2-digit', day: '2-digit' }
            );
            let commentUsername = c.username;
            const isOwnComment = currentUser && c.user_id === currentUser.id;
            if (isOwnComment) {
                const currentDisplayName = currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];
                commentUsername = currentDisplayName;
            }
            const commentInitial = (commentUsername && commentUsername.length > 0) ? commentUsername.charAt(0).toUpperCase() : '?';
            html += `
                <div class="wechat-comment-item" data-comment-id="${c._id || c.timestamp}">
                    <div class="comment-user-avatar">
                        <span class="comment-avatar-circle">${commentInitial}</span>
                        <span class="wechat-comment-user">${escapeHtml(commentUsername)}</span>
                    </div>
                    <span class="wechat-comment-text" id="comment-text-${c.timestamp}">${escapeHtml(c.text)}</span>
                    <span class="wechat-comment-date">${commentDate}</span>
                    ${isOwnComment ? `
                        <div class="comment-actions-right">
                            <button class="edit-comment-btn icon-btn" data-review-id="${r.id}" data-comment-ts="${c.timestamp}"><i class="fas fa-edit"></i></button>
                            <button class="delete-comment-btn icon-btn" data-review-id="${r.id}" data-comment-ts="${c.timestamp}"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 评论输入表单（仅登录用户可见）
        if (currentUser) {
            html += `
                <div class="wechat-comment-form">
                    <textarea class="wechat-comment-input" placeholder="Write comment..." data-review-id="${r.id}" rows="2"></textarea>
                    <div class="comment-submit-wrapper">
                        <button class="wechat-comment-submit btn-post" data-review-id="${r.id}">Post comment</button>
                    </div>
                </div>
            `;
        } else {
            html += `<button class="btn-outline-red login-prompt-btn">${langPack[currentLang].loginPrompt}</button>`;
        }

        html += `</div></div>`; // 关闭 comment-section 和 content-area
        html += `</div>`; // 关闭 wechat-review-item
    }

    // 新书评表单（仅登录用户可见）
    if (currentUser) {
        const currentDisplayName = currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];
        const currentUserInitial = currentDisplayName.charAt(0).toUpperCase();
        html += `
            <div class="review-form wechat-review-form">
                <div class="review-form-header">
                    <div class="review-user-avatar">
                        <span class="review-avatar-circle">${currentUserInitial}</span>
                        <span class="review-form-username">${escapeHtml(currentDisplayName)}</span>
                    </div>
                </div>
                <textarea class="review-textarea" placeholder="Write a review..." rows="3"></textarea>
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