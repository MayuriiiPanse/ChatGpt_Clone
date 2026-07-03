const express = require("express");
const cookieparser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");

const app = express();
app.use(express.json());
app.use(cookieparser());

const cors = require("cors");
   app.use(cors({ origin: "http://localhost:5500", credentials: true }));

app.use('/api/auth', authRoutes);
app.use('/api/chat',chatRoutes);

module.exports = app;