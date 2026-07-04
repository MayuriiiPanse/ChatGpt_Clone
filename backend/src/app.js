const express = require("express");
const cookieparser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cookieparser());
app.use(express.static(path.join(__dirname, "../public")));

const cors = require("cors");
   app.use(cors({
    origin: true,
    credentials: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/chat',chatRoutes);

app.get("*name",(req, res)=>{
   app.use(express.static(path.join(__dirname, "../public")));
})

module.exports = app;