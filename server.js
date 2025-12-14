const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initializeDatabase, userQueries, cardQueries, friendshipQueries, commentQueries } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors({
    origin: [
        'https://newyearbingo.netlify.app', // Your Netlify site
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize database
initializeDatabase();

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    });
}

// ============= AUTH ROUTES =============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user exists
        const existingUser = userQueries.findByEmail.get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = userQueries.create.run(name, email, hashedPassword);
        const userId = result.lastInsertRowid;

        // Generate token
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: userId, name, email }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = userQueries.findByEmail.get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = userQueries.findById.get(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============= USER ROUTES =============

// Search users
app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email query parameter required' });
        }

        const users = userQueries.searchByEmail.all(`%${email}%`);

        // Filter out current user
        const filteredUsers = users.filter(u => u.id !== req.user.userId);

        res.json({ users: filteredUsers });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Get all users (for available users list)
app.get('/api/users', authenticateToken, (req, res) => {
    try {
        const users = userQueries.getAll.all();

        // Filter out current user
        const filteredUsers = users.filter(u => u.id !== req.user.userId);

        res.json({ users: filteredUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// ============= BINGO CARD ROUTES =============

// Create or update bingo card
app.post('/api/cards', authenticateToken, (req, res) => {
    try {
        const { size, grid, completed } = req.body;

        if (!size || !grid || !completed) {
            return res.status(400).json({ error: 'Size, grid, and completed data are required' });
        }

        const gridData = JSON.stringify(grid);
        const completedData = JSON.stringify(completed);

        // Check if card exists
        const existingCard = cardQueries.findByUserId.get(req.user.userId);

        if (existingCard) {
            // Update existing card
            cardQueries.update.run(gridData, completedData, req.user.userId);
        } else {
            // Create new card
            cardQueries.create.run(req.user.userId, size, gridData, completedData);
        }

        res.json({ message: 'Bingo card saved successfully' });
    } catch (error) {
        console.error('Save card error:', error);
        res.status(500).json({ error: 'Failed to save bingo card' });
    }
});

// Get user's bingo card
app.get('/api/cards/me', authenticateToken, (req, res) => {
    try {
        const card = cardQueries.findByUserId.get(req.user.userId);
        if (!card) {
            return res.status(404).json({ error: 'No bingo card found' });
        }

        res.json({
            card: {
                size: card.size,
                grid: JSON.parse(card.grid_data),
                completed: JSON.parse(card.completed_data),
                createdAt: card.created_at,
                updatedAt: card.updated_at
            }
        });
    } catch (error) {
        console.error('Get card error:', error);
        res.status(500).json({ error: 'Failed to get bingo card' });
    }
});

// Get friend's bingo card
app.get('/api/cards/:userId', authenticateToken, (req, res) => {
    try {
        const friendId = parseInt(req.params.userId);

        // Check if they are friends
        const friendship = friendshipQueries.checkFriendship.get(
            req.user.userId, friendId,
            friendId, req.user.userId
        );

        if (!friendship || friendship.status !== 'accepted') {
            return res.status(403).json({ error: 'You can only view cards of accepted friends' });
        }

        const card = cardQueries.findByUserId.get(friendId);
        if (!card) {
            return res.status(404).json({ error: 'Friend has no bingo card' });
        }

        res.json({
            card: {
                size: card.size,
                grid: JSON.parse(card.grid_data),
                completed: JSON.parse(card.completed_data),
                createdAt: card.created_at,
                updatedAt: card.updated_at
            }
        });
    } catch (error) {
        console.error('Get friend card error:', error);
        res.status(500).json({ error: 'Failed to get friend bingo card' });
    }
});

// Delete bingo card
app.delete('/api/cards', authenticateToken, (req, res) => {
    try {
        cardQueries.delete.run(req.user.userId);
        res.json({ message: 'Bingo card deleted successfully' });
    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ error: 'Failed to delete bingo card' });
    }
});

// ============= FRIENDSHIP ROUTES =============

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
    try {
        const { friendEmail } = req.body;

        if (!friendEmail) {
            return res.status(400).json({ error: 'Friend email is required' });
        }

        // Find friend
        const friend = userQueries.findByEmail.get(friendEmail);
        if (!friend) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        if (friend.id === req.user.userId) {
            return res.status(400).json({ error: 'You cannot add yourself as a friend' });
        }

        // Check if friendship already exists
        const existing = friendshipQueries.checkFriendship.get(
            req.user.userId, friend.id,
            friend.id, req.user.userId
        );

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(409).json({ error: 'You are already friends' });
            } else {
                return res.status(409).json({ error: 'Friend request already sent' });
            }
        }

        // Create friend request
        friendshipQueries.create.run(req.user.userId, friend.id, 'pending');

        res.status(201).json({ message: 'Friend request sent successfully' });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

// Get pending friend requests
app.get('/api/friends/requests', authenticateToken, (req, res) => {
    try {
        const requests = friendshipQueries.getPendingRequests.all(req.user.userId);
        res.json({ requests });
    } catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Failed to get friend requests' });
    }
});

// Accept friend request
app.post('/api/friends/accept/:requestId', authenticateToken, (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);

        // Get request
        const request = friendshipQueries.findById.get(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        // Verify request is for current user
        if (request.user2_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update status
        friendshipQueries.updateStatus.run('accepted', requestId);

        res.json({ message: 'Friend request accepted' });
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});

// Get friends list
app.get('/api/friends', authenticateToken, (req, res) => {
    try {
        const friends = friendshipQueries.getFriends.all(
            req.user.userId,
            req.user.userId,
            req.user.userId,
            req.user.userId
        );

        res.json({ friends });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to get friends' });
    }
});

// Delete friend
app.delete('/api/friends/:friendshipId', authenticateToken, (req, res) => {
    try {
        const friendshipId = parseInt(req.params.friendshipId);

        // Verify friendship exists and user is part of it
        const friendship = friendshipQueries.findById.get(friendshipId);
        if (!friendship) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        if (friendship.user1_id !== req.user.userId && friendship.user2_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        friendshipQueries.delete.run(friendshipId);

        res.json({ message: 'Friendship deleted' });
    } catch (error) {
        console.error('Delete friendship error:', error);
        res.status(500).json({ error: 'Failed to delete friendship' });
    }
});

// ============= COMMENT ROUTES =============

// Create a comment on a friend's card
app.post('/api/comments', authenticateToken, async (req, res) => {
    try {
        const { targetUserId, row, col, text, isPrivate } = req.body;

        if (!targetUserId || row === undefined || col === undefined || !text) {
            return res.status(400).json({ error: 'targetUserId, row, col, and text are required' });
        }

        const authorId = req.user.userId;
        const targetId = parseInt(targetUserId);

        // Check if they are friends
        const friendship = friendshipQueries.checkFriendship.get(
            authorId, targetId,
            targetId, authorId
        );

        if (!friendship || friendship.status !== 'accepted') {
            return res.status(403).json({ error: "You can only comment on friends' cards" });
        }

        // Create comment
        const result = commentQueries.create.run(
            authorId,
            targetId,
            row,
            col,
            text,
            isPrivate ? 1 : 0
        );

        res.status(201).json({
            message: 'Comment added successfully',
            commentId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Get comments for a user's card
app.get('/api/comments/:userId', authenticateToken, (req, res) => {
    try {
        const targetUserId = parseInt(req.params.userId);
        const requesterId = req.user.userId;

        // Get all comments for this user
        const allComments = commentQueries.findByTargetUser.all(targetUserId);

        // Filter based on privacy:
        // - Show all public comments
        // - Show private comments only if requester is author or target
        const filteredComments = allComments.filter(comment => {
            if (!comment.is_private) {
                return true; // Public comments visible to all friends
            }
            // Private comments only visible to author and target
            return comment.author_id === requesterId || comment.target_user_id === requesterId;
        });

        res.json(filteredComments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Delete a comment (only by author)
app.delete('/api/comments/:commentId', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        // Get comment to verify ownership
        const comment = commentQueries.findById.get(commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author can delete
        if (comment.author_id !== req.user.userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        commentQueries.delete.run(commentId);

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============= HEALTH CHECK =============

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Bingo Card Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎉 Bingo Card Server running on port ${PORT}`);
    console.log(`📝 API available at http://localhost:${PORT}/api`);
});
