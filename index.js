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
const multer = require("multer")
const uploadMiddleware = multer({dest:"uploads/"})
const fs = require("fs")

const salt = bcrypt.genSaltSync(10)
const devMode = false  // set to true for local development   

// middlewares 
app.use(express.json())
app.use(cors({credentials: true, origin: devMode ? "http://localhost:5173" : "https://awoofbuyer.vercel.app"}))
app.use(cookieParser()) 
app.use("/uploads", express.static(__dirname + "/uploads"))


// JWT MIDDLEWARE 
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token; // Get token from cookies

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, process.env.HASH_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user; // Attach user data to request
        next();
    });
}; 

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
app.get("/profile", authenticateToken, async (req, res) => {
    //using middleware 

    try {
        const user = await UserModel.findById(req.user.id) // id from jwt in cookie
        res.json(user)
    } catch (err) {
        res.json("User not Authenticated")
        console.log(err)
    }
})

// add new product to the database with image upload
app.post ("/newproduct", uploadMiddleware.single("img"), authenticateToken, async (req, res) => {
    const {name, desc, price, category, location, vendor } = req.body; // add userinfo here to get the id
    
    // all fields are required
    if (!name || !desc || !price || !category || !location) {
        return res.status(400).json({ message: "All fields are required" });
    }
    
    // to add the extention form the img 
    const {originalname, path} = req.file;
    const parts =  originalname.split('.');
    const ext = parts[parts.length - 1];
    const newImg = path+"."+ext
    fs.renameSync(path, newImg)

    try {
        const productDoc = await ProductModel.create({name, desc, price, category, imgUrl: [newImg], location, vendor: req.user.id}) 
        res.json(productDoc) 

    } catch (err) {
        res.status(422).json({message: "Wrong input"}) 
        console.log(err)
    } 
 
})

// to get the products back from the database
app.get('/allproducts', async (req, res)  => {
    try {
        const products = await ProductModel.find()
        res.json(products)
    } catch (err) {
        res.json(err) 
    }
})

// upgrade to vendor
app.put('/becomeavendor',authenticateToken, async (req, res) => {
    const {businessName, address, phoneNumber, storeDescription} = req.body
    const userId = req.user.id  // user id from the token 

    try {
        const updatedUser = await UserModel.findByIdAndUpdate(userId, {
            businessName,
            businessAddress: address,
            phoneNumber,
            storeDescription,
            role: "vendor"
        }, { new: true } // to return updated document
    )

    if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
    }
        res.json(updatedUser)  // send updated user
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Server error" });
    }
    
})

// get a users who are vendors 
app.get('/vendors', async(req, res) => {
    try {
        const vendors = await UserModel.find({role: "vendor"})
        res.json(vendors)
    } catch (err) {
        console.log(err)
    }
})

// to get vendor with id 
app.get('/vendors:id', (req, res) => {
    const vendor = UserModel.findById()
})







app.listen(4000)  