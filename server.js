const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initializeDatabase, userQueries, cardQueries, friendshipQueries, commentQueries, reactionQueries, groupQueries, adminQueries } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
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
        const { name, username, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user exists
        const existingUser = userQueries.findByEmail.get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this email' });
        }

        // Check if username exists (if provided and query available)
        if (username && userQueries.findByUsername) {
            const existingUsername = userQueries.findByUsername.get(username);
            if (existingUsername) {
                return res.status(409).json({ error: 'Username already taken' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (with username only if query is available)
        let result;
        if (username && userQueries.createWithUsername) {
            result = userQueries.createWithUsername.run(name, username, email, hashedPassword);
        } else {
            result = userQueries.create.run(name, email, hashedPassword);
        }
        const userId = result.lastInsertRowid;

        // Generate token
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: userId, name, username: username || null, email }
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
            user: { 
                id: user.id, 
                name: user.name, 
                username: user.username || null, 
                email: user.email,
                is_admin: user.is_admin || 0
            }
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

// Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { name, username, email, password } = req.body;
        const userId = req.user.userId;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // Check if username is taken by another user (if username queries available)
        if (username && userQueries.findByUsername) {
            const existingUsername = userQueries.findByUsername.get(username);
            if (existingUsername && existingUsername.id !== userId) {
                return res.status(409).json({ error: 'Username already taken' });
            }
        }

        // Check if email is taken by another user
        const existingEmail = userQueries.findByEmail.get(email);
        if (existingEmail && existingEmail.id !== userId) {
            return res.status(409).json({ error: 'Email already taken' });
        }

        // Update user (check if profile update queries are available)
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            if (userQueries.updateWithPassword) {
                userQueries.updateWithPassword.run(name, username || null, email, hashedPassword, userId);
            } else {
                // Fallback: just update basic info without username
                return res.status(501).json({ error: 'Password update not supported yet. Please contact support.' });
            }
        } else {
            if (userQueries.updateProfile) {
                userQueries.updateProfile.run(name, username || null, email, userId);
            } else {
                // Fallback: inform user
                return res.status(501).json({ error: 'Profile update not fully supported yet. Please contact support.' });
            }
        }

        // Get updated user
        const updatedUser = userQueries.findById.get(userId);
        
        res.json({ 
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                username: updatedUser.username || null,
                email: updatedUser.email
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
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

// Clear all comments for user's card (when creating new card)
app.delete('/api/cards/clear', authenticateToken, (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Delete all comments where this user is the card owner
        const result = commentQueries.deleteByCardOwner 
            ? commentQueries.deleteByCardOwner.run(userId)
            : { changes: 0 };

        res.json({ 
            message: 'All comments cleared successfully',
            deletedCount: result.changes || 0
        });
    } catch (error) {
        console.error('Clear comments error:', error);
        res.status(500).json({ error: 'Failed to clear comments' });
    }
});

// Get friend's bingo card
app.get('/api/cards/:userId', authenticateToken, (req, res) => {
    try {
        const friendId = parseInt(req.params.userId);

        // Check if they are friends
        const friendship = friendshipQueries.checkFriendship.get(
            req.user.userId, friendId, friendId, req.user.userId
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
        res.status(500).json({ error: 'Failed to get bingo card' });
    }
});

// ============= FRIENDSHIP ROUTES =============

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
    try {
        const { friendEmail, friendUsername } = req.body;

        if (!friendEmail && !friendUsername) {
            return res.status(400).json({ error: 'Friend email or username required' });
        }

        // Find friend by email or username (if username query available)
        let friend;
        if (friendUsername && userQueries.findByUsername) {
            friend = userQueries.findByUsername.get(friendUsername);
        } 
        
        if (!friend && friendEmail) {
            friend = userQueries.findByEmail.get(friendEmail);
        }

        if (!friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (friend.id === req.user.userId) {
            return res.status(400).json({ error: 'You cannot add yourself as a friend' });
        }

        // Check if friendship already exists
        const existing = friendshipQueries.checkFriendship.get(
            req.user.userId, friend.id, friend.id, req.user.userId
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
            req.user.userId, req.user.userId, req.user.userId, req.user.userId
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

// Create a comment
app.post('/api/comments', authenticateToken, (req, res) => {
    try {
        const { cardOwnerId, row, col, text, isPrivate } = req.body;

        if (cardOwnerId === undefined || row === undefined || col === undefined || !text) {
            return res.status(400).json({ error: 'Card owner ID, row, col, and text are required' });
        }

        // If commenting on someone else's card, verify friendship
        if (cardOwnerId !== req.user.userId) {
            const friendship = friendshipQueries.checkFriendship.get(
                req.user.userId, cardOwnerId, cardOwnerId, req.user.userId
            );

            if (!friendship || friendship.status !== 'accepted') {
                return res.status(403).json({ error: 'You can only comment on friends\' cards' });
            }
        }

        // Create comment
        commentQueries.create.run(
            req.user.userId,
            cardOwnerId,
            row,
            col,
            text,
            isPrivate ? 1 : 0
        );

        res.status(201).json({ message: 'Comment added successfully' });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Get comments for a specific task
app.get('/api/comments/:cardOwnerId/:row/:col', authenticateToken, (req, res) => {
    try {
        const cardOwnerId = parseInt(req.params.cardOwnerId);
        const row = parseInt(req.params.row);
        const col = parseInt(req.params.col);

        // If viewing someone else's card, verify friendship
        if (cardOwnerId !== req.user.userId) {
            const friendship = friendshipQueries.checkFriendship.get(
                req.user.userId, cardOwnerId, cardOwnerId, req.user.userId
            );

            if (!friendship || friendship.status !== 'accepted') {
                return res.status(403).json({ error: 'You can only view comments on friends\' cards' });
            }
        }

        const comments = commentQueries.getByTask.all(cardOwnerId, row, col);

        // Filter private comments
        const filteredComments = comments.filter(comment => {
            // Show all comments if viewing own card
            if (cardOwnerId === req.user.userId) {
                return true;
            }
            // Show public comments and private comments authored by current user
            return !comment.is_private || comment.author_id === req.user.userId;
        });

        res.json({ comments: filteredComments });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Get all comments for a card
app.get('/api/comments/:cardOwnerId', authenticateToken, (req, res) => {
    try {
        const cardOwnerId = parseInt(req.params.cardOwnerId);

        // If viewing someone else's card, verify friendship
        if (cardOwnerId !== req.user.userId) {
            const friendship = friendshipQueries.checkFriendship.get(
                req.user.userId, cardOwnerId, cardOwnerId, req.user.userId
            );

            if (!friendship || friendship.status !== 'accepted') {
                return res.status(403).json({ error: 'You can only view comments on friends\' cards' });
            }
        }

        const comments = commentQueries.getByCard.all(cardOwnerId);

        // Filter private comments
        const filteredComments = comments.filter(comment => {
            // Show all comments if viewing own card
            if (cardOwnerId === req.user.userId) {
                return true;
            }
            // Show public comments and private comments authored by current user
            return !comment.is_private || comment.author_id === req.user.userId;
        });

        res.json({ comments: filteredComments });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Delete a comment (only your own)
app.delete('/api/comments/:commentId', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        const result = commentQueries.delete.run(commentId, req.user.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============= REACTION ROUTES =============

// Add reaction to a comment
app.post('/api/reactions', authenticateToken, (req, res) => {
    try {
        const { commentId, emoji } = req.body;

        if (!commentId || !emoji) {
            return res.status(400).json({ error: 'Comment ID and emoji are required' });
        }

        // Check if reaction already exists
        try {
            reactionQueries.create.run(commentId, req.user.userId, emoji);
            res.status(201).json({ message: 'Reaction added successfully' });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                return res.status(409).json({ error: 'You already reacted with this emoji' });
            }
            throw error;
        }
    } catch (error) {
        console.error('Add reaction error:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

// Remove reaction from a comment
app.delete('/api/reactions', authenticateToken, (req, res) => {
    try {
        const { commentId, emoji } = req.body;

        if (!commentId || !emoji) {
            return res.status(400).json({ error: 'Comment ID and emoji are required' });
        }

        const result = reactionQueries.delete.run(commentId, req.user.userId, emoji);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Reaction not found' });
        }

        res.json({ message: 'Reaction removed successfully' });
    } catch (error) {
        console.error('Remove reaction error:', error);
        res.status(500).json({ error: 'Failed to remove reaction' });
    }
});

// Get reactions for a comment
app.get('/api/reactions/:commentId', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        const reactions = reactionQueries.getByComment.all(commentId);

        // Group reactions by emoji
        const grouped = {};
        reactions.forEach(reaction => {
            if (!grouped[reaction.emoji]) {
                grouped[reaction.emoji] = [];
            }
            grouped[reaction.emoji].push(reaction.user_name);
        });

        res.json({ reactions: grouped });
    } catch (error) {
        console.error('Get reactions error:', error);
        res.status(500).json({ error: 'Failed to get reactions' });
    }
});

// ============= GROUP ROUTES =============

// Create a group
app.post('/api/groups', authenticateToken, (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Create group
        const result = groupQueries.create.run(name.trim(), req.user.userId);
        const groupId = result.lastInsertRowid;

        // Add creator as admin member
        groupQueries.addMember.run(groupId, req.user.userId, 'admin', 'accepted');

        res.status(201).json({ 
            message: 'Group created successfully',
            group: { id: groupId, name: name.trim() }
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Get user's groups
app.get('/api/groups', authenticateToken, (req, res) => {
    try {
        const groups = groupQueries.getUserGroups.all(req.user.userId);
        res.json({ groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});

// Get group details
app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        
        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.status !== 'accepted') {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        const group = groupQueries.findById.get(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json({ group: { ...group, role: membership.role } });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to get group' });
    }
});

// Invite friend to group
app.post('/api/groups/:groupId/invite', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { friendId } = req.body;

        if (!friendId) {
            return res.status(400).json({ error: 'Friend ID is required' });
        }

        // Check if user is admin of group
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can invite members' });
        }

        // Check if friend exists
        const friend = userQueries.findById.get(friendId);
        if (!friend) {
            return res.status(404).json({ error: 'Friend not found' });
        }

        // Check if already a member
        const existingMember = groupQueries.getMember.get(groupId, friendId);
        if (existingMember) {
            if (existingMember.status === 'accepted') {
                return res.status(409).json({ error: 'User is already a member' });
            } else {
                return res.status(409).json({ error: 'Invitation already sent' });
            }
        }

        // Add as pending member
        groupQueries.addMember.run(groupId, friendId, 'member', 'pending');

        res.status(201).json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Invite to group error:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Get pending group invitations
app.get('/api/groups/invitations/pending', authenticateToken, (req, res) => {
    try {
        const invitations = groupQueries.getPendingInvitations.all(req.user.userId);
        res.json({ invitations });
    } catch (error) {
        console.error('Get invitations error:', error);
        res.status(500).json({ error: 'Failed to get invitations' });
    }
});

// Accept group invitation
app.post('/api/groups/invitations/:invitationId/accept', authenticateToken, (req, res) => {
    try {
        const invitationId = parseInt(req.params.invitationId);

        // Get invitation
        const invitation = groupQueries.getMemberById.get(invitationId);
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify it's for current user
        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (invitation.status === 'accepted') {
            return res.status(400).json({ error: 'Invitation already accepted' });
        }

        // Accept invitation
        groupQueries.updateMemberStatus.run('accepted', invitationId);

        res.json({ message: 'Invitation accepted successfully' });
    } catch (error) {
        console.error('Accept invitation error:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Decline group invitation
app.delete('/api/groups/invitations/:invitationId', authenticateToken, (req, res) => {
    try {
        const invitationId = parseInt(req.params.invitationId);

        // Get invitation
        const invitation = groupQueries.getMemberById.get(invitationId);
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify it's for current user
        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Delete invitation
        groupQueries.removeMember.run(invitation.group_id, req.user.userId);

        res.json({ message: 'Invitation declined successfully' });
    } catch (error) {
        console.error('Decline invitation error:', error);
        res.status(500).json({ error: 'Failed to decline invitation' });
    }
});

// Get group members with leaderboard stats
app.get('/api/groups/:groupId/members', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.status !== 'accepted') {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Get all members
        const members = groupQueries.getGroupMembers.all(groupId);

        // Calculate stats for each member
        const membersWithStats = members.map(member => {
            const card = cardQueries.findByUserId.get(member.user_id);
            
            let completionPercentage = 0;
            let bingoCount = 0;

            if (card) {
                const completed = JSON.parse(card.completed_data);
                const grid = JSON.parse(card.grid_data);
                const size = card.size;

                // Calculate completion percentage
                const totalCells = size * size;
                const completedCells = completed.flat().filter(Boolean).length;
                completionPercentage = Math.round((completedCells / totalCells) * 100);

                // Calculate bingo count
                // Check rows
                for (let i = 0; i < size; i++) {
                    if (completed[i].every(Boolean)) bingoCount++;
                }
                // Check columns
                for (let j = 0; j < size; j++) {
                    if (completed.every(row => row[j])) bingoCount++;
                }
                // Check diagonals
                if (completed.every((row, i) => row[i])) bingoCount++;
                if (completed.every((row, i) => row[size - 1 - i])) bingoCount++;
            }

            return {
                id: member.user_id,
                name: member.user_name,
                email: member.user_email,
                role: member.role,
                completionPercentage,
                bingoCount,
                joinedAt: member.joined_at
            };
        });

        // Sort by completion percentage (highest first), then by bingo count
        membersWithStats.sort((a, b) => {
            if (b.completionPercentage !== a.completionPercentage) {
                return b.completionPercentage - a.completionPercentage;
            }
            return b.bingoCount - a.bingoCount;
        });

        res.json({ members: membersWithStats });
    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ error: 'Failed to get group members' });
    }
});

// Leave group
app.delete('/api/groups/:groupId/leave', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership) {
            return res.status(404).json({ error: 'You are not a member of this group' });
        }

        // Check if user is the last admin
        const group = groupQueries.findById.get(groupId);
        if (membership.role === 'admin') {
            const members = groupQueries.getGroupMembers.all(groupId);
            const adminCount = members.filter(m => m.role === 'admin').length;
            
            if (adminCount === 1 && members.length > 1) {
                return res.status(400).json({ error: 'Cannot leave: you are the only admin. Transfer admin role first or delete the group.' });
            }
        }

        // Remove member
        groupQueries.removeMember.run(groupId, req.user.userId);

        // If no members left, delete the group
        const remainingMembers = groupQueries.getGroupMembers.all(groupId);
        if (remainingMembers.length === 0) {
            groupQueries.delete.run(groupId);
        }

        res.json({ message: 'Left group successfully' });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
});

// Delete group (admin only)
app.delete('/api/groups/:groupId', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Check if user is admin
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete groups' });
        }

        groupQueries.delete.run(groupId);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

// ============= GROUP COMMENT ROUTES =============

// Post a group comment
app.post('/api/groups/:groupId/comments', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { text } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.status !== 'accepted') {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Create comment
        const result = groupQueries.createComment.run(groupId, req.user.userId, text.trim());

        res.status(201).json({ 
            message: 'Comment posted successfully',
            commentId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create group comment error:', error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// Get group comments
app.get('/api/groups/:groupId/comments', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.status !== 'accepted') {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        const comments = groupQueries.getComments.all(groupId);

        res.json({ comments });
    } catch (error) {
        console.error('Get group comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Delete group comment
app.delete('/api/groups/:groupId/comments/:commentId', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        const result = groupQueries.deleteComment.run(commentId, req.user.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete group comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Add reaction to group comment
app.post('/api/groups/:groupId/comments/:commentId/reactions', authenticateToken, (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const commentId = parseInt(req.params.commentId);
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ error: 'Emoji is required' });
        }

        // Check if user is a member
        const membership = groupQueries.getMember.get(groupId, req.user.userId);
        if (!membership || membership.status !== 'accepted') {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Add reaction
        try {
            groupQueries.createCommentReaction.run(commentId, req.user.userId, emoji);
            res.status(201).json({ message: 'Reaction added successfully' });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                return res.status(409).json({ error: 'You already reacted with this emoji' });
            }
            throw error;
        }
    } catch (error) {
        console.error('Add group comment reaction error:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

// Remove reaction from group comment
app.delete('/api/groups/:groupId/comments/:commentId/reactions', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ error: 'Emoji is required' });
        }

        const result = groupQueries.deleteCommentReaction.run(commentId, req.user.userId, emoji);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Reaction not found' });
        }

        res.json({ message: 'Reaction removed successfully' });
    } catch (error) {
        console.error('Remove group comment reaction error:', error);
        res.status(500).json({ error: 'Failed to remove reaction' });
    }
});

// Get reactions for group comment
app.get('/api/groups/:groupId/comments/:commentId/reactions', authenticateToken, (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        const reactions = groupQueries.getCommentReactions.all(commentId);

        // Group by emoji
        const grouped = {};
        reactions.forEach(reaction => {
            if (!grouped[reaction.emoji]) {
                grouped[reaction.emoji] = [];
            }
            grouped[reaction.emoji].push(reaction.user_name);
        });

        res.json({ reactions: grouped });
    } catch (error) {
        console.error('Get group comment reactions error:', error);
        res.status(500).json({ error: 'Failed to get reactions' });
    }
});

// ============= ADMIN ROUTES =============

// Admin authentication middleware
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Check if user is admin
        const adminCheck = adminQueries.isAdmin.get(user.userId);
        if (!adminCheck || !adminCheck.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        req.user = user;
        next();
    });
}

// Get admin dashboard analytics
app.get('/api/admin/analytics', authenticateAdmin, (req, res) => {
    try {
        const totalUsers = adminQueries.getTotalUsers.get();
        const totalCards = adminQueries.getTotalCards.get();
        const totalGroups = adminQueries.getTotalGroups.get();
        const totalComments = adminQueries.getTotalComments.get();
        const totalGroupComments = adminQueries.getTotalGroupComments.get();
        const recentUsers = adminQueries.getRecentUsers.all(10);
        
        res.json({
            analytics: {
                totalUsers: totalUsers.count,
                totalCards: totalCards.count,
                totalGroups: totalGroups.count,
                totalComments: totalComments.count + totalGroupComments.count,
                recentUsers
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    try {
        const users = adminQueries.getAllUsers.all();
        
        // Filter out admins from the list
        const regularUsers = users.filter(u => !u.is_admin);
        
        res.json({ users: regularUsers });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get specific user details including their bingo card (admin only)
app.get('/api/admin/users/:userId', authenticateAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Get user details
        const user = adminQueries.getUserById.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's bingo card
        let card = null;
        try {
            const cardData = cardQueries.findByUserId.get(userId);
            if (cardData) {
                card = {
                    size: cardData.size,
                    grid: JSON.parse(cardData.grid_data),
                    completed: JSON.parse(cardData.completed_data),
                    createdAt: cardData.created_at,
                    updatedAt: cardData.updated_at
                };
            }
        } catch (error) {
            console.error('Error loading user card:', error);
        }
        
        // Get user's groups
        let groups = [];
        try {
            groups = groupQueries.getUserGroups.all(userId);
        } catch (error) {
            console.error('Error loading user groups:', error);
        }
        
        // Get user's friends count
        let friendsCount = 0;
        try {
            const friends = friendshipQueries.getFriends.all(userId, userId, userId, userId);
            friendsCount = friends.length;
        } catch (error) {
            console.error('Error loading user friends:', error);
        }
        
        res.json({
            user: {
                ...user,
                card,
                groups,
                friendsCount
            }
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to get user details' });
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
