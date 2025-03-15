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
const devMode = true  // set to true for local development   

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
    const {username, email, password, firstName, lastName} = req.body 

  // Check username
  const usernameExists = await UserModel.findOne({ username });
  if (usernameExists) {
    return res.status(400).json({ message: "Username already exists" });
  }

  // Check email
  const emailExists = await UserModel.findOne({ email });
  if (emailExists) {
    return res.status(400).json({ message: "Email already exists" });
  }

    try {
        const hashPass = bcrypt.hashSync(password, salt)
        const userDoc = await UserModel.create({username, email, hashPass, firstName, lastName})
        res.json(userDoc) 
    } catch (e) {
        console.log(e) 
    }
})

app.post("/login", async (req, res) => {
    const { email, password} = req.body;

    // check email
    const emailExists = await UserModel.findOne({ email });
    if (!emailExists) {
      return res.status(400).json({ message: "Email does not exist" });
    }
  
    const userDoc = await UserModel.findOne({ email });
    if (userDoc) {
      const passOk = bcrypt.compareSync(password, userDoc.hashPass);
      if (passOk) {
        const secret = process.env.HASH_SECRET;
        jwt.sign(
          { email: userDoc.email, id: userDoc._id, name: userDoc.name, role: userDoc.role },
          secret,
          {},
          (err, token) => {
            if (err) return res.status(500).json({ error: "Token generation failed" });
            res.cookie("token", token, {
              httpOnly: true, 
              secure: true, // Set to false if running on localhost without HTTPS
              sameSite: "None", // Important for cross-origin cookies // set to lax because frrontend is not depolyed yet
              maxAge: 1000 * 60 * 60 * 24, // Optional: cookie expiration (1 day)
            }).json(userDoc);
          }
        );
      } else {
        res.status(400).json("Invalid credentials");
      }
    } else {
      res.status(404).json("User not found");
    }
  });

// to get user profile details
app.get("/profile", authenticateToken, async (req, res) => {
    //using middleware 

    try {
        const user = await UserModel.findById(req.user.id) // id from jwt in cookie

        if (!user) {
            res.status(404).json("User not found")
        }
        res.json(user)
    } catch (err) {
        console.log(err)  
        res.status(500).json("User not Authenticated")
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
        res.status(200).json(productDoc) 

    } catch (err) {
        res.status(422).json({message: "Wrong input"}) 
        console.log(err)
    } 
 
})

// to get the products back from the database
app.get('/allproducts', authenticateToken, async (req, res) => {
    try {
        const products = await ProductModel.find();
        res.status(200).json(products); // Add 200 OK status code
    } catch (err) {
        res.status(500).json({ error: err.message }); // Return proper error message and status
    }
});

app.get('/product/:id', authenticateToken, async (req, res) => {
    const id = req.params.id
    try {
        const product = await ProductModel.findById(id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }  // if product not found, send 404 status code and message
        res.status(200).json(product)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: "Cant get product" });
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
app.get('/vendors', authenticateToken, async(req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }
        const vendors = await UserModel.find({role: "vendor"})
        res.json(vendors)
    } catch (err) {
        console.log(err)
    }
})

// to get vendor with id 
app.get('/vendor/:id', authenticateToken, async (req, res) => {
    const id = req.params.id

    try {
        const vendor = await UserModel.findOne({_id: id , role: "vendor"})
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        res.json(vendor)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Server error" });
    }

})


// all users 
app.get("/users", authenticateToken, async (req, res) => {

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const users = await UserModel.find({})
        res.json(users)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: "Server error" });
    }
})

app.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "None",
        maxAge: 0, // delete the cookie
    }).json({ message: "Logged out" });
})

// app.get("/user/:id", (req, res) => {
//     const id = req.params.id

//     // try {
//     //     const userInfoUserModel.findById(id)
        
//     // }
// })


//do later
//






app.listen(4000)  