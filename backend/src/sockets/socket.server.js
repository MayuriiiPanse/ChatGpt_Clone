const chatModel = require("../models/chat.model");
const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

const {
  generateResponse,
  generateEmbedding,
} = require("../services/ai.service");

const messageModel = require("../models/message.model");
const userModel = require("../models/user.model");

const { createMemory, queryMemory } = require("../services/vector.service");

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5500",
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers?.cookie || "");

      if (!cookies.token) {
        return next(new Error("Authentication error: No Token Provided"));
      }

      const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);

      const user = await userModel.findById(decoded.id);

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);

      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.user.email}`);

    socket.on("ai-message", async (messagePayload) => {
      try {
        // Postman may send Socket.IO payload as string
        if (typeof messagePayload === "string") {
          messagePayload = JSON.parse(messagePayload);
        }

        const { chat, content } = messagePayload;

        // Validate payload
        if (!chat || !content) {
          return socket.emit("ai-response", {
            content: "Chat ID and message content are required.",
            chat: chat || null,
          });
        }

        console.log("Received message:", {
          chat,
          content,
        });

        // 1. Save user message in MongoDB
        const savedUserMessage = await messageModel.create({
          chat,
          user: socket.user._id,
          content,
          role: "user",
        });

        await chatModel.findByIdAndUpdate(chat, {
          lastActivity: new Date(),
        });

        console.log("User message saved in MongoDB");

        // 2. Generate embedding for user message
        const userEmbedding = await generateEmbedding(content);

        console.log("Embedding generated. Length:", userEmbedding.length);

        // Run both operations simultaneously
        const [, similarMemories] = await Promise.all([
          createMemory({
            vectors: userEmbedding,
            messageId: savedUserMessage._id,
            metadata: {
              userId: String(socket.user._id),
              chatId: String(chat),
              content,
              role: "user",
            },
          }),

          queryMemory({
            queryVector: userEmbedding,
            limit: 5,
            metadata: {
              userId: String(socket.user._id),
            },
          }),
        ]);

        console.log("Similar memories found:", similarMemories.length);

        // 5. Build RAG context from Pinecone memories
        const ragContext = similarMemories
          .filter((memory) => {
            return (
              memory.metadata?.content &&
              memory.metadata?.userId === String(socket.user._id)
            );
          })
          .map((memory, index) => {
            return `
Memory ${index + 1}:
Chat ID: ${memory.metadata.chatId}
Role: ${memory.metadata.role}
Content: ${memory.metadata.content}
Similarity Score: ${memory.score}
                        `.trim();
          })
          .join("\n\n");

        console.log("RAG context created:", ragContext);

        // 6. Short-term memory:
        // Get only messages from the current chat
        // Exclude current message because it will be added separately
        const chatHistory = await messageModel
          .find({
            chat,
            _id: {
              $ne: savedUserMessage._id,
            },
          })
          .sort({
            createdAt: 1,
          })
          .limit(10);

        const formattedHistory = chatHistory.map((message) => ({
          role: message.role === "model" ? "assistant" : "user",
          content: message.content,
        }));

        console.log("Short-term chat history:", formattedHistory.length);

        // 7. Generate AI response using:
        // - current question
        // - current chat history
        // - Pinecone long-term memory
        console.log("Calling OpenRouter with RAG context...");

        const response = await generateResponse(
          content,
          formattedHistory,
          ragContext
        );

        console.log("AI Response:", response);

        const savedAiMessage = await messageModel.create({
          chat,
          user: socket.user._id,
          content: response,
          role: "model",
        });

        // 🚀 Send response immediately
        socket.emit("ai-response", {
          content: response,
          chat,
          similarMemories: similarMemories.map((memory) => ({
            id: memory.id,
            score: memory.score,
            metadata: memory.metadata,
          })),
        });

        // Background task
        (async () => {
          try {
            const aiEmbedding = await generateEmbedding(response);

            await createMemory({
              vectors: aiEmbedding,
              messageId: savedAiMessage._id,
              metadata: {
                userId: String(socket.user._id),
                chatId: String(chat),
                content: response,
                role: "model",
              },
            });

            await chatModel.findByIdAndUpdate(chat, {
              lastActivity: new Date(),
            });

            console.log("AI memory stored.");
          } catch (err) {
            console.error("Background task:", err);
          }
        })();
      } catch (error) {
        console.error("Socket Error:", error);

        socket.emit("ai-response", {
          content: "Something went wrong while generating the response.",
          chat: messagePayload?.chat || null,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User Disconnected: ${socket.user?.email}`);
    });
  });
}

module.exports = initSocketServer;
