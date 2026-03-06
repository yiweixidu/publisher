// data.js
const DATA_KEYS = {
    BOOKS: 'acerBooks',
    NEWS: 'acerNews',
    USERS: 'acerUsers',
    REVIEWS: 'acerReviews'
};

// Default data
const defaultBooks = [
    { id: 'b1', title: '荒原·情歌 (The Waste Land / Love Song)', author: 'T.S. Eliot / Tao Zhijian (tr.)', price: '18.00', lang: 'en-zh', cover: 'zhijian/Image_20260305124559_31_399.jpg', isbn: '978-1-7381938-1-3', publisher: 'Acer Books', pubDate: 'March 15, 2024', pages: 160, language: 'Chinese-English', categories: ['American', 'Poetry'], description: 'A landmark translation of Eliot’s masterpiece, capturing the modernist spirit in Chinese.', authorBio: 'T.S. Eliot was a poet, essayist, publisher, playwright, and literary critic. Tao Zhijian is a translator and scholar based in Montreal.', format: 'Paperback' },
    { id: 'b2', title: '野花·繁星 (Wild Flowers & Bright Stars)', author: 'Tang Weibin (tr.)', price: '16.99', lang: 'en-zh', cover: 'zhijian/Image_20260305124602_33_399.jpg', isbn: '978-1-7381938-2-0', publisher: 'Acer Books', pubDate: 'April 10, 2024', pages: 200, language: 'Chinese-English', categories: ['European - English, Irish, Scottish, Welsh'], description: 'Classic English poems rendered into traditional Chinese forms, preserving rhyme and metre.', authorBio: 'Tang Weibin is a poet and translator specializing in classical Chinese poetry forms.', format: 'Paperback' },
    { id: 'b3', title: '心灵独白 (Voices from my Heart)', author: 'Li Yang', price: '21.00', lang: 'zh', cover: 'zhijian/Image_20260305124612_39_399.jpg', isbn: '978-1-7381938-3-7', publisher: 'Acer Books', pubDate: 'February 22, 2024', pages: 180, language: 'Chinese', categories: ['Poetry', 'Canadian'], description: 'An intimate collection of original Chinese poetry, reflecting on love, loss, and nature.', authorBio: 'Li Yang is a Montreal-based poet and member of the Chinese Writers Association in Quebec.', format: 'Paperback' },
    { id: 'b4', title: '从北极到南极 (From Arctic to Antarctic)', author: 'Wen Di', price: '18.00', lang: 'zh', cover: 'zhijian/Image_20260305124609_37_399.jpg', isbn: '978-1-7381938-4-4', publisher: 'Acer Books', pubDate: 'January 5, 2024', pages: 220, language: 'Chinese', categories: ['Travel', 'Photography'], description: 'A photographic and poetic journey across the hemispheres, with bilingual captions.', authorBio: 'Wen Di is a photographer and writer whose work explores the relationship between landscape and memory.', format: 'Paperback' },
    { id: 'b5', title: '诗意地居住在蒙特利尔 (Living Montreal Like a Poem)', author: 'Zhang Yuntao', price: '20.00', lang: 'en-zh', cover: 'zhijian/Image_20260305124605_35_399.jpg', isbn: '978-1-7381938-5-1', publisher: 'Acer Books', pubDate: 'May 18, 2024', pages: 190, language: 'Chinese-English', categories: ['Essays', 'Canadian'], description: 'Essays and images exploring Montreal’s creative life through a poetic lens.', authorBio: 'Zhang Yuntao is an essayist and photographer living in Montreal.', format: 'Paperback' },
    { id: 'b6', title: '英诗汉韵--译诗如诗探步: English Poems in Chinese Poetic Forms (Paperback)', author: 'By 陶志健 Tao Zhijian, 陶志健 (Translator)', price: '18.99', lang: 'en-zh', cover: 'zhijian/Image_20260305124610_38_399.jpg', isbn: '978-1-7381938-6-8', publisher: 'Acer Books', pubDate: 'March 17th, 2024', pages: 170, language: 'Chinese', categories: ['American', 'European - English, Irish, Scottish, Welsh', 'Canadian'], description: 'A masterful translation that bridges cultures. This edition presents the original text alongside the Chinese version, with insightful commentary.', authorBio: '陶志健 (Tao Zhijian) is a translator, scholar, and member of the Chinese Writers Association in Quebec. He founded Acer Books to promote cross-cultural literary exchange.', format: 'Paperback' },
    { id: 'b7', title: '枫吟唐韵 I', author: 'Ma Xinyun', price: '22.99', lang: 'zh', cover: 'zhijian/Image_20260305124607_36_399.jpg', isbn: '...', publisher: 'Acer Books', pubDate: '2024', pages: 200, language: 'Chinese', categories: ['General'], description: '...', authorBio: '...', format: 'Paperback' },
    { id: 'b8', title: '枫吟唐韵 II', author: 'Ma Xinyun', price: '22.00', lang: 'zh', cover: 'zhijian/Image_20260305130755_46_399.png', isbn: '...', publisher: 'Acer Books', pubDate: '2025', pages: 220, language: 'Chinese', categories: ['General'], description: '...', authorBio: '...', format: 'Paperback' },
];

const defaultNews = [
    {
        id: 'n1',
        date: 'June 15, 2024',
        title: {
            en: 'Acer Series launch',
            fr: 'Lancement de la série Acer'
        },
        summary: {
            en: 'Nine new titles presented at Hôtel Brossard, with over 80 readers and authors.',
            fr: 'Neuf nouveaux titres présentés à l’Hôtel Brossard, avec plus de 80 lecteurs et auteurs.'
        },
        image: 'zhijian/Image_20260305124446_29_399.jpg'
    },
    {
        id: 'n2',
        date: 'May 2024',
        title: {
            en: 'Now at Harvard Book Store',
            fr: 'Maintenant à la Harvard Book Store'
        },
        summary: {
            en: 'Tao Zhijian\'s translations of Eliot and anthologies available on Harvard\'s shelves.',
            fr: 'Les traductions d’Eliot par Tao Zhijian et les anthologies sont disponibles dans les rayons de Harvard.'
        },
        image: 'zhijian/Image_20260305124511_30_399.jpg'
    },
    {
        id: 'n3',
        date: 'Coming Oct 2024',
        title: {
            en: 'Montréal en lumière',
            fr: 'Montréal en lumière'
        },
        summary: {
            en: 'Acer Books will host a reading at the McCord Museum — photographers welcome.',
            fr: 'Acer Books organisera une lecture au Musée McCord — photographes bienvenus.'
        },
        image: 'zhijian/Image_20260305124431_28_399.jpg'
    }
];

const defaultUsers = [
    { id: 'u1', username: 'user', password: 'pass', displayName: 'Book Lover' }
];

// Load from localStorage or use defaults
function loadBooks() {
    const stored = localStorage.getItem(DATA_KEYS.BOOKS);
    return stored ? JSON.parse(stored) : defaultBooks;
}

function loadNews() {
    const stored = localStorage.getItem(DATA_KEYS.NEWS);
    return stored ? JSON.parse(stored) : defaultNews;
}

function loadUsers() {
    const stored = localStorage.getItem(DATA_KEYS.USERS);
    return stored ? JSON.parse(stored) : defaultUsers;
}

function loadReviews() {
    const stored = localStorage.getItem(DATA_KEYS.REVIEWS);
    return stored ? JSON.parse(stored) : [];
}

// Save functions
function saveBooks(books) {
    localStorage.setItem(DATA_KEYS.BOOKS, JSON.stringify(books));
}
function saveNews(news) {
    localStorage.setItem(DATA_KEYS.NEWS, JSON.stringify(news));
}
function saveUsers(users) {
    localStorage.setItem(DATA_KEYS.USERS, JSON.stringify(users));
}
function saveReviews(reviews) {
    localStorage.setItem(DATA_KEYS.REVIEWS, JSON.stringify(reviews));
}

// Export (in a browser environment, these become globals if we don't use modules)
window.DataService = {
    loadBooks,
    loadNews,
    loadUsers,
    loadReviews,
    saveBooks,
    saveNews,
    saveUsers,
    saveReviews
};