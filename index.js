const express = require("express")
const app = express()
const cors = require("cors")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")
require('dotenv').config()
const { default: mongoose } = require("mongoose")
const UserModel = require("./Models/User")
const ProductModel = require("./Models/Products")

const salt = bcrypt.genSaltSync(10)

// middlewares 
app.use(express.json())
app.use(cors({credentials: true, origin: "http://localhost:5173"}))
app.use(cookieParser()) 

// DATABASE URL 

mongoose.connect(process.env.MONGO_DB) 



app.get('/test', (req, res) => {
    res.json("IT IS WORKING")
})

app.post('/register', async (req, res) => {
    const {username, email, password} = req.body 
    try {
        const hashPass = bcrypt.hashSync(password, salt)
        const userDoc = await UserModel.create({username, email, hashPass})
        res.json(userDoc) 
    } catch (e) {
        console.log(e) 
    }
})

app.post("/login", async(req, res) => {
    const { email, password} = req.body;

    const userDoc = await UserModel.findOne({email})
    if (userDoc) {
        const passOk = bcrypt.compareSync(password, userDoc.hashPass)
        if (passOk) {
            const secret = process.env.HASH_SECRET
            // signing the name email id to the token so when we decrypt it we can get the info back
            jwt.sign({email: userDoc.email, id: userDoc._id, name: userDoc.name}, secret, {}, (err , token) => {
                if (err) throw err
                res.cookie('token', token).json(userDoc) 
            }) 
        }
    } else { 
        
        res.status(404).json("user not found")
    }
})

// to get user profile details
app.get("/profile", (req, res) => {
    const secret = process.env.HASH_SECRET
    const {token} = req.cookies
    if (token) {
        // this decodes the token and returns the value we stored in it which is the userData
        jwt.verify(token, secret, {}, (err, userData) => {
            if (err) throw err
            res.json(userData)  // sending the userData to client
        })
    } else {
        res.json("no token") 
    }
    res.json("Ikenna akano")
})

app.post ("/newproduct", async (req, res) => {
    const {name, desc, price, category, img, vendor } = req.body;

    try {
        const productDoc = await ProductModel.create({name, desc, price, category, img, vendor}) 
        res.json(productDoc) 

    } catch (err) {
        res.status(422).json({message: "Wrong input"})
        console.log(err)
    } 

})




// ikennaexcel
// dPdSb7PfKPKYNUJF
// mongodb+srv://ikennaexcel:dPdSb7PfKPKYNUJF@awoofbuyer.qtll8.mongodb.net/?retryWrites=true&w=majority&appName=AwoofBuyer




app.listen(4000)  