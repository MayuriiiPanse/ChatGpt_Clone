const express = require("express");
const cookieparser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cookieparser());

const cors = require("cors");
   app.use(cors({
    origin: true,
    credentials: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/chat',chatRoutes);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});


module.exports = app;