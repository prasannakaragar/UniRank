# 🎓 UniRank – College Competitive Platform

A comprehensive full-stack platform for college students to build competitive profiles, connect with peers, participate in hackathons, and compete on leaderboards. UniRank aggregates competitive programming metrics from **Codeforces**, **LeetCode**, **HackerRank**, and **GitHub** to create a holistic ranking system.

## 🚀 Key Features

### 🎯 Core Platform
- **User Authentication** - College email verification with OTP-based registration
- **Competitive Profiles** - Integrated stats from Codeforces, LeetCode, GitHub
- **Global Leaderboards** - Branch-wise, year-wise, and all-time rankings
- **Hackathon Tracking** - Log participation and achievements
- **Real-time Chat** - Direct messages and group conversations with WebSocket support
- **Announcements Board** - Faculty and admin posts for events and opportunities
- **Team Formation** - Find teammates for hackathons and projects

### 📊 Scoring System
- **Competitive Programming Score** - Based on Codeforces & LeetCode ratings
- **Hackathon Score** - Track hackathon wins and placements
- **Activity Score** - Engagement metrics on the platform
- **GitHub Analysis** - AI-powered code quality assessment

### 🔒 Security & Validation
- JWT-based authentication
- Rate limiting (1000 req/day, 200 req/hour)
- Email verification for college domain
- Password hashing with bcrypt
- CORS protection

## 📋 Prerequisites

### Backend
- **Python** 3.8 or higher
- **MongoDB** (local or cloud instance)
- **Redis** (optional, falls back to in-memory cache)
- **pip** for Python package management

### Frontend
- **Node.js** 16.0 or higher
- **npm** 7.0 or higher

## 🛠️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/prasannakaragar/UniRank.git
cd UniRank
```

### 2️⃣ Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Environment Configuration
Create a `.env` file in the `backend/` directory:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production

# MongoDB
MONGO_URI=mongodb://localhost:27017/unirank

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Email Configuration (Gmail/Outlook)
OUTLOOK_EMAIL=your-email@outlook.com
OUTLOOK_PASSWORD=your-app-password

# Competitive Programming APIs
CODEFORCES_API_KEY=your-codeforces-key
LEETCODE_API_KEY=your-leetcode-key

# GitHub API (for profile analysis)
GITHUB_API_KEY=your-github-token
```

#### Start MongoDB
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas cloud service
# Update MONGO_URI in .env with your connection string
```

#### Run Backend Server
```bash
python app.py
```

Backend will be available at `http://localhost:5000`

**Health Check:**
```bash
curl http://localhost:5000/api/health
```

### 3️⃣ Frontend Setup

#### Install Node Dependencies
```bash
cd frontend
npm install
```

#### Start Development Server
```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 4️⃣ Access the Application

Open your browser and navigate to: `http://localhost:5173`

## 📁 Project Structure

```
UniRank/
├── backend/
│   ├── app.py                          # Flask app entry point
│   ├── models.py                       # MongoDB data models
│   ├── socket_io.py                    # WebSocket configuration
│   ├── wsgi.py                         # Production WSGI config
│   ├── requirements.txt                # Python dependencies
│   ├── nginx.conf                      # Nginx reverse proxy config
│   │
│   ├── routes/                         # API route handlers
│   │   ├── auth.py                     # Authentication endpoints
│   │   ├── profile.py                  # User profile management
│   │   ├── leaderboard.py              # Ranking & leaderboard
│   │   ├── announcements.py            # Announcements CRUD
│   │   ├── teams.py                    # Team formation endpoints
│   │   └── chats.py                    # Messaging & real-time chat
│   │
│   ├── utils/                          # Utility functions
│   │   ├── codeforces.py               # Codeforces API integration
│   │   ├── leetcode.py                 # LeetCode API integration
│   │   ├── hackerrank.py               # HackerRank API integration
│   │   ├── github_ai.py                # GitHub profile analysis
│   │   ├── email_utils.py              # Email sending (OTP, notifications)
│   │   ├── scoring.py                  # Score calculation logic
│   │   └── rate_limiter.py             # Rate limiting utilities
│   │
│   ├── scratch/                        # Development & debugging scripts
│   ├── [various scripts]               # DB management, testing, debugging
│   └── .env                            # Environment variables (create manually)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Root component
│   │   ├── main.jsx                    # React entry point
│   │   ├── index.css                   # Global styles
│   │   │
│   │   ├── api/
│   │   │   └── axios.js                # Axios instance with interceptors
│   │   │
│   │   ├── components/
│   │   │   └── Layout.jsx              # Shared layout component
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.jsx         # Auth state management
│   │   │
│   │   └── pages/
│   │       ├── Login.jsx               # User login
│   │       ├── Register.jsx            # User registration
│   │       ├── Dashboard.jsx           # Main dashboard
│   │       ├── Profile.jsx             # User profile view/edit
│   │       ├── Leaderboard.jsx         # Ranking leaderboard
│   │       ├── Announcements.jsx       # Events & announcements
│   │       ├── Teams.jsx               # Team formation board
│   │       └── Chats.jsx               # Messaging interface
│   │
│   ├── index.html                      # HTML template
│   ├── package.json                    # Node dependencies
│   ├── vite.config.js                  # Vite configuration
│   ├── tailwind.config.js              # Tailwind CSS config
│   ├── postcss.config.js               # PostCSS configuration
│   └── .env                            # Frontend env vars (optional)
│
└── .gitignore                          # Git ignore rules
```

## 🏗️ Technology Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Flask** | 3.0.3 | Web framework |
| **Flask-CORS** | 4.0.1 | Cross-origin requests |
| **Flask-JWT-Extended** | 4.6.0 | JWT authentication |
| **Flask-MongoEngine** | 1.0.0 | MongoDB ODM |
| **Flask-SocketIO** | 5.3.6 | Real-time WebSockets |
| **Flask-Limiter** | 3.7.0 | Rate limiting |
| **Flask-Caching** | 2.1.0 | Response caching |
| **MongoDB** | Latest | Document database |
| **Redis** | 5.0.4 | Cache & session store (optional) |
| **Gunicorn** | 22.0.0 | Production WSGI server |
| **Eventlet** | 0.36.1 | Async I/O library |
| **Requests** | 2.32.3 | HTTP client |
| **python-dotenv** | 1.0.1 | Environment variables |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3.1 | UI library |
| **React Router** | 6.24.0 | Client-side routing |
| **Vite** | 5.3.1 | Build tool |
| **Tailwind CSS** | 3.4.4 | Utility-first CSS |
| **Axios** | 1.7.2 | HTTP client |
| **PostCSS** | 8.4.39 | CSS processor |
| **Autoprefixer** | 10.4.19 | Vendor prefixes |

## 📚 API Endpoints

### Authentication Routes (`/api/auth`)
```
POST   /register              Register new user
POST   /verify-otp           Verify OTP for registration
POST   /login                User login
POST   /logout               User logout
POST   /refresh-token        Refresh JWT token
GET    /user                 Get current user
POST   /change-password      Update password
```

### Profile Routes (`/api/profile`)
```
GET    /                     Get user profile
PUT    /                     Update profile
GET    /sync-cp              Sync Codeforces/LeetCode stats
GET    /github-analysis      Get GitHub profile analysis
PUT    /avatar               Update profile picture
```

### Leaderboard Routes (`/api/leaderboard`)
```
GET    /global               Global leaderboard
GET    /branch/:branch       Branch-wise leaderboard
GET    /year/:year           Year-wise leaderboard
GET    /hackathons           Hackathon winners
GET    /user/:id/rank        User rank details
```

### Announcements Routes (`/api/announcements`)
```
GET    /                     List all announcements
POST   /                     Create announcement (admin only)
GET    /:id                  Get announcement details
PUT    /:id                  Update announcement
DELETE /:id                  Delete announcement
GET    /filter               Filter by category/tags
```

### Teams Routes (`/api/teams`)
```
GET    /                     List team posts
POST   /                     Create team post
GET    /:id                  Get team post
PUT    /:id                  Update team post
DELETE /:id                  Delete team post
POST   /:id/join             Join team
```

### Chat Routes (`/api/chats`)
```
GET    /conversations        List user conversations
POST   /conversations        Create conversation
GET    /conversations/:id    Get conversation details
GET    /conversations/:id/messages  Get messages
POST   /conversations/:id/messages  Send message
DELETE /messages/:id         Delete message
```

## 🔌 Real-time Features (WebSocket)

The application uses **Socket.IO** for real-time communication:

### Chat Events
- `message:send` - Send new message
- `message:receive` - Receive message
- `typing` - User typing indicator
- `online_status` - User online/offline
- `message:read` - Mark message as read

### Notification Events
- `announcement:new` - New announcement posted
- `leaderboard:update` - Ranking updated
- `team:match` - Team match notification

## 🔐 Authentication Flow

```
1. User registers with college email
   ↓
2. OTP sent to email for verification
   ↓
3. User verifies OTP
   ↓
4. Account created & verified
   ↓
5. User logs in
   ↓
6. JWT token issued (expires in 24 hours)
   ↓
7. Token stored in localStorage
   ↓
8. API requests include Authorization header
```

## 📊 Data Models

### User
- `name` - Full name
- `email` - College email (unique)
- `password` - bcrypt hashed
- `branch` - Academic branch
- `year` - Academic year (1-4)
- `role` - student/faculty
- `is_verified` - Email verified
- `college_verified` - College confirmation

### Profile
- **Competitive Programming**: Codeforces handle, LeetCode username, ratings, problems solved
- **GitHub**: Profile URL, analysis scores (implementation, impact, working)
- **Scores**: CP score, hackathon score, activity score, global score
- **Social**: Bio, skills, GitHub URL, LinkedIn URL

### Announcement
- `title` - Event title
- `description` - Event details
- `category` - hackathon/contest/opportunity
- `organization` - Organizing body
- `event_date` - Event date
- `deadline` - Registration deadline
- `mode` - Online/Offline/Hybrid
- `tags` - Searchable tags
- `is_pinned` - Pin to top

### Conversation (Chat)
- `kind` - dm (direct message) or group
- `name` - Conversation name
- `members` - List of participants
- `last_message` - Preview of last message
- `created_at` - Creation timestamp

## 🚀 Deployment

### Backend (Python)

#### Using Gunicorn + Nginx
```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app

# Use provided nginx.conf for reverse proxy
```

#### Heroku
```bash
git push heroku main
```

#### Docker
```bash
docker build -t unirank-backend .
docker run -p 5000:5000 unirank-backend
```

### Frontend (React/Vite)

#### Build
```bash
npm run build
```

#### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

#### Deploy to Netlify
```bash
npm run build
# Drag & drop dist/ folder to Netlify
```

## 📱 Environment Variables

### Backend (.env)
```env
FLASK_ENV=production
SECRET_KEY=change-this-to-random-string
JWT_SECRET_KEY=change-this-to-random-string
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/unirank
REDIS_URL=redis://localhost:6379
OUTLOOK_EMAIL=your-email@outlook.com
OUTLOOK_PASSWORD=your-app-password
GITHUB_API_KEY=your-github-token
```

### Frontend (.env.local)
```env
VITE_API_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://yourdomain.com
```

## 📖 API Documentation

### Request Format
```javascript
// Example: Sync Codeforces profile
fetch('/api/profile/sync-cp', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    cf_handle: 'user_handle',
    lc_username: 'user_lc'
  })
})
```

### Response Format
All API responses follow this format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* Response payload */ }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## 🧪 Testing

### Manual Testing
1. Register with college email
2. Verify OTP sent to email
3. Add Codeforces/LeetCode handles
4. Check leaderboard ranking
5. Create team post
6. Start group chat
7. Post announcement

### Database Testing Scripts
```bash
python seed_db.py           # Populate sample data
python check_users.py       # Verify user data
python reset_db.py          # Clear database
python debug_mongo.py       # Debug MongoDB connection
```

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Error**
```bash
# Ensure MongoDB is running
mongod

# Or check MongoDB Atlas connection string
```

**Redis Connection Error**
```bash
# Optional - Redis falls back to in-memory cache
# Install Redis: brew install redis (macOS)
redis-server
```

**Port Already in Use**
```bash
# Change port in app.py
socketio.run(app, debug=True, port=5001)
```

### Frontend Issues

**API Connection Failed**
- Check backend is running on port 5000
- Verify CORS configuration in app.py
- Check browser console for specific errors

**Module Not Found**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- Flask and React communities
- MongoDB for flexible data storage
- Socket.IO for real-time capabilities
- Codeforces, LeetCode APIs for data integration
- Tailwind CSS for styling


---

**Made with ❤️ for college students**
