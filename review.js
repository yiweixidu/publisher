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

// ── Review card image generation ────────────────────────────────────────────
const SUPABASE_PROJECT_URL = 'https://asjiiftlxyihlayydfju.supabase.co';
const OG_BUCKET            = 'og-images';
const OG_FUNCTION_URL      = `${SUPABASE_PROJECT_URL}/functions/v1/og-card`;

/** Load an <img> element, resolve after load or timeout (3 s). */
function loadImage(img, src) {
    return new Promise(resolve => {
        img.onload  = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 3000);
        img.src = src;
    });
}

/** Wrap text in canvas — handles CJK (no-space) and Latin (space-split) text. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
    const cjkRatio = (text.match(/[　-鿿가-힯]/g) || []).length / Math.max(text.length, 1);
    const lines = [];
    let line = '';
    const chars = cjkRatio > 0.3 ? [...text] : text.split(/(\s+)/);
    for (const token of chars) {
        const test = line + token;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = token.trim ? token.trim() : token;
            if (lines.length >= maxLines - 1) { line += '…'; break; }
        } else { line = test; }
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return Math.min(lines.length, maxLines);
}

/** Draw rounded rectangle (polyfill for older browsers). */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/** Draw read-only star row on canvas. */
function drawStars(ctx, x, y, rating, size) {
    const filled = Math.round(Math.max(1, Math.min(5, rating)));
    ctx.font = `${size}px Arial`;
    for (let i = 1; i <= 5; i++) {
        ctx.fillStyle = i <= filled ? '#ff0000' : '#dddddd';
        ctx.fillText(i <= filled ? '★' : '☆', x + (i - 1) * (size + 4), y);
    }
}

/**
 * Draw the 1200×630 review share card onto a Canvas element and return it.
 * All drawing is synchronous after image loads finish.
 */
async function generateReviewCardCanvas(review, book) {
    const W = 1200, H = 630, LEFT = 400;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONTS = '"PingFang SC","Microsoft YaHei","Noto Sans SC",Georgia,serif';
    const RED   = '#ff0000';
    const DARK  = '#1a1a1a';
    const GRAY  = '#888888';
    const MID   = '#444444';

    // ── White background ──────────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ── Left panel dark bg ────────────────────────────────────────────────────
    ctx.fillStyle = '#140000';
    ctx.fillRect(0, 0, LEFT, H);

    // ── Book cover ────────────────────────────────────────────────────────────
    if (book?.cover) {
        const src = book.cover.startsWith('http') ? book.cover
                  : `https://acerbooks.ca${book.cover.startsWith('/') ? '' : '/'}${book.cover}`;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await loadImage(img, src);
        if (img.naturalHeight > 0) {
            const maxW = 340, maxH = 520;
            let cw = img.naturalWidth, ch = img.naturalHeight;
            if (cw / ch > maxW / maxH) { cw = maxW; ch = maxW * img.naturalHeight / img.naturalWidth; }
            else                        { ch = maxH; cw = maxH * img.naturalWidth / img.naturalHeight; }
            ctx.drawImage(img, (LEFT - cw) / 2, (H - ch) / 2, cw, ch);
        }
    }

    // ── 4 px red divider ──────────────────────────────────────────────────────
    ctx.fillStyle = RED;
    ctx.fillRect(LEFT - 4, 0, 4, H);

    // ── Right panel ───────────────────────────────────────────────────────────
    const RX = LEFT + 40;   // right panel left margin
    const RW = W - RX - 40; // usable width

    // Brand row — logo image
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    await loadImage(logo, 'https://acerbooks.ca/zhijian/Image_20260305124426_25_399.png');
    if (logo.naturalHeight > 0) ctx.drawImage(logo, RX, 24, 44, 44);

    ctx.fillStyle = DARK;
    ctx.font = `bold 20px ${FONTS}`;
    ctx.fillText('ACER BOOKS', RX + 54, 52);

    // "READER REVIEW" pill badge (right side)
    ctx.fillStyle = RED;
    roundRect(ctx, W - 240, 26, 200, 34, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 14px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('READER REVIEW', W - 140, 48);
    ctx.textAlign = 'left';

    // Separator line
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(RX, 82); ctx.lineTo(W - 40, 82); ctx.stroke();

    // Book title
    let curY = 130;
    ctx.fillStyle = DARK;
    ctx.font = `bold 30px ${FONTS}`;
    const titleLines = wrapText(ctx, book?.title || '', RX, curY, RW, 38, 2);
    curY += titleLines * 38 + 8;

    // Author
    ctx.fillStyle = GRAY;
    ctx.font = `italic 17px ${FONTS}`;
    ctx.fillText(`by ${book?.author || ''}`, RX, curY);
    curY += 32;

    // Stars (if rated)
    if (review.rating) {
        drawStars(ctx, RX, curY, review.rating, 22);
        curY += 36;
    }

    // Red left-bar accent
    ctx.fillStyle = RED;
    ctx.fillRect(RX, curY, 4, 3);
    curY += 18;

    // Review excerpt (italic, dark gray)
    ctx.fillStyle = MID;
    ctx.font = `italic 18px ${FONTS}`;
    const excerpt = `"${review.text.substring(0, 220)}${review.text.length > 220 ? '…' : ''}"`;
    const exLines = wrapText(ctx, excerpt, RX, curY, RW, 30, 4);
    curY += exLines * 30 + 20;

    // Reviewer avatar circle
    const avatarX = RX, avatarY = Math.min(curY + 8, H - 95);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(avatarX + 18, avatarY + 18, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText((review.username || '?').charAt(0).toUpperCase(), avatarX + 18, avatarY + 23);
    ctx.textAlign = 'left';

    // Reviewer name + date
    ctx.fillStyle = DARK;
    ctx.font = `bold 15px ${FONTS}`;
    ctx.fillText(review.username || '', avatarX + 44, avatarY + 14);
    ctx.fillStyle = GRAY;
    ctx.font = `13px Arial`;
    const dateStr = new Date(review.timestamp).toLocaleDateString('en-CA', {year:'numeric', month:'short', day:'numeric'});
    ctx.fillText(dateStr, avatarX + 44, avatarY + 32);

    // acerbooks.ca branding (bottom right)
    ctx.fillStyle = RED;
    ctx.font = `bold 15px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText('acerbooks.ca', W - 40, H - 20);
    ctx.textAlign = 'left';

    // ── WeChat 1:1 safe-zone stripe ───────────────────────────────────────────
    // WeChat crops the center 630×630 (x:285–915). To ensure the review identity
    // is always visible, draw a subtle branded stripe across that zone.
    // This stripe sits at vertical center (y:280–350) and is always within the crop.
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(285, 280, 630, 70);
    ctx.globalAlpha = 1;
    // Red left accent
    ctx.fillStyle = RED;
    ctx.fillRect(285, 280, 5, 70);
    // Book title (truncated) in stripe
    ctx.fillStyle = DARK;
    ctx.font = `bold 20px ${FONTS}`;
    const stripeTitle = (book?.title || '').length > 28
        ? (book?.title || '').substring(0, 28) + '…'
        : (book?.title || '');
    ctx.fillText(stripeTitle, 300, 309);
    // Reviewer + "REVIEW" label
    ctx.fillStyle = GRAY;
    ctx.font = `14px Arial`;
    ctx.fillText(`${review.username || ''} · Reader Review · acerbooks.ca`, 300, 335);
    // Stars in stripe (if rated)
    if (review.rating) {
        ctx.font = '18px Arial';
        for (let i = 1; i <= 5; i++) {
            ctx.fillStyle = i <= review.rating ? RED : '#cccccc';
            ctx.fillText(i <= review.rating ? '★' : '☆', 295 + (i - 1) * 24, 358);
        }
    }
    ctx.restore();

    return canvas;
}

/**
 * Check Storage for a cached card, generate + upload if missing.
 * Returns the Supabase Edge Function URL for this review (used as share URL).
 */
async function getReviewShareUrl(review, book) {
    const imgPath = `reviews/${review.id}.png`;

    // Check if PNG already cached.
    // Supabase Storage bug: returns HTTP 400 with body {"statusCode":"404"} for missing files.
    // So we must parse the body, not rely on check.ok.
    try {
        const publicImgUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${OG_BUCKET}/reviews/${review.id}.png`;
        const check = await fetch(publicImgUrl, { method: 'GET' });
        if (check.ok) {
            return `${OG_FUNCTION_URL}?rid=${review.id}`; // file exists
        }
        // Parse body to distinguish "not found" from a real error
        const body = await check.json().catch(() => ({}));
        const notFound = body.error === 'not_found' || body.statusCode === '404' || String(body.statusCode) === '404';
        if (!notFound) {
            // Unexpected error — skip upload, just return function URL
            console.warn('Storage check unexpected response:', check.status, body);
            return `${OG_FUNCTION_URL}?rid=${review.id}`;
        }
        // notFound === true → proceed to generate and upload
    } catch(_) { /* proceed to generate */ }

    // Generate
    if (!book) return `${OG_FUNCTION_URL}?rid=${review.id}`;
    try {
        const canvas = await generateReviewCardCanvas(review, book);
        const blob   = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            // Canvas was tainted by a cross-origin cover image — retry without cover
            console.warn('Canvas tainted (CORS on cover). Retrying without cover image.');
            const canvas2 = await generateReviewCardCanvas(review, { ...book, cover: null });
            const blob2   = await new Promise(resolve => canvas2.toBlob(resolve, 'image/png'));
            if (!blob2) throw new Error('toBlob returned null even without cover');
            await supabase.storage
                .from(OG_BUCKET)
                .upload(imgPath, blob2, { contentType: 'image/png', upsert: true });
        } else {
            await supabase.storage
                .from(OG_BUCKET)
                .upload(imgPath, blob, { contentType: 'image/png', upsert: true });
        }
    } catch(err) {
        console.warn('Card upload failed (non-fatal):', err.message);
    }

    return `${OG_FUNCTION_URL}?rid=${review.id}`;
}

// 自定义分享弹窗
function showShareModal(reviewId, reviewText, reviewUsername, shareUrl) {
    // 移除已有的弹窗
    const existingModal = document.getElementById('customShareModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="customShareModal" class="share-modal-overlay">
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <span>Share via</span>
                    <button class="share-modal-close">&times;</button>
                </div>
                <div class="share-options">
                    <button class="share-option" data-platform="facebook">
                        <i class="fab fa-facebook-f"></i> Facebook
                    </button>
                    <button class="share-option" data-platform="twitter">
                        <i class="fab fa-twitter"></i> X (Twitter)
                    </button>
                    <button class="share-option" data-platform="instagram">
                        <i class="fab fa-instagram"></i> Instagram
                    </button>
                    <button class="share-option" data-platform="wechat">
                        <i class="fab fa-weixin"></i> WeChat
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('customShareModal');
    const closeBtn = modal.querySelector('.share-modal-close');
    const overlay = modal;

    closeBtn.addEventListener('click', () => modal.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) modal.remove();
    });

    // 处理各平台分享
    modal.querySelectorAll('.share-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const platform = btn.dataset.platform;
            let shareLink = '';
            const encodedUrl = encodeURIComponent(shareUrl);
            const encodedText = encodeURIComponent(reviewText.substring(0, 200));

            switch (platform) {
                case 'facebook':
                    shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                    window.open(shareLink, '_blank', 'width=600,height=400');
                    break;
                case 'twitter':
                    shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                    window.open(shareLink, '_blank', 'width=600,height=400');
                    break;
                case 'instagram':
                    // Instagram 没有直接的分享 URL，复制链接并提示
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        alert('Link copied! Please open Instagram and paste to share.');
                    }).catch(() => {
                        alert('Please copy the link: ' + shareUrl);
                    });
                    break;
                case 'wechat':
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        alert('Link copied! Please open WeChat and paste to a chat or Moments.');
                    }).catch(() => {
                        alert('Please copy the link: ' + shareUrl);
                    });
                    break;
            }
            modal.remove();
        });
    });
}

async function attachEventsToContainer(container, bookId, currentLang, currentUser) {
    if (!container) return;

    // 分享按钮 (自定义弹窗)
    container.querySelectorAll('.wechat-share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reviewId = btn.dataset.reviewId;
            const review   = reviews.find(r => r.id === reviewId);
            if (!review) return;

            // Show spinner while generating card
            const icon = btn.querySelector('i');
            const origClass = icon?.className || 'fas fa-share-alt';
            if (icon) icon.className = 'fas fa-spinner fa-spin';
            btn.disabled = true;

            let shareUrl;
            try {
                const { books: allBooks } = await import('./data.js');
                const book = allBooks.find(b => b.id === review.book_id);
                shareUrl = await getReviewShareUrl(review, book);
            } catch(err) {
                console.warn('getReviewShareUrl failed:', err);
                // Fallback: plain anchor URL
                const { toSlugAsync } = await import('./routing.js');
                const { books: allBooks } = await import('./data.js');
                const book = allBooks.find(b => b.id === review.book_id);
                const slug = book ? await toSlugAsync(book.title) : 'book';
                shareUrl = `${window.location.origin}/book/${slug}#review-${reviewId}`;
            } finally {
                if (icon) icon.className = origClass;
                btn.disabled = false;
            }

            showShareModal(reviewId, review.text, review.username, shareUrl);
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
            const currentReview = reviews.find(r => r.id === reviewId);
            const editHtml = `
                ${renderStarSelector(currentReview?.rating || 0)}
                <textarea class="edit-textarea" id="edit-review-${reviewId}">${escapeHtml(oldText)}</textarea>
                <div class="edit-actions">
                    <button class="save-review-edit btn-post" data-review-id="${reviewId}">Save</button>
                    <button class="cancel-review-edit btn-outline-red" data-review-id="${reviewId}">Cancel</button>
                </div>
            `;
            contentDiv.innerHTML = editHtml;
            bindStarSelector(contentDiv.querySelector('.star-selector'));
            // 保存
            const saveBtn = contentDiv.querySelector('.save-review-edit');
            const cancelBtn = contentDiv.querySelector('.cancel-review-edit');
            saveBtn.addEventListener('click', async () => {
                const newText = contentDiv.querySelector('textarea').value.trim();
                if (!newText) return;
                const review = reviews.find(r => r.id === reviewId);
                if (review) {
                    review.text = newText;
                    const newRating = parseInt(contentDiv.querySelector('.star-selector')?.dataset.rating) || null;
                    review.rating = newRating;
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

    // Bind star selector for the new review form
    bindStarSelector(container.querySelector('.review-form .star-selector'));

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
            const rating = parseInt(container.querySelector('.review-form .star-selector')?.dataset.rating) || null;
            const displayName = await getUserDisplayName(currentUser.id);
            const newReview = {
                id: 'rev_' + Date.now() + Math.random().toString(36).substr(2, 6),
                book_id: bookId,
                user_id: currentUser.id,
                username: displayName,
                text: text,
                rating: rating,
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

    // 未登录时的“Login to review”按钮
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
                    ${renderStars(r.rating)}
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
            const loginPromptText = currentLang === 'fr' ? 'Connectez-vous pour laisser un avis' : 'Login to review';
            html += `<button class="btn-outline-red login-prompt-btn">${loginPromptText}</button>`;
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
                ${renderStarSelector(0)}
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

// ── Star rating helpers ──────────────────────────────────────────────────────
const STAR_LABELS = ['', 'Disappointing', 'Fair', 'Good', 'Great', 'Excellent'];

// Read-only star display (rating 0 = hidden)
function renderStars(rating) {
    if (!rating || rating < 1) return '';
    const r = Math.min(5, Math.max(1, Math.round(rating)));
    let html = `<div class="review-stars" title="${r}/5 — ${STAR_LABELS[r]}">`;
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= r ? 'filled' : 'empty'}">${i <= r ? '&#9733;' : '&#9734;'}</span>`;
    }
    html += `</div>`;
    return html;
}

// Interactive star selector for forms
function renderStarSelector(currentRating = 0) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= currentRating;
        stars += `<span class="star-pick${filled ? ' filled' : ''}" data-val="${i}">${filled ? '&#9733;' : '&#9734;'}</span>`;
    }
    return `<div class="star-selector" data-rating="${currentRating}">
        ${stars}
        <span class="star-hint">${STAR_LABELS[currentRating] || 'Select rating (optional)'}</span>
    </div>`;
}

// Bind hover + click events on a .star-selector element
function bindStarSelector(el) {
    if (!el) return;
    const picks = el.querySelectorAll('.star-pick');
    const hint  = el.querySelector('.star-hint');
    function paint(val, persist) {
        picks.forEach(p => {
            const v = parseInt(p.dataset.val);
            const on = v <= val;
            p.innerHTML = on ? '&#9733;' : '&#9734;';
            p.classList.toggle('filled', on);
        });
        if (hint) hint.textContent = STAR_LABELS[val] || 'Select rating (optional)';
        if (persist) el.dataset.rating = val;
    }
    picks.forEach(p => {
        p.addEventListener('mouseenter', () => paint(parseInt(p.dataset.val), false));
        p.addEventListener('mouseleave', () => paint(parseInt(el.dataset.rating) || 0, false));
        p.addEventListener('click',      () => paint(parseInt(p.dataset.val), true));
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