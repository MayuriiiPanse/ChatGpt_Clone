// ---- Backend connection settings ----
// Change this if your backend runs somewhere other than localhost:3000
const API_BASE_URL = "";

// Small fetch wrapper: always sends cookies (the backend uses an httpOnly
// "token" cookie for auth), always sends/expects JSON.
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* no body */
  }

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// ---- Server-backed chat history ----
// Chats and messages are the source of truth in MongoDB + Pinecone. The
// frontend never caches the chat list itself in localStorage anymore — it
// always asks the backend, so creating/renaming/deleting a chat is
// reflected immediately, and there's no stale local copy left behind.

async function fetchChats() {
  const data = await api("/api/chat");
  return data.chats; // [{ _id, title, lastActivity, user, ... }]
}

async function fetchChatMessages(chatId) {
  const data = await api(`/api/chat/${chatId}/messages`);
  return data.messages; // [{ _id, role, content, ... }]
}

async function createChatOnServer(title) {
  const data = await api("/api/chat", { method: "POST", body: { title } });
  return data.chat;
}

async function renameChatOnServer(chatId, title) {
  const data = await api(`/api/chat/${chatId}`, { method: "PATCH", body: { title } });
  return data.chat;
}

async function deleteChatOnServer(chatId) {
  return api(`/api/chat/${chatId}`, { method: "DELETE" });
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("gptui:user"));
  } catch (_) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem("gptui:user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("gptui:user");
}
