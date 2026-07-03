const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middlewares");
const chatController = require("../controllers/chat.controller");

router.post("/", authMiddleware.authUser, chatController.createChat);

router.get("/", authMiddleware.authUser, chatController.getChats);

router.get(
    "/:chatId/messages",
    authMiddleware.authUser,
    chatController.getMessages
);

// NEW
router.patch(
    "/:chatId",
    authMiddleware.authUser,
    chatController.renameChat
);

// NEW
router.delete(
    "/:chatId",
    authMiddleware.authUser,
    chatController.deleteChat
);

module.exports = router;