# SyncChat

**A Real-Time MERN Chat Application with Socket.io**

SyncChat is a full-stack real-time messaging web app where users can register, log in, send direct messages (DMs), create group chats, search users, and receive instant messages with typing indicators — all powered by the **MERN stack** and **Socket.io**.

**Author:** [Manan1107](https://github.com/Manan1107)

---

## Features

- **User authentication** — Register, login, JWT-based sessions
- **Direct messages (DM)** — One-to-one private chats
- **Group chats** — Create groups, add/remove members, leave or delete groups
- **Real-time messaging** — Instant message delivery via Socket.io
- **Typing indicators** — See when someone is typing
- **User search** — Find users and groups quickly
- **Chat persistence** — Messages stored in MongoDB
- **Responsive UI** — Modern React chat interface

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, React Router, Socket.io Client |
| **Backend** | Node.js, Express 5, Socket.io |
| **Database** | MongoDB with Mongoose |
| **Auth** | JWT + bcrypt password hashing |

---

## Architecture

```
┌─────────────────┐         REST API          ┌─────────────────┐
│  React Frontend │ ◄──────────────────────► │  Express Backend │
│  (Vite)         │         Socket.io         │  + Socket.io     │
└─────────────────┘ ◄──────────────────────► └────────┬────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │    MongoDB      │
                                              │ users/chats/    │
                                              │ messages        │
                                              └─────────────────┘
```

---

## Project Structure

```
SyncChat/
├── backend/          # Express API + Socket.io server
│   └── src/
│       ├── controllers/
│       ├── models/     # User, Chat, Message
│       ├── routes/
│       └── middleware/
├── frontend/         # React chat UI
│   └── src/
│       ├── pages/      # Login, Signup, ChatHome
│       ├── context/    # Auth + Socket contexts
│       └── services/   # API calls
├── db-backup/        # MongoDB sample dump
└── README.md
```

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- MongoDB (local or MongoDB Atlas)

### 1. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/chatapp
PORT=4000
JWT_SECRET=your-long-random-secret
FRONTEND_URL=http://localhost:5173
```

Start backend:

```bash
npm run dev
```

Backend runs on: **http://localhost:4000**

### 2. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

Start frontend:

```bash
npm run dev
```

Frontend runs on: **http://localhost:5173**

### 3. Database (optional)

**Option A — Restore sample data:**
```bash
mongorestore --db chatapp ./db-backup/chatapp
```

**Option B — Start fresh:**  
Register users via the Signup page, or use dev seed endpoint (non-production only):
```
POST /api/dev/seed-users
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT token |

### Chats & Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/chats` | List user's chats |
| POST | `/api/chats/group` | Create group chat |
| GET | `/api/chats/:chatId/messages` | Get chat messages |
| POST | `/api/chats/:chatId/messages` | Send message |
| POST | `/api/chats/dm/:username` | Start DM with user |
| DELETE | `/api/chats/group/:chatId` | Delete group (creator only) |
| POST | `/api/chats/group/:chatId/leave` | Leave group |
| POST | `/api/chats/group/:chatId/members` | Add members |
| DELETE | `/api/chats/group/:chatId/members/:userId` | Remove member |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

---

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-user` | Client → Server | Join personal notification room |
| `join-chat` | Client → Server | Join a chat room |
| `leave-chat` | Client → Server | Leave a chat room |
| `send-message` | Client → Server | Broadcast new message |
| `new-message` | Server → Client | Receive new message |
| `typing` | Client → Server | User is typing |
| `user-typing` | Server → Client | Someone is typing in chat |

---

## Production Build

```bash
# Frontend
cd frontend
npm run build
# Output in frontend/dist/

# Backend
cd backend
npm start
```

Deploy backend and frontend separately. Set environment variables on your hosting platform.

---

## Environment Variables

### Backend
| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Server port (default 4000) |
| `JWT_SECRET` | Secret for JWT tokens |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |

---

## Resume Points

**SyncChat — Real-Time MERN Chat App | React, Node.js, MongoDB, Socket.io**

- Built a real-time chat application with JWT authentication, direct messaging, and group chat management.
- Implemented instant message delivery and typing indicators using Socket.io with Express and MongoDB persistence.
- Designed a React frontend with auth context, socket context, and a responsive chat interface.

---

## License

MIT — Manan Javiya
