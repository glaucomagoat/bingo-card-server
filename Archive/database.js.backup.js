const Database = require('better-sqlite3');
const path = require('path');

// Create database connection
const db = new Database(path.join(__dirname, 'bingo.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database tables
function initializeDatabase() {
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

    console.log('Database initialized successfully');
}

// User queries
const userQueries = {
    create: db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)'),
    findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    findById: db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?'),
    getAll: db.prepare('SELECT id, name, email, created_at FROM users'),
    searchByEmail: db.prepare('SELECT id, name, email FROM users WHERE email LIKE ? LIMIT 10')
};

// Bingo card queries
const cardQueries = {
    create: db.prepare('INSERT INTO bingo_cards (user_id, size, grid_data, completed_data) VALUES (?, ?, ?, ?)'),
    update: db.prepare('UPDATE bingo_cards SET grid_data = ?, completed_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'),
    findByUserId: db.prepare('SELECT * FROM bingo_cards WHERE user_id = ?'),
    delete: db.prepare('DELETE FROM bingo_cards WHERE user_id = ?')
};

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

module.exports = {
    db,
    initializeDatabase,
    userQueries,
    cardQueries,
    friendshipQueries
};
