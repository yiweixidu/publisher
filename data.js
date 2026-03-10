// data.js
import { DATA_KEYS } from './constants.js';

import { defaultAdmins } from './admins.js';

// Admin functions
function loadAdmins() {
    const stored = localStorage.getItem(DATA_KEYS.ADMIN);
    if (stored) {
        try {
            const data = JSON.parse(stored);
            return Array.isArray(data) ? data : [data];
        } catch (e) {
            return defaultAdmins;
        }
    } else {
        localStorage.setItem(DATA_KEYS.ADMIN, JSON.stringify(defaultAdmins));
        return defaultAdmins;
    }
}

function saveAdmins(admins) {
    localStorage.setItem(DATA_KEYS.ADMIN, JSON.stringify(admins));
}

// Default books
const defaultBooks = [
    { id: 'b1', title: '荒原·情歌 (The Waste Land / Love Song)', author: 'T.S. Eliot / Tao Zhijian (tr.)', price: '18.00', lang: 'en-zh', cover: '/publisher/zhijian/Image_20260305124559_31_399.jpg', isbn: '978-1-7381938-1-3', publisher: 'Acer Books', pubDate: 'March 15, 2024', pages: 160, language: 'Chinese-English', categories: ['American', 'Poetry'], description: 'A landmark translation of Eliot’s masterpiece, capturing the modernist spirit in Chinese.', authorBio: 'T.S. Eliot was a poet, essayist, publisher, playwright, and literary critic. Tao Zhijian is a translator and scholar based in Montreal.', format: 'Paperback' },
    { id: 'b2', title: '野花·繁星 (Wild Flowers & Bright Stars)', author: 'Tang Weibin (tr.)', price: '16.99', lang: 'en-zh', cover: '/publisher/zhijian/Image_20260305124602_33_399.jpg', isbn: '978-1-7381938-2-0', publisher: 'Acer Books', pubDate: 'April 10, 2024', pages: 200, language: 'Chinese-English', categories: ['European - English, Irish, Scottish, Welsh'], description: 'Classic English poems rendered into traditional Chinese forms, preserving rhyme and metre.', authorBio: 'Tang Weibin is a poet and translator specializing in classical Chinese poetry forms.', format: 'Paperback' },
    { id: 'b3', title: '心灵独白 (Voices from my Heart)', author: 'Li Yang', price: '21.00', lang: 'zh', cover: '/publisher/zhijian/Image_20260305124612_39_399.jpg', isbn: '978-1-7381938-3-7', publisher: 'Acer Books', pubDate: 'February 22, 2024', pages: 180, language: 'Chinese', categories: ['Poetry', 'Canadian'], description: 'An intimate collection of original Chinese poetry, reflecting on love, loss, and nature.', authorBio: 'Li Yang is a Montreal-based poet and member of the Chinese Writers Association in Quebec.', format: 'Paperback' },
    { id: 'b4', title: '从北极到南极 (From Arctic to Antarctic)', author: 'Wen Di', price: '18.00', lang: 'zh', cover: '/publisher/zhijian/Image_20260305124609_37_399.jpg', isbn: '978-1-7381938-4-4', publisher: 'Acer Books', pubDate: 'January 5, 2024', pages: 220, language: 'Chinese', categories: ['Travel', 'Photography'], description: 'A photographic and poetic journey across the hemispheres, with bilingual captions.', authorBio: 'Wen Di is a photographer and writer whose work explores the relationship between landscape and memory.', format: 'Paperback' },
    { id: 'b5', title: '诗意地居住在蒙特利尔 (Living Montreal Like a Poem)', author: 'Zhang Yuntao', price: '20.00', lang: 'en-zh', cover: '/publisher/zhijian/Image_20260305124605_35_399.jpg', isbn: '978-1-7381938-5-1', publisher: 'Acer Books', pubDate: 'May 18, 2024', pages: 190, language: 'Chinese-English', categories: ['Essays', 'Canadian'], description: 'Essays and images exploring Montreal’s creative life through a poetic lens.', authorBio: 'Zhang Yuntao is an essayist and photographer living in Montreal.', format: 'Paperback' },
    { id: 'b6', title: '英诗汉韵--译诗如诗探步 (English Poems in Chinese Poetic Forms)', author: 'By 陶志健 Tao Zhijian, 陶志健 (Translator)', price: '18.99', lang: 'en-zh', cover: '/publisher/zhijian/Image_20260305124610_38_399.jpg', isbn: '978-1-7381938-6-8', publisher: 'Acer Books', pubDate: 'March 17th, 2024', pages: 170, language: 'Chinese', categories: ['American', 'European - English, Irish, Scottish, Welsh', 'Canadian'], description: 'A masterful translation that bridges cultures. This edition presents the original text alongside the Chinese version, with insightful commentary.', authorBio: '陶志健 (Tao Zhijian) is a translator, scholar, and member of the Chinese Writers Association in Quebec. He founded Acer Books to promote cross-cultural literary exchange.', format: 'Paperback' },
    { id: 'b7', title: '枫吟唐韵 I  (Taditional Chinese Poetry from Yunxiang Club I)', author: 'Ma Xinyun, Tao Zhijian', price: '22.99', lang: 'zh', cover: '/publisher/zhijian/Image_20260305124607_36_399.jpg', isbn: '9781738193851', publisher: 'Acer Books', pubDate: 'March 30th, 2024', pages: 220, language: 'Chinese', categories: ['Anthologies (multiple authors)','Asian - Chinese','Canadian','Poetry'], description: '...', authorBio: '...', format: 'Paperback' },
    { id: 'b8', title: '枫吟唐韵 II (Taditional Chinese Poetry from Yunxiang Club II)', author: 'Ma Xinyun, Tao Zhijian', price: '22.00', lang: 'zh', cover: '/publisher/zhijian/Image_20260305130755_46_399.png', isbn: '9781069240828', publisher: 'Acer Books', pubDate: 'November 23rd, 2025', pages: 246, language: 'Chinese', categories: ['Anthologies (multiple authors)','Asian - Chinese','Canadian','Poetry'], description: '...', authorBio: '...', format: 'Paperback' },
];

const defaultReviews = [
    {
        id: 'r1',
        bookId: 'b4',
        userId: 'u1',
        username: 'Book Lover',
        text: 'A stunning visual journey. The bilingual captions add depth.',
        timestamp: '2025-02-10T14:30:00Z',
        likes: [],
        comments: []
    }
];

const defaultNews = [
    {
        id: 'n1',
        displayDate: 'June 15, 2024',
        timestamp: 1718467200000,
        title: { en: 'Acer Series launch', fr: 'Lancement de la série Acer' },
        summary: { en: 'Nine new titles presented at Hôtel Brossard, with over 80 readers and authors.', fr: 'Neuf nouveaux titres présentés à l’Hôtel Brossard, avec plus de 80 lecteurs et auteurs.' },
        image: '/publisher/zhijian/Image_20260305124446_29_399.jpg'
    },
    {
        id: 'n2',
        displayDate: 'May 2024',
        timestamp: 1718467200000,
        title: { en: 'Now at Harvard Book Store', fr: 'Maintenant à la Harvard Book Store' },
        summary: { en: 'Tao Zhijian\'s translations of Eliot and anthologies available on Harvard\'s shelves.', fr: 'Les traductions d’Eliot par Tao Zhijian et les anthologies sont disponibles dans les rayons de Harvard.' },
        image: '/publisher/zhijian/Image_20260305124511_30_399.jpg'
    },
    {
        id: 'n3',
        displayDate: 'Coming Oct 2024',
        timestamp: 1718467200000,
        title: { en: 'Montréal en lumière', fr: 'Montréal en lumière' },
        summary: { en: 'Acer Books will host a reading at the McCord Museum — photographers welcome.', fr: 'Acer Books organisera une lecture au Musée McCord — photographes bienvenus.' },
        image: '/publisher/zhijian/Image_20260305124431_28_399.jpg'
    }
];

const defaultUsers = [
    { id: 'u1', username: 'user', password: 'pass', displayName: 'Book Lover' }
];

// Load initial data
function loadFromStorage(key, defaultValue) {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
}

// Export live data variables
export let books = loadFromStorage(DATA_KEYS.BOOKS, defaultBooks);
export let newsItems = loadFromStorage(DATA_KEYS.NEWS, defaultNews);
export let users = loadFromStorage(DATA_KEYS.USERS, defaultUsers);
export let reviews = loadFromStorage(DATA_KEYS.REVIEWS, defaultReviews);

// Save functions (update both localStorage and exported variables)
export function saveBooks(newBooks) {
    books = newBooks;
    localStorage.setItem(DATA_KEYS.BOOKS, JSON.stringify(newBooks));
}

export function saveNews(newNews) {
    newsItems = newNews;
    localStorage.setItem(DATA_KEYS.NEWS, JSON.stringify(newNews));
}

export function saveUsers(newUsers) {
    users = newUsers;
    localStorage.setItem(DATA_KEYS.USERS, JSON.stringify(newUsers));
}

export function saveReviews(newReviews) {
    reviews = newReviews;
    localStorage.setItem(DATA_KEYS.REVIEWS, JSON.stringify(newReviews));
}

// Admin data functions
export function loadAdmin() {
    const admins = loadAdmins();
    return admins[0] || defaultAdmins[0];
}

export function saveAdmin(admin) {
    saveAdmins([admin]);
}

// For backward compatibility, we also export an object with all methods
export const DataService = {
    loadAdmins,
    saveAdmins,
    loadAdmin,
    saveAdmin,
    loadBooks: () => books,
    saveBooks,
    loadNews: () => newsItems,
    saveNews,
    loadUsers: () => users,
    saveUsers,
    loadReviews: () => reviews,
    saveReviews
};