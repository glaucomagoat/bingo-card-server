# 🎉 New Year's Resolution Bingo - Complete Setup Guide

## What You Got

I've created a complete backend server solution for your Bingo Card app! Now it will work across different computers and the friend system will function properly.

## Files Included

```
server/
├── package.json          # Node.js dependencies
├── server.js            # Main Express server with all API endpoints
├── database.js          # SQLite database setup and queries
├── .env.example         # Environment variables template
├── README.md            # Detailed server documentation
└── FRONTEND_INTEGRATION.md  # Guide to connect your HTML to the server
```

## Quick Start (5 Minutes)

### 1. Install Node.js
If you don't have Node.js installed:
- Go to https://nodejs.org
- Download and install the LTS version

### 2. Set Up the Server

```bash
# Navigate to the server folder
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and change JWT_SECRET (important!)
# You can generate a secure secret with:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Start the server
npm start
```

You should see:
```
🎉 Bingo Card Server running on port 3000
📝 API available at http://localhost:3000/api
```

### 3. Update Your HTML File

Follow the instructions in `FRONTEND_INTEGRATION.md` to connect your HTML file to the backend.

**Key changes needed:**
1. Add API configuration at the top of your script
2. Replace all storage functions with API calls
3. Update the friends view message

### 4. Test It!

1. Open your updated HTML file in a browser
2. Register a new account
3. Create a bingo card
4. Have a friend (on a different computer!) visit your site
5. They register an account
6. You can now add each other as friends! 🎉

## Deployment (Going Live)

### Easiest Option: Railway.app (FREE!)

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository (you'll need to push the server folder to GitHub)
5. Add environment variable: `JWT_SECRET` (your secret key)
6. Railway will give you a URL like `https://your-app.railway.app`
7. Update your HTML file's `API_URL` to this Railway URL

### Alternative Options:

- **Render.com** - Also free, similar to Railway
- **Heroku** - Free tier available
- **DigitalOcean** - $5/month droplet
- **Your own server** - If you have one

See `README.md` for detailed deployment instructions for each option.

## Architecture Overview

```
┌─────────────────┐
│   HTML File     │ ← Your frontend (runs in user's browser)
│  (JavaScript)   │
└────────┬────────┘
         │
         │ API Calls (fetch)
         │
┌────────▼────────┐
│  Express Server │ ← Node.js backend (server.js)
│   Port 3000     │
└────────┬────────┘
         │
         │ SQL Queries
         │
┌────────▼────────┐
│ SQLite Database │ ← Stores users, cards, friendships
│   (bingo.db)    │
└─────────────────┘
```

## Features Enabled

✅ **Real User Accounts** - Secure registration and login
✅ **Cross-Device Access** - Access your card from any computer
✅ **Real Friend System** - Add friends on different computers
✅ **Persistent Storage** - Data saved permanently in database
✅ **Privacy** - Only friends can see each other's cards
✅ **Secure** - Passwords hashed, JWT authentication

## Common Issues & Solutions

### "Port 3000 already in use"
Change the PORT in your `.env` file to 3001 or another number.

### "Cannot find module"
Make sure you ran `npm install` in the server directory.

### "CORS error"
If you deployed the server, make sure you updated the CORS settings in `server.js` to allow your frontend domain.

### "Friend not found"
Make sure both you and your friend are using the same server URL. If testing locally, you both need to access `localhost:3000`.

## Next Steps

1. ✅ Set up the server locally (follow Quick Start above)
2. ✅ Update your HTML file (follow FRONTEND_INTEGRATION.md)
3. ✅ Test everything works locally
4. ✅ Deploy to Railway or another hosting service
5. ✅ Share with friends!

## Support

- **Server Issues**: Check `README.md` for detailed troubleshooting
- **Integration Issues**: See `FRONTEND_INTEGRATION.md` for step-by-step guide
- **Deployment Help**: Each hosting platform has excellent documentation

## Security Notes

⚠️ **Before going live:**
- Change JWT_SECRET to a strong random value
- Use HTTPS (hosting platforms provide this automatically)
- Set CORS to your specific domain (not wildcard *)

## That's It!

You now have a professional, full-stack web application with:
- Backend API server
- Database storage
- User authentication
- Real friend system

Enjoy building your New Year's resolutions! 🎊

---

Created by Michael C Yang
