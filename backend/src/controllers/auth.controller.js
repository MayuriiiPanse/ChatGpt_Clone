const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');

async function registerUser(req,res){
    const {fullName:{
        firstName, lastName
    },email,password}= req.body;

    const isUserExists = await userModel.findOne({email})

    if(isUserExists){
        res.status(400).json({
            message:"User Already Exists"
        });
    }

    const hashPassword = await bcrypt.hash(password,10);

    const user = await userModel.create({
        fullName:{
            firstName,lastName
        },
        email,
        password: hashPassword
    })

    const token = jwt.sign({id : user._id}, process.env.JWT_SECRET)

    res.cookie("token",token)

    res.status(201).json({
        message:"User registered successfully",
        user:{
            email: user.email,
            _id: user._id,
            fullName: user.fullName
        }
    })
}


async function loginUser(req,res){
    const{email,password} = req.body;
    const user = await userModel.findOne({email})

    if(!user){
        return res.status(400).json({
            message :"Invalid email or password!"
        })
    }
 
    const token = jwt.sign({id:user._id},process.env.JWT_SECRET);
    res.cookie("token",token);

    res.status(200).json({
        message:"User Loggedin Successfully!",
        user:{
            email: user.email,
            _id: user._id,
            fullName: user.fullName
        }
    })


}

module.exports ={
    registerUser,
    loginUser
}