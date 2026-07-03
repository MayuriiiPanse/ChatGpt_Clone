// ---- Guard: must be logged in ----
const user = getCurrentUser();
if (!user) {
  window.location.href = "login.html";
}

// ---- Elements ----
const chatHistoryEl = document.getElementById("chatHistory");
const chatMessagesEl = document.getElementById("chatMessages");
const chatScrollEl = document.getElementById("chatScroll");
const welcomeStateEl = document.getElementById("welcomeState");
const composerForm = document.getElementById("composerForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const topbarTitle = document.getElementById("topbarTitle");
const connectionBanner = document.getElementById("connectionBanner");
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");

// ---- State ----
// chats is always populated from the backend (GET /api/chat), never from
// localStorage, so the sidebar reflects whatever is actually in MongoDB.
// Each chat's `messages` array is lazy-loaded the first time it's opened,
// then cached in memory for the rest of the session.
let chats = [];
let activeChatId = null;
let socket = null;
let waitingForReply = false;
let renamingChatId = null; // chat currently showing an inline rename input

// ---- User pill ----
const initials = `${user.fullName?.firstName?.[0] || ""}${user.fullName?.lastName?.[0] || ""}`.toUpperCase() || "U";
userAvatar.textContent = initials;
userName.textContent = `${user.fullName?.firstName || ""} ${user.fullName?.lastName || ""}`.trim() || user.email;

// ---- Sidebar rendering ----
function renderSidebar() {
  chatHistoryEl.innerHTML = "";

  if (chats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "No conversations yet";
    chatHistoryEl.appendChild(empty);
    return;
  }

  // Most recently active first
  [...chats]
    .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))
    .forEach((chat) => {
      const item = document.createElement("div");
      item.className = "chat-history-item" + (chat._id === activeChatId ? " active" : "");

      if (renamingChatId === chat._id) {
        // Inline rename input
        const input = document.createElement("input");
        input.type = "text";
        input.className = "chat-rename-input";
        input.value = chat.title;
        item.appendChild(input);
        chatHistoryEl.appendChild(item);

        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitRename(chat._id, input.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            renamingChatId = null;
            renderSidebar();
          }
        });
        input.addEventListener("blur", () => commitRename(chat._id, input.value));

        // Focus after it's in the DOM
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
        return;
      }

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = chat.title;

      const actions = document.createElement("div");
      actions.className = "chat-history-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chat-action-btn";
      editBtn.title = "Rename chat";
      editBtn.setAttribute("aria-label", "Rename chat");
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renamingChatId = chat._id;
        renderSidebar();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "chat-action-btn danger";
      deleteBtn.title = "Delete chat";
      deleteBtn.setAttribute("aria-label", "Delete chat");
      deleteBtn.textContent = "🗑";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleDeleteChat(chat._id, chat.title);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(title);
      item.appendChild(actions);
      item.addEventListener("click", () => openChat(chat._id));
      chatHistoryEl.appendChild(item);
    });
}

// Rename a chat. Only touches MongoDB via PATCH /api/chat/:chatId — the
// chat title is never stored in Pinecone (Pinecone only holds per-message
// vectors keyed by chatId/userId), so there's nothing to rename there.
async function commitRename(chatId, newTitle) {
  if (renamingChatId !== chatId) return; // already committed (e.g. blur after Enter)
  renamingChatId = null;

  const chat = chats.find((c) => c._id === chatId);
  const trimmed = (newTitle || "").trim();

  if (!chat || !trimmed || trimmed === chat.title) {
    renderSidebar();
    return;
  }

  const previousTitle = chat.title;
  chat.title = trimmed; // optimistic update
  renderSidebar();
  if (chatId === activeChatId) topbarTitle.textContent = trimmed;

  try {
    await renameChatOnServer(chatId, trimmed);
  } catch (err) {
    chat.title = previousTitle; // revert on failure
    if (chatId === activeChatId) topbarTitle.textContent = previousTitle;
    renderSidebar();
    alert(`Couldn't rename chat: ${err.message}`);
  }
}

async function handleDeleteChat(chatId, title) {
  const confirmed = confirm(`Delete "${title}"? This can't be undone.`);
  if (!confirmed) return;

  const index = chats.findIndex((c) => c._id === chatId);
  if (index === -1) return;

  const [removed] = chats.splice(index, 1); // optimistic removal
  const wasActive = chatId === activeChatId;

  if (wasActive) {
    activeChatId = null;
    topbarTitle.textContent = "New chat";
    renderMessages();
  }
  renderSidebar();

  try {
    await deleteChatOnServer(chatId); // deletes chat + messages in Mongo and vectors in Pinecone
  } catch (err) {
    chats.splice(index, 0, removed); // revert on failure
    if (wasActive) {
      activeChatId = chatId;
      topbarTitle.textContent = removed.title;
    }
    renderSidebar();
    renderMessages();
    alert(`Couldn't delete chat: ${err.message}`);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Chat message rendering ----
function renderMessages() {
  chatMessagesEl.innerHTML = "";
  const chat = chats.find((c) => c._id === activeChatId);

  if (!chat || !chat.messages || chat.messages.length === 0) {
    chatMessagesEl.appendChild(welcomeStateEl);
    return;
  }

  chat.messages.forEach((m) => appendBubble(m.role, m.content, false));
  scrollToBottom();
}

function appendBubble(role, content, animate = true) {
  if (welcomeStateEl.parentNode === chatMessagesEl) {
    chatMessagesEl.removeChild(welcomeStateEl);
  }
  const row = document.createElement("div");
  row.className = `msg-row ${role === "user" ? "user" : "ai"}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? initials : "C";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessagesEl.appendChild(row);
  if (animate) scrollToBottom();
  return row;
}

function appendTypingIndicator() {
  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="msg-avatar">C</div>
    <div class="bubble typing"><span></span><span></span><span></span></div>
  `;
  chatMessagesEl.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById("typingRow")?.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
  });
}

// ---- Chat selection / creation ----
async function openChat(chatId) {
  activeChatId = chatId;
  const chat = chats.find((c) => c._id === chatId);
  topbarTitle.textContent = chat ? chat.title : "New chat";
  renderSidebar();
  sidebar.classList.remove("open");

  if (!chat) {
    renderMessages();
    return;
  }

  // Lazy-load this chat's messages the first time it's opened
  if (!chat.messages) {
    chatMessagesEl.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "chat-history-empty";
    loading.textContent = "Loading conversation…";
    chatMessagesEl.appendChild(loading);

    try {
      const messages = await fetchChatMessages(chatId);
      chat.messages = messages.map((m) => ({ role: m.role, content: m.content }));
    } catch (err) {
      chat.messages = [];
      if (activeChatId === chatId) {
        chatMessagesEl.innerHTML = "";
        appendBubble("ai", `Couldn't load this conversation: ${err.message}`);
        return;
      }
    }
  }

  if (activeChatId === chatId) renderMessages();
}

async function createNewChat(initialTitle) {
  const title = initialTitle?.slice(0, 60) || "New chat";
  const data = await createChatOnServer(title);
  const chat = { ...data, messages: [] };
  chats.push(chat);
  openChat(chat._id);
  return chat;
}

newChatBtn.addEventListener("click", () => {
  activeChatId = null;
  topbarTitle.textContent = "New chat";
  renderSidebar();
  renderMessages();
  sidebar.classList.remove("open");
  messageInput.focus();
});

// ---- Logout ----
logoutBtn.addEventListener("click", () => {
  clearSession();
  socket?.disconnect();
  window.location.href = "login.html";
});

// ---- Mobile sidebar toggle ----
menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

// ---- Composer ----
messageInput.addEventListener("input", () => {
  sendBtn.disabled = messageInput.value.trim().length === 0 || waitingForReply;
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composerForm.requestSubmit();
  }
});

composerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content || waitingForReply) return;

  messageInput.value = "";
  messageInput.style.height = "auto";
  sendBtn.disabled = true;

  try {
    let chat = chats.find((c) => c._id === activeChatId);
    if (!chat) {
      chat = await createNewChat(content);
    }
    if (!chat.messages) chat.messages = [];

    chat.messages.push({ role: "user", content });
    chat.lastActivity = new Date().toISOString();

    appendBubble("user", content);
    appendTypingIndicator();
    waitingForReply = true;

    socket.emit("ai-message", { chat: chat._id, content });
  } catch (err) {
    removeTypingIndicator();
    waitingForReply = false;
    appendBubble("ai", `Couldn't send that message: ${err.message}`);
  }
});

// ---- Socket.IO connection ----
function connectSocket() {
  socket = io(API_BASE_URL, { withCredentials: true });

  socket.on("connect", () => {
    connectionBanner.classList.remove("show");
  });

  socket.on("connect_error", () => {
    connectionBanner.textContent = "Couldn't connect to the server. Retrying…";
    connectionBanner.classList.add("show");
  });

  socket.on("disconnect", () => {
    connectionBanner.textContent = "Connection lost. Reconnecting…";
    connectionBanner.classList.add("show");
  });

  socket.on("ai-response", (payload) => {
    removeTypingIndicator();
    waitingForReply = false;
    sendBtn.disabled = messageInput.value.trim().length === 0;

    const chat = chats.find((c) => c._id === payload.chat) || chats.find((c) => c._id === activeChatId);
    if (chat) {
      if (!chat.messages) chat.messages = [];
      chat.messages.push({ role: "model", content: payload.content });
      chat.lastActivity = new Date().toISOString();
    }

    if (!chat || chat._id === activeChatId) {
      appendBubble("ai", payload.content);
    }
    renderSidebar();
  });
}

// ---- Init ----
async function init() {
  renderSidebar();
  renderMessages();
  connectSocket();

  try {
    const serverChats = await fetchChats();
    // messages stay undefined until a chat is opened (lazy-loaded)
    chats = serverChats.map((c) => ({ ...c, messages: undefined }));
    renderSidebar();
  } catch (err) {
    chatHistoryEl.innerHTML = "";
    const errorEl = document.createElement("div");
    errorEl.className = "chat-history-empty";
    errorEl.textContent = `Couldn't load chats: ${err.message}`;
    chatHistoryEl.appendChild(errorEl);
  }
}

init();
