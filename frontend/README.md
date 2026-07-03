# Frontend (Login / Register / Chat)

Plain HTML/CSS/JS — no build step. Open `index.html` (or `login.html`) directly,
or serve the folder with any static server.

## Setup

1. Open `js/config.js` and confirm `API_BASE_URL` matches where your backend
   runs (defaults to `http://localhost:3000`).
2. Make sure your backend's CORS allows requests with credentials from
   wherever you serve this frontend (e.g. `http://localhost:5500`). Right now
   `app.js` doesn't have a CORS middleware set up for `/api/*` — add something
   like:

   ```js
   const cors = require("cors");
   app.use(cors({ origin: "http://localhost:5500", credentials: true }));
   ```

   (the Socket.IO server already allows `origin: "*"`, but cookies still need
   to flow correctly for the socket auth middleware to work — same-site or a
   proper CORS config is required for that cookie to be sent.)
3. Serve this folder (e.g. VS Code "Live Server", or `npx serve`) and open it
   in the browser.

## Pages

- `login.html` — POSTs to `/api/auth/login`
- `register.html` — POSTs to `/api/auth/register` (first/last name + email + password)
- `chat.html` — the main app: sidebar with "New chat" + chat history, and the
  conversation view. Talks to your backend over Socket.IO (`ai-message` /
  `ai-response`) for messages, and `POST /api/chat` to create new chats.

## Theme

Light/dark is automatic — it follows the OS/browser `prefers-color-scheme`
setting. There's intentionally no in-app toggle, per your request.

## Important: chat history is stored locally, not from your backend

Your current backend only exposes `POST /api/chat` (create a chat) — there's
no `GET` route yet to list a user's chats or fetch a chat's past messages.
So, for now, the sidebar's chat list and each chat's messages are cached in
the browser's `localStorage`, scoped to the logged-in user
(see `js/config.js`: `loadChats` / `saveChats`).

This works fine for a single browser/device, but it means:
- Chat history won't follow the user to a different browser or device.
- Clearing browser storage clears the visible history (messages are still
  safely in MongoDB, just not fetched back by the UI).

To make this fully server-backed, add two routes to your backend and I can
wire the frontend to them in a couple of minutes:
- `GET /api/chat` — list the logged-in user's chats
- `GET /api/chat/:chatId/messages` — list a chat's messages

Once those exist, replace `loadChats`/`saveChats` calls in `js/chat.js` with
real `api(...)` calls — the rest of the UI doesn't need to change.


# run frontend -
npx serve -p 5500