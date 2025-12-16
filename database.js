const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('📁 Current directory:', __dirname);
console.log('📁 Database will be created at:', path.join(__dirname, 'bingo.db'));

// Ensure directory is writable
try {
    fs.accessSync(__dirname, fs.constants.W_OK);
    console.log('✅ Directory is writable');
} catch (err) {
    console.error('❌ Directory is not writable:', err.message);
}

// Create database connection
const db = new Database(path.join(__dirname, 'bingo.db'), { verbose: console.log });

console.log('✅ Database connection established');

// Enable foreign keys
db.pragma('foreign_keys = ON');
console.log('✅ Foreign keys enabled');

// Initialize database tables
function initializeDatabase() {
    console.log('🔧 Starting database initialization...');
    
    try {
        // Users table
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created/verified');

        // Add username column if it doesn't exist - with better error handling
        try {
            // Check if column exists first
            const columns = db.pragma('table_info(users)');
            const hasUsername = columns.some(col => col.name === 'username');
            
            if (!hasUsername) {
                db.exec(`ALTER TABLE users ADD COLUMN username TEXT`);
                console.log('✅ Username column added to users table');
            } else {
                console.log('ℹ️  Username column already exists');
            }
        } catch (error) {
            console.error('⚠️  Error checking/adding username column:', error.message);
            // Don't crash - continue without username column
        }

        // Bingo cards table
        db.exec(`
            CREATE TABLE IF NOT EXISTS bingo_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                size INTEGER NOT NULL,
                grid_data TEXT NOT NULL,
                completed_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Bingo cards table created/verified');

        // Friendships table
        db.exec(`
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending', 'accepted')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user1_id, user2_id)
            )
        `);
        console.log('✅ Friendships table created/verified');

        // Comments table
        db.exec(`
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER NOT NULL,
                card_owner_id INTEGER NOT NULL,
                row INTEGER NOT NULL,
                col INTEGER NOT NULL,
                text TEXT NOT NULL,
                is_private BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (card_owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Comments table created/verified');

        // Reactions table
        db.exec(`
            CREATE TABLE IF NOT EXISTS reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comment_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                emoji TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(comment_id, user_id, emoji)
            )
        `);
        console.log('✅ Reactions table created/verified');

        // Verify tables exist
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log('📋 Tables in database:', tables.map(t => t.name).join(', '));

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// CRITICAL: Initialize tables BEFORE creating prepared statements
console.log('🚀 Initializing database tables...');
try {
    initializeDatabase();
} catch (error) {
    console.error('💥 FATAL: Failed to initialize database:', error);
    process.exit(1);
}

console.log('🔧 Creating prepared statements...');

// Check if username column exists for prepared statements
let hasUsernameColumn = false;
try {
    const columns = db.pragma('table_info(users)');
    hasUsernameColumn = columns.some(col => col.name === 'username');
    console.log('ℹ️  Username column available:', hasUsernameColumn);
} catch (error) {
    console.error('⚠️  Could not check username column:', error.message);
}

// User queries - create based on whether username column exists
const userQueries = {
    create: db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)'),
    findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    findById: hasUsernameColumn 
        ? db.prepare('SELECT id, name, username, email, created_at FROM users WHERE id = ?')
        : db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?'),
    getAll: hasUsernameColumn
        ? db.prepare('SELECT id, name, username, email, created_at FROM users')
        : db.prepare('SELECT id, name, email, created_at FROM users'),
    searchByEmail: hasUsernameColumn
        ? db.prepare('SELECT id, name, username, email FROM users WHERE email LIKE ? LIMIT 10')
        : db.prepare('SELECT id, name, email FROM users WHERE email LIKE ? LIMIT 10')
};

// Add username-specific queries only if column exists
if (hasUsernameColumn) {
    userQueries.findByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
    userQueries.createWithUsername = db.prepare('INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)');
    userQueries.updateProfile = db.prepare('UPDATE users SET name = ?, username = ?, email = ? WHERE id = ?');
    userQueries.updateWithPassword = db.prepare('UPDATE users SET name = ?, username = ?, email = ?, password = ? WHERE id = ?');
}

console.log('✅ User queries prepared');

// Bingo card queries
const cardQueries = {
    create: db.prepare('INSERT INTO bingo_cards (user_id, size, grid_data, completed_data) VALUES (?, ?, ?, ?)'),
    update: db.prepare('UPDATE bingo_cards SET grid_data = ?, completed_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'),
    findByUserId: db.prepare('SELECT * FROM bingo_cards WHERE user_id = ?'),
    delete: db.prepare('DELETE FROM bingo_cards WHERE user_id = ?')
};
console.log('✅ Card queries prepared');

// Friendship queries
const friendshipQueries = {
    create: db.prepare('INSERT INTO friendships (user1_id, user2_id, status) VALUES (?, ?, ?)'),
    updateStatus: db.prepare('UPDATE friendships SET status = ? WHERE id = ?'),
    getPendingRequests: db.prepare(`
        SELECT f.id, f.user1_id, f.created_at, u.name as from_name, u.email as from_email
        FROM friendships f
        JOIN users u ON f.user1_id = u.id
        WHERE f.user2_id = ? AND f.status = 'pending'
    `),
    getFriends: db.prepare(`
        SELECT DISTINCT
            CASE 
                WHEN f.user1_id = ? THEN f.user2_id 
                ELSE f.user1_id 
            END as friend_id,
            u.name as friend_name,
            u.email as friend_email
        FROM friendships f
        JOIN users u ON (
            CASE 
                WHEN f.user1_id = ? THEN f.user2_id 
                ELSE f.user1_id 
            END = u.id
        )
        WHERE (f.user1_id = ? OR f.user2_id = ?) AND f.status = 'accepted'
    `),
    checkFriendship: db.prepare(`
        SELECT * FROM friendships 
        WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
    `),
    findById: db.prepare('SELECT * FROM friendships WHERE id = ?'),
    delete: db.prepare('DELETE FROM friendships WHERE id = ?')
};
console.log('✅ Friendship queries prepared');

// Comment queries
const commentQueries = {
    create: db.prepare('INSERT INTO comments (author_id, card_owner_id, row, col, text, is_private) VALUES (?, ?, ?, ?, ?, ?)'),
    getByCard: db.prepare(`
        SELECT c.*, u.name as author_name
        FROM comments c
        JOIN users u ON c.author_id = u.id
        WHERE c.card_owner_id = ?
        ORDER BY c.created_at DESC
    `),
    getByTask: db.prepare(`
        SELECT c.*, u.name as author_name
        FROM comments c
        JOIN users u ON c.author_id = u.id
        WHERE c.card_owner_id = ? AND c.row = ? AND c.col = ?
        ORDER BY c.created_at DESC
    `),
    delete: db.prepare('DELETE FROM comments WHERE id = ? AND author_id = ?'),
    deleteByCardOwner: db.prepare('DELETE FROM comments WHERE card_owner_id = ?')
};
console.log('✅ Comment queries prepared');

// Reaction queries
const reactionQueries = {
    create: db.prepare('INSERT INTO reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)'),
    delete: db.prepare('DELETE FROM reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?'),
    getByComment: db.prepare(`
        SELECT r.*, u.name as user_name
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.comment_id = ?
        ORDER BY r.created_at ASC
    `),
    getByCard: db.prepare(`
        SELECT r.*, u.name as user_name, c.row, c.col
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        JOIN comments c ON r.comment_id = c.id
        WHERE c.card_owner_id = ?
        ORDER BY r.created_at DESC
    `)
};
console.log('✅ Reaction queries prepared');

console.log('🎉 Database module loaded successfully');

module.exports = {
    db,
    initializeDatabase,
    userQueries,
    cardQueries,
    friendshipQueries,
    commentQueries,
    reactionQueries
};
