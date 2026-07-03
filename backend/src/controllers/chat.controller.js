const chatModel = require("../models/chat.model");
const messageModel = require("../models/message.model");

const {
    deleteMemoryByFilter
} = require("../services/vector.service");

// =========================
// Create Chat
// =========================
async function createChat(req, res) {
    try {
        const { title } = req.body;
        const user = req.user;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Chat title is required."
            });
        }

        const chat = await chatModel.create({
            user: user._id,
            title: title.trim()
        });

        res.status(201).json({
            message: "Chat created successfully.",
            chat
        });

    } catch (error) {
        console.error("Create Chat Error:", error);

        res.status(500).json({
            message: "Failed to create chat."
        });
    }
}

// =========================
// Get All Chats
// =========================
async function getChats(req, res) {
    try {
        const chats = await chatModel
            .find({
                user: req.user._id
            })
            .sort({
                lastActivity: -1
            });

        res.status(200).json({
            message: "Chats fetched successfully.",
            chats
        });

    } catch (error) {
        console.error("Get Chats Error:", error);

        res.status(500).json({
            message: "Failed to fetch chats."
        });
    }
}

// =========================
// Get Messages
// =========================
async function getMessages(req, res) {
    try {

        const { chatId } = req.params;

        const chat = await chatModel.findById(chatId);

        if (!chat) {
            return res.status(404).json({
                message: "Chat not found."
            });
        }

        if (chat.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Unauthorized."
            });
        }

        const messages = await messageModel
            .find({
                chat: chatId
            })
            .sort({
                createdAt: 1
            });

        res.status(200).json({
            message: "Messages fetched successfully.",
            messages
        });

    } catch (error) {

        console.error("Get Messages Error:", error);

        res.status(500).json({
            message: "Failed to fetch messages."
        });
    }
}

// =========================
// Rename Chat
// =========================
async function renameChat(req, res) {

    try {

        const { chatId } = req.params;
        const { title } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Title is required."
            });
        }

        const chat = await chatModel.findById(chatId);

        if (!chat) {
            return res.status(404).json({
                message: "Chat not found."
            });
        }

        if (chat.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Unauthorized."
            });
        }

        chat.title = title.trim();

        await chat.save();

        res.status(200).json({
            message: "Chat renamed successfully.",
            chat
        });

    } catch (error) {

        console.error("Rename Chat Error:", error);

        res.status(500).json({
            message: "Failed to rename chat."
        });
    }
}

// =========================
// Delete Chat
// =========================
async function deleteChat(req, res) {

    try {

        const { chatId } = req.params;

        const chat = await chatModel.findById(chatId);

        if (!chat) {
            return res.status(404).json({
                message: "Chat not found."
            });
        }

        if (chat.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Unauthorized."
            });
        }

        // Delete vectors from Pinecone
        await deleteMemoryByFilter({
            chatId: String(chatId)
        });

        // Delete all messages
        await messageModel.deleteMany({
            chat: chatId
        });

        // Delete chat
        await chatModel.findByIdAndDelete(chatId);

        res.status(200).json({
            message: "Chat deleted successfully."
        });

    } catch (error) {

        console.error("Delete Chat Error:", error);

        res.status(500).json({
            message: "Failed to delete chat."
        });
    }
}

module.exports = {
    createChat,
    getChats,
    getMessages,
    renameChat,
    deleteChat
};