// utils.js — shared helpers
// Fix relative cover paths (DB stores e.g. "zhijian/image.jpg" → "/zhijian/image.jpg")
export function normalizeCover(cover) {
    if (!cover) return '';
    if (cover.startsWith('http') || cover.startsWith('/') || cover.startsWith('data:')) return cover;
    return '/' + cover;
}