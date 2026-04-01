# MacroHard Teams 💬

> A full-featured real-time chat application inspired by Microsoft Teams, built with modern web technologies.

🌐 **Live Demo:** [https://teams.chillicurry.uk](https://teams.chillicurry.uk)

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)

---

## ✨ Features

### 💬 Core Messaging
- **Real-time chat** — Instant messaging powered by WebSocket (Socket.IO)
- **Group chat** — Create groups, manage members, group avatars
- **Message editing & recall** — Edit within 5 minutes, recall anytime
- **Reply & quote** — Reply to specific messages with quoted preview
- **@ Mentions** — `@username` with autocomplete dropdown, `@所有人` for everyone
- **Emoji picker** — 80+ emoji with categorized panel
- **Message formatting** — Markdown support (`**bold**`, `*italic*`, `` `code` ``, code blocks, links)
- **Read receipts** — ✓ sent / ✓✓ read (blue) for 1-on-1, "X人已读" for groups

### 📁 File Sharing
- **Image upload** — Drag & drop, Ctrl+V paste, or file picker
- **File sharing** — Any file type up to 50MB with file cards (icon + name + size + download)
- **Image lightbox** — Click to preview full-size images
- **Files hub** — Centralized view of all shared files/images across conversations

### 📞 Voice & Video Calling
- **WebRTC calls** — Peer-to-peer audio & video calling
- **Call UI** — Full-screen overlay with remote/local video, controls (mute, camera, hang up)
- **Incoming call dialog** — Pulsing ring animation, accept/reject
- **Call history** — Automatic logging of all calls (completed, missed, rejected)

### 👤 User Experience
- **User profiles** — Avatar upload, custom status (available/busy/away/offline)
- **Profile cards** — Click any avatar to see profile popup
- **Dark mode** 🌙 — Full dark theme with CSS variables, preference saved
- **Desktop notifications** — Browser notifications + sound alerts for new messages
- **Unread badges** — Message count badges on conversations, `(3) MacroHard Teams` in page title
- **Message search** — Full-text search across all conversations with keyword highlighting

### 🏢 Teams & Channels
- **Team structure** — Create teams with description, manage members
- **Channels** — Multiple channels per team, default "常规" channel
- **Channel chat** — Full chat functionality within team channels

### 🤖 MacroBot
- Built-in chat bot with commands: `/help`, `/joke`, `/time`, `/flip`, `/roll`, `/echo`
- Fun Chinese jokes and interactive responses

### 📊 Additional Features
- **Activity feed** — @mentions, replies, and notifications in one place
- **Calendar** — Monthly view, create/manage events with time slots
- **Drag & drop upload** — Drag files/images directly into chat area

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                │
│                    HTTPS + SSL (Let's Encrypt)              │
│         teams.chillicurry.uk → localhost:3001               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐          ┌──────────────────────┐     │
│  │   React Frontend │  REST    │   Express Backend    │     │
│  │   (TypeScript)   │──/api/──▶│   (TypeScript)       │     │
│  │                  │          │                      │     │
│  │  • Vite build    │ Socket.IO│  • JWT Auth          │     │
│  │  • CSS Variables │◀────────▶│  • File Upload       │     │
│  │  • WebRTC        │ /socket/ │  • WebRTC Signaling  │     │
│  │  • Dark Mode     │          │  • MacroBot          │     │
│  └──────────────────┘          └──────────┬───────────┘     │
│                                           │                 │
│                                  ┌────────▼────────┐        │
│                                  │    MongoDB 7.0  │        │
│                                  │   (Mongoose)    │        │
│                                  └─────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Socket.IO Client, WebRTC |
| **Backend** | Node.js, Express, TypeScript, Socket.IO, JWT, Multer |
| **Database** | MongoDB 7.0, Mongoose ODM |
| **Deployment** | Azure VM, Nginx, Let's Encrypt (Certbot) |
| **Real-time** | Socket.IO (WebSocket) for messaging, WebRTC (STUN) for calls |

### Data Models

```
User          ─── Conversation (1:1 / Group)
  │                    │
  ├── avatar           ├── Message (text / image / file)
  ├── statusType       │     ├── mentions[]
  ├── statusText       │     ├── replyTo
  │                    │     ├── readBy[]
  │                    │     └── fileInfo
  │                    │
Team ──── Channel     Activity
  │         │           ├── mention
  ├── members          ├── reply
  └── admin            └── event_reminder

Event               CallLog
  ├── date             ├── caller / callee
  ├── startTime        ├── callType (audio/video)
  └── participants     └── status (completed/missed/rejected)
```

### Project Structure

```
teamchat/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # UI Components
│   │   │   ├── ChatArea.tsx       # Main chat area
│   │   │   ├── ConversationList   # Conversation sidebar
│   │   │   ├── Sidebar.tsx        # Left icon navigation
│   │   │   ├── TeamList.tsx       # Teams & channels view
│   │   │   ├── CallUI.tsx         # In-call overlay
│   │   │   ├── CalendarView.tsx   # Calendar component
│   │   │   ├── ActivityFeed.tsx   # Activity notifications
│   │   │   ├── FilesHub.tsx       # Files center
│   │   │   └── ...
│   │   ├── contexts/          # React Contexts
│   │   │   ├── AuthContext.tsx    # JWT authentication
│   │   │   ├── SocketContext.tsx  # Socket.IO connection
│   │   │   ├── CallContext.tsx    # WebRTC call state
│   │   │   └── ThemeContext.tsx   # Dark/Light theme
│   │   ├── hooks/             # Custom Hooks
│   │   │   ├── useWebRTC.ts      # WebRTC peer connection
│   │   │   └── useNotification   # Browser notifications
│   │   ├── utils/             # Utilities
│   │   │   ├── config.ts         # Environment-aware config
│   │   │   └── formatMessage.tsx # Markdown renderer
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       └── ChatPage.tsx
│   └── vite.config.ts
│
├── server/                    # Express Backend
│   ├── src/
│   │   ├── models/            # Mongoose Models
│   │   │   ├── User.ts
│   │   │   ├── Conversation.ts
│   │   │   ├── Message.ts
│   │   │   ├── Team.ts
│   │   │   ├── Channel.ts
│   │   │   ├── Activity.ts
│   │   │   ├── Event.ts
│   │   │   └── CallLog.ts
│   │   ├── routes/            # REST API Routes
│   │   │   ├── auth.ts           # Register, login, profile
│   │   │   ├── chat.ts           # Conversations, messages
│   │   │   ├── teams.ts          # Teams & channels
│   │   │   ├── activity.ts       # Activity feed
│   │   │   ├── events.ts         # Calendar events
│   │   │   └── calls.ts          # Call history
│   │   ├── socket.ts          # Socket.IO event handlers
│   │   ├── bot.ts             # MacroBot logic
│   │   └── index.ts           # App entry point
│   └── tests/                 # Test suites
│       ├── smoke-test.ts
│       ├── auth.test.ts
│       └── chat.test.ts
│
└── uploads/                   # Uploaded files storage
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/macrohard-teams.git
cd macrohard-teams

# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev
```

### Environment
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/teamchat`

### Production Deployment

```bash
# Build frontend
cd client && npx vite build

# Serve with Nginx (reverse proxy /api/ and /socket.io/ to :3001)
# See nginx config example in docs/
```

---

## 📸 Screenshots

> Register / login → start chatting immediately

### Key Highlights
- 🎨 **Teams-style 3-column layout** (icon nav + conversation list + chat area)
- 💬 **Purple sent messages** (right) / **Gray received messages** (left)
- 🌙 **Full dark mode** support
- 📱 **Responsive** image/file previews
- 🤖 **Built-in MacroBot** for fun interactions

---

## 🧪 Testing

```bash
# API smoke tests (15 test cases)
cd server && npx ts-node tests/smoke-test.ts

# Jest unit tests
cd server && npx jest
```

---

## 📝 License

MIT License

---

## 👤 Author

**Zhenyu Duan (振宇)**
- Full-stack Developer
- Built with React + Node.js + MongoDB + Socket.IO + WebRTC

---

*Built as a learning project to demonstrate full-stack development capabilities including real-time communication, WebRTC, and production deployment.*
