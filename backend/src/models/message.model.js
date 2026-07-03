const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    },chat:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"chat"
    },
    content:{
        type:String,
        required:true
    },
    role:{
       type:String,
       enum:["user","model","System"],
       default:"user"
    }
},{
    timestamps:true
})

// ✅ Add the index here
messageSchema.index({ chat: 1, createdAt: 1 });

const messageModel = mongoose.model("message",messageSchema);

module.exports = messageModel;