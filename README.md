# ProjectFlow – Full-Stack Project Management Tool

A JIRA/Asana-style project management app built with:

- **Frontend**: React + Vite + TailwindCSS → deployed on **Vercel**
- **Backend**: Node.js + Express + Prisma ORM → deployed on **Railway**
- **Database**: PostgreSQL (Railway plugin)
- **Auth**: JWT (access token in memory + refresh token in httpOnly cookie)

---

## Monorepo Structure

```
projectflow/
├── frontend/          # React app (Vercel)
├── backend/           # Express API (Railway)
└── README.md
```

---

## Local Development

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/projectflow.git
cd projectflow

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Backend environment

Create `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/projectflow"
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_REFRESH_SECRET="your-refresh-secret-change-this"
PORT=4000
FRONTEND_URL="http://localhost:5173"
```

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run both servers

```bash
# Terminal 1 – Backend
cd backend && npm run dev

# Terminal 2 – Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000

---

## Deployment

### Railway (Backend)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the `backend/` folder as root (set **Root Directory** = `backend`)
4. Add a PostgreSQL plugin in Railway dashboard
5. Set environment variables in Railway:
   - `DATABASE_URL` → auto-set by Railway PostgreSQL plugin
   - `JWT_SECRET` → generate a strong random string
   - `JWT_REFRESH_SECRET` → generate a strong random string
   - `FRONTEND_URL` → your Vercel URL (e.g. `https://projectflow.vercel.app`)
6. Railway auto-deploys on every push to `main`

### Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set **Root Directory** = `frontend`
3. Set environment variable:
   - `VITE_API_URL` → your Railway backend URL (e.g. `https://projectflow-api.up.railway.app`)
4. Vercel auto-deploys on every push to `main`

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/auth/logout | Clear refresh token |
| POST | /api/auth/refresh | Refresh access token |
| GET  | /api/auth/me | Get current user |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | Get all tasks (with filters) |
| POST | /api/tasks | Create task |
| GET | /api/tasks/:id | Get task by ID |
| PUT | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |
| PATCH | /api/tasks/:id/status | Move task to column |

### Columns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/columns | Get all columns |
| POST | /api/columns | Create column |
| PUT | /api/columns/:id | Update column |
| DELETE | /api/columns/:id | Delete column |

### Team Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/members | Get all members |
| POST | /api/members/invite | Invite member |
| DELETE | /api/members/:id | Remove member |

---

## New Features (v3)

### ⚡ Real-Time Collaboration (Socket.io)
All board events broadcast instantly to every connected user — no refresh needed:
- Task created / updated / deleted / drag-moved
- Comments added / deleted (live in the open detail panel)
- Subtask toggled (progress bar updates live)
- Personal notifications pushed to your bell icon

### ☑ Subtasks
Each task has a Subtasks tab:
- Add subtasks with Enter key
- Check/uncheck to toggle completion
- **Task progress auto-calculates** from subtask completion ratio
- Live updates pushed to all viewers via Socket.io

### 📎 File Attachments (Cloudinary – Free 25 GB)
Each task has an Attachments tab:
- Upload images, PDFs, Word, Excel, PowerPoint, CSV, ZIP (max 10 MB each)
- Preview images inline; all files open in a new tab
- Delete removes from Cloudinary and DB
- Requires `CLOUDINARY_*` env vars (free account, no credit card)

### 🔔 Email Notifications (Brevo – Free 300/day)
Triggered automatically on:
| Event | Who gets email |
|-------|---------------|
| Task assigned | New assignee |
| New comment   | Task assignee |
| Due tomorrow  | Task assignee (checked every 6h) |
| Overdue       | Task assignee (checked every 6h) |

Requires `BREVO_*` env vars. Server runs fine without them (graceful fallback to console.log).

### Free Tier Summary

| Service | What it's for | Free limit |
|---------|--------------|-----------|
| Railway | Backend hosting | $5 credit/month (always) |
| Railway PostgreSQL | Database | 1 GB storage |
| Vercel | Frontend hosting | Unlimited for hobby |
| Cloudinary | File storage | 25 GB storage + bandwidth |
| Brevo | Emails | 300 emails/day, unlimited contacts |
| Socket.io | Real-time | Bundled in Railway server |
