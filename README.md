# New Year's Resolution Bingo - Backend Server

A Node.js backend server with SQLite database for the New Year's Resolution Bingo card application.

## Features

- ✅ User authentication (register/login with JWT)
- ✅ Create and save bingo cards
- ✅ Friend system (send/accept requests)
- ✅ View friends' bingo cards
- ✅ Real-time progress tracking
- ✅ SQLite database (easy setup, no separate DB server needed)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit the `.env` file and change the JWT_SECRET:**
   ```bash
   # Generate a secure secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   
   # Copy the output and paste it in your .env file
   JWT_SECRET=<paste-your-generated-secret-here>
   ```

## Running the Server

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT specified in `.env`)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Users
- `GET /api/users` - Get all users (for friend discovery)
- `GET /api/users/search?email=<query>` - Search users by email

### Bingo Cards
- `POST /api/cards` - Create/update bingo card
- `GET /api/cards/me` - Get your bingo card
- `GET /api/cards/:userId` - Get friend's bingo card
- `DELETE /api/cards` - Delete your bingo card

### Friends
- `POST /api/friends/request` - Send friend request
- `GET /api/friends/requests` - Get pending friend requests
- `POST /api/friends/accept/:requestId` - Accept friend request
- `GET /api/friends` - Get friends list
- `DELETE /api/friends/:friendshipId` - Remove friend

### Health Check
- `GET /api/health` - Server health status

## Database

The server uses SQLite database (`bingo.db`) which is automatically created on first run. The database includes:

- **users** - User accounts
- **bingo_cards** - User bingo cards
- **friendships** - Friend relationships and requests

## Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

1. SSH into your server
2. Install Node.js
3. Clone/upload your code
4. Install dependencies: `npm install`
5. Create `.env` file with production settings
6. Use PM2 to keep server running:
   ```bash
   npm install -g pm2
   pm2 start server.js --name bingo-server
   pm2 startup
   pm2 save
   ```
7. Set up nginx as reverse proxy (optional but recommended)

### Option 2: Heroku

1. Create a Heroku account
2. Install Heroku CLI
3. In the server directory:
   ```bash
   heroku login
   heroku create your-app-name
   heroku config:set JWT_SECRET=your-secret-here
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

### Option 3: Railway.app (Easiest!)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js
5. Add environment variable: `JWT_SECRET=your-secret-here`
6. Deploy!

### Option 4: Render.com

1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variable: `JWT_SECRET`
7. Deploy!

## CORS Configuration

The server is configured to allow all origins (`cors()` middleware). For production, update this in `server.js`:

```javascript
app.use(cors({
    origin: 'https://your-frontend-domain.com'
}));
```

## Security Notes

⚠️ **IMPORTANT FOR PRODUCTION:**

1. **Change JWT_SECRET** - Generate a strong random secret
2. **Use HTTPS** - Always use HTTPS in production
3. **Set CORS properly** - Restrict to your frontend domain only
4. **Add rate limiting** - Install `express-rate-limit` to prevent abuse
5. **Input validation** - Consider adding validation library like `joi` or `express-validator`
6. **Environment variables** - Never commit `.env` file to Git

## Testing the API

You can test the API using curl, Postman, or any HTTP client:

```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get users (replace TOKEN with JWT from login)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### Port already in use
Change the PORT in your `.env` file or stop the process using port 3000:
```bash
# Find process
lsof -i :3000
# Kill process
kill -9 <PID>
```

### Database locked
Stop all running instances of the server and restart.

### Module not found
Make sure you ran `npm install` in the server directory.

## License

MIT License - Created by Michael C Yang

## Support

For issues or questions, please create an issue in the GitHub repository.
