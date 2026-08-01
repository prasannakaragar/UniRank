# 🚀 Deploying UniRank on Vercel

This guide provides step-by-step instructions to deploy **UniRank** (Frontend + Backend) to Vercel.

---

## 📋 Prerequisites
1. A **Vercel Account** ([vercel.com](https://vercel.com))
2. A **MongoDB Atlas Database** ([mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))
   - Ensure your database network access allows connection from anywhere (`0.0.0.0/0` in MongoDB Atlas Network Access).

---

## 🛠️ Deployment Options

You can deploy UniRank in two ways:

---

### Option A: Deploy Frontend & Backend Together (Monorepo - Single Vercel Project)

1. **Push your code to GitHub**:
   Ensure all changes are committed and pushed to your repository.

2. **Import Project into Vercel**:
   - Go to your Vercel Dashboard → **Add New** → **Project**.
   - Select your UniRank GitHub repository.

3. **Configure Build Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build --prefix frontend` (or leave default, as root `vercel.json` is configured automatically).

4. **Environment Variables**:
   In Vercel Project Settings → **Environment Variables**, add:
   - `MONGO_URI`: Your MongoDB Atlas connection string (e.g. `mongodb+srv://<user>:<password>@cluster.mongodb.net/unirank?retryWrites=true&w=majority`)
   - `SECRET_KEY` / `JWT_SECRET_KEY`: A secure random string for JWT authentication
   - `VITE_API_URL`: `/api` (or leave blank to automatically default to `/api`)
   - `FRONTEND_URL`: Your Vercel deployment domain (e.g. `https://your-unirank-app.vercel.app`)
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key
   - `GITHUB_TOKEN`: *(Optional)* GitHub Personal Access Token for profile scanning

5. **Deploy**: Click **Deploy**.

---

### Option B: Deploy Frontend & Backend as 2 Separate Vercel Projects (Recommended for modular management)

#### 1. Deploying Backend API (`/backend`)
- **Add New Project** in Vercel → Select repository.
- Set **Root Directory** to `backend`.
- Add Environment Variables:
  - `MONGO_URI`
  - `SECRET_KEY`
  - `JWT_SECRET_KEY`
  - `FRONTEND_URL`: `https://your-frontend.vercel.app`
- Click **Deploy**. Note down your Backend URL (e.g., `https://unirank-backend.vercel.app`).

#### 2. Deploying Frontend (`/frontend`)
- **Add New Project** in Vercel → Select repository.
- Set **Root Directory** to `frontend`.
- Add Environment Variables:
  - `VITE_API_URL`: `https://unirank-backend.vercel.app/api`
- Click **Deploy**.

---

## 📌 Important Notes on Serverless Architecture

1. **MongoDB Connection Pooling**: The MongoDB connection logic in `backend/src/config/db.js` has been optimized to cache connections across serverless function warm starts.
2. **WebSockets & Real-Time Chat**: Vercel Serverless Functions execute on demand. For persistent WebSocket connections (`socket.io`), deploy the backend to host platforms like **Render**, **Railway**, or **Fly.io** while keeping the Frontend on Vercel, or set `VITE_API_URL` to point to your live backend.
