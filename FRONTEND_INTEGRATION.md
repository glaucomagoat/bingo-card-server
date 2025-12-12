# Frontend Integration Guide

## How to Connect Your HTML File to the Backend Server

Since the HTML file is quite large, here's a guide to modify it to work with the backend server.

## Step 1: Add API Configuration

Add this at the beginning of your `<script>` section (right after `<script>`):

```javascript
// API Configuration
const API_URL = 'http://localhost:3000/api'; // Change to your deployed server URL
let authToken = localStorage.getItem('authToken');

// API Helper Function
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    
    return response.json();
}
```

## Step 2: Replace Storage Functions

### Replace `handleLogin`:
```javascript
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        currentUser = data.user;
        showMainApp();
        await loadUserData();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}
```

### Replace `handleSignup`:
```javascript
async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    try {
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        currentUser = data.user;
        showMainApp();
        await loadUserData();
    } catch (error) {
        alert('Signup failed: ' + error.message);
    }
}
```

### Replace `checkAuth`:
```javascript
async function checkAuth() {
    if (authToken) {
        try {
            const data = await apiCall('/auth/me');
            currentUser = data.user;
            showMainApp();
            await loadUserData();
        } catch (error) {
            console.log('Session expired');
            localStorage.removeItem('authToken');
            authToken = null;
        }
    }
}
```

### Replace `handleLogout`:
```javascript
function handleLogout() {
    currentUser = null;
    myBingoCard = null;
    authToken = null;
    localStorage.removeItem('authToken');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
}
```

### Replace `loadUserData`:
```javascript
async function loadUserData() {
    // Load bingo card
    try {
        const data = await apiCall('/cards/me');
        myBingoCard = data.card;
        renderMyCard();
    } catch (error) {
        console.log('No card found');
    }

    // Load friends
    await loadFriends();
}
```

### Replace `handleCreateCard`:
```javascript
async function handleCreateCard(e) {
    e.preventDefault();

    // ... existing code to collect tasks ...

    const grid = distributeTasksSmartly(allTasks, currentSize);

    myBingoCard = {
        size: currentSize,
        grid: grid,
        completed: Array(currentSize).fill(null).map(() => Array(currentSize).fill(false)),
    };

    // Save card
    try {
        await apiCall('/cards', {
            method: 'POST',
            body: JSON.stringify({
                size: myBingoCard.size,
                grid: myBingoCard.grid,
                completed: myBingoCard.completed
            })
        });
        alert('Bingo card created successfully!');
        switchView('myCard');
    } catch (error) {
        alert('Failed to save card: ' + error.message);
    }
}
```

### Replace the cell click handler in `renderMyCard`:
```javascript
// Inside renderMyCard, replace the cell click handler:
cells.forEach(cell => {
    cell.addEventListener('click', async () => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        myBingoCard.completed[row][col] = !myBingoCard.completed[row][col];
        
        try {
            await apiCall('/cards', {
                method: 'POST',
                body: JSON.stringify({
                    size: myBingoCard.size,
                    grid: myBingoCard.grid,
                    completed: myBingoCard.completed
                })
            });
            renderMyCard();
        } catch (error) {
            alert('Failed to save progress');
        }
    });
});
```

### Replace `handleAddFriend`:
```javascript
async function handleAddFriend() {
    const friendEmail = document.getElementById('friendEmail').value.trim();
    if (!friendEmail) {
        alert('Please enter an email address');
        return;
    }

    try {
        await apiCall('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ friendEmail })
        });
        alert('Friend request sent!');
        document.getElementById('friendEmail').value = '';
        await loadFriends();
    } catch (error) {
        alert('Failed to send friend request: ' + error.message);
    }
}
```

### Replace `loadFriends`:
```javascript
async function loadFriends() {
    // Load available users
    try {
        const data = await apiCall('/users');
        const users = data.users;
        
        const availableUsersList = document.getElementById('availableUsersList');
        if (users.length === 0) {
            availableUsersList.innerHTML = '<div class="empty-state"><p>No other users yet. Share the app with friends!</p></div>';
        } else {
            availableUsersList.innerHTML = users.map(user => `
                <div class="friend-item">
                    <div class="friend-info">
                        <div class="friend-avatar">${user.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div style="font-weight: 600;">${user.name}</div>
                            <div style="font-size: 0.85rem; opacity: 0.7;">${user.email}</div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="quickAddFriend('${user.email}')">
                        Add Friend
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }

    // Load friend requests
    try {
        const data = await apiCall('/friends/requests');
        const requests = data.requests;
        
        const requestsList = document.getElementById('friendRequestsList');
        if (requests.length === 0) {
            requestsList.innerHTML = '<div class="empty-state"><p>No pending friend requests</p></div>';
        } else {
            requestsList.innerHTML = requests.map(req => `
                <div class="friend-item">
                    <div class="friend-info">
                        <div class="friend-avatar">${req.from_name.charAt(0).toUpperCase()}</div>
                        <span>${req.from_name}</span>
                    </div>
                    <div>
                        <button class="btn btn-success btn-small" onclick="acceptFriend(${req.id})">Accept</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load requests:', error);
    }

    // Load friends list
    try {
        const data = await apiCall('/friends');
        const friends = data.friends;
        
        const friendsList = document.getElementById('friendsList');
        if (friends.length === 0) {
            friendsList.innerHTML = '<div class="empty-state"><p>No friends yet.</p></div>';
        } else {
            friendsList.innerHTML = friends.map(friend => `
                <div class="friend-item">
                    <div class="friend-info">
                        <div class="friend-avatar">${friend.friend_name.charAt(0).toUpperCase()}</div>
                        <span>${friend.friend_name}</span>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="viewFriendCard(${friend.friend_id}, '${friend.friend_name}')">
                        View Card
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load friends:', error);
    }
}
```

### Replace `acceptFriend`:
```javascript
async function acceptFriend(requestId) {
    try {
        await apiCall(`/friends/accept/${requestId}`, { method: 'POST' });
        alert('Friend request accepted!');
        await loadFriends();
    } catch (error) {
        alert('Failed to accept friend request: ' + error.message);
    }
}
```

### Replace `viewFriendCard`:
```javascript
async function viewFriendCard(friendId, friendName) {
    try {
        const data = await apiCall(`/cards/${friendId}`);
        const friendCard = data.card;
        const progress = calculateProgress(friendCard.completed);

        const html = `
            <h2>${friendName}'s Bingo Card</h2>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <p style="margin: 0.5rem 0; text-align: center;">${progress.toFixed(0)}% Complete</p>
            
            <div class="bingo-grid size-${friendCard.size}" style="margin-top: 2rem;">
                ${friendCard.grid.map((row, i) => 
                    row.map((cell, j) => `
                        <div class="bingo-cell ${cell.type} ${friendCard.completed[i][j] ? 'completed' : ''} readonly">
                            ${cell.text}
                        </div>
                    `).join('')
                ).join('')}
            </div>
            <div class="legend">
                <!-- legend items -->
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="switchView('friends')">Back to Friends</button>
            </div>
        `;

        document.getElementById('friendCardContent').innerHTML = html;
        document.querySelectorAll('.view-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById('friendCardView').classList.remove('hidden');
    } catch (error) {
        alert('Failed to load friend card: ' + error.message);
    }
}
```

## Step 3: Remove Old Storage Code

Delete these lines from the beginning of your script:
```javascript
// Remove this entire section:
const storage = window.storage || {
    async get(key, shared) { ... },
    async set(key, value, shared) { ... },
    async delete(key, shared) { ... },
    async list(prefix, shared) { ... }
};
```

Also remove references to localStorage.getItem('currentUser') and replace with authToken checks.

## Step 4: Update the Warning Message

Update the friends view warning to remove the "local storage only" message:

```html
<div class="info-box">
    <p>🌐 Your data is now stored on the server! You can access your bingo card from any device, and your friends can connect from anywhere.</p>
</div>
```

## Step 5: Update API_URL for Production

When you deploy your server, update the API_URL:
```javascript
const API_URL = 'https://your-server-domain.com/api';
```

## Complete! 

Your app will now work across different computers and browsers, with real friend functionality!
