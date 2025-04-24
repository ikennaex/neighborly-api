const express = require("express");
const app = express();
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { default: mongoose } = require("mongoose"); 
const UserModel = require("./Models/User");
const ProductModel = require("./Models/Products");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/", limits: { fileSize: 10 * 1024 * 1024 }, });
const fs = require("fs");
const OrderModel = require("./Models/OrderDetails");
const AdsModel = require("./Models/Ads");

const port = process.env.PORT || 4000; // Use Passenger's assigned port or default to 3000

const salt = bcrypt.genSaltSync(10);
const devMode = false; // set to true for local development

// middlewares
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173", "https://neighborly-44ly.onrender.com"],  
    // https://neighborly.ng

  })
);
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

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

mongoose.connect(process.env.MONGO_DB).then(() => console.log('Database connected'))
.catch((err) => console.error('Error connecting to database:', err));;

app.get("/test", (req, res) => { 
  res.json("IT IS WORKING");   
});

app.post("/register", async (req, res) => {
  const { username, email, phoneNumber, password, firstName, lastName } = req.body;

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

  // check phone number 
  const phoneNumberExist = await UserModel.findOne({phoneNumber})
  if (phoneNumberExist) {
    return res.status(400).json({message: "Email already exixts"})
  }

  try {
    const hashPass = bcrypt.hashSync(password, salt);
    const userDoc = await UserModel.create({
      username,
      email,
      phoneNumber,
      hashPass,
      firstName,
      lastName,
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Check if it's a phone number or an email using regex
const isPhone = /^\d{10,15}$/.test(email);

  // check email
  const emailExists = await UserModel.findOne(isPhone ? { phoneNumber: email } : { email }); // this checks for email and phone number
  if (!emailExists) {
    return res.status(400).json({ message: "Email or Phone does not exist" });
  }

  const userDoc = await UserModel.findOne(isPhone ? { phoneNumber: email } : { email }); 
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.hashPass);
    if (passOk) {
      const secret = process.env.HASH_SECRET;
      jwt.sign(
        {
          email: userDoc.email,
          phone: userDoc.phoneNumber,
          id: userDoc._id,
          name: userDoc.name,
          role: userDoc.role,
        }, 
        secret,
        {},
        (err, token) => {
          if (err)
            return res.status(500).json({ error: "Token generation failed" });
          res
            .cookie("token", token, {
                httpOnly: true,
                secure: true, // Ensures it only works on HTTPS
                sameSite: "None", // Required for cross-origin cookies
                path: "/",
                maxAge: 1000 * 60 * 60 * 24, // 1 day
            })
            .json(userDoc);
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
    const user = await UserModel.findById(req.user.id); // id from jwt in cookie

    if (!user) {
      res.status(404).json("User not found");
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json("User not Authenticated");
  }
});

// add new product to the database with image upload
app.post(
  "/newproduct",
  uploadMiddleware.single("img"),
  authenticateToken,
  async (req, res) => {
    const { name, desc, price, category, location } = req.body;

    // Validate all required fields
    if (!name || !desc || !price || !category || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Extract image details
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newImg = path + "." + ext;

    // Rename the file asynchronously
    fs.rename(path, newImg, async (err) => {
      if (err) {
        console.error("Error renaming file:", err);
        return res.status(500).json({ message: "File rename failed" });
      }

      try {
        const productDoc = await ProductModel.create({
          name,
          desc,
          price,
          category,
          imgUrl: [newImg],
          location,
          vendor: req.user.id,
        });

        res.status(200).json(productDoc);
      } catch (err) {
        console.error("Database error:", err);
        res.status(422).json({ message: "Wrong input" });
      }
    });
  }
);

app.put("/editproduct/:id", uploadMiddleware.single("img"), authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, desc, price, category, location } = req.body;
  let updatedFields = { name, desc, price, category, location };

  try {
    // try to find product
    const product = await ProductModel.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user is the vendor of the product (optional, for extra security)
    if (req.user.id !== product.vendor.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this product" });
    }

    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newImg = path + "." + ext;
      fs.renameSync(path, newImg);

      // Add new image to updated fields
      updatedFields.imgUrl = [newImg];
    }

    // updated product
    const updatedProduct = await ProductModel.findByIdAndUpdate(
      id,
      updatedFields,
      { new: true }
    );
    res.status(200).json(updatedProduct); // return the updates product
  } catch (err) {
    console.error(err);
    res.status(500).json("server error ");
  }
});

// delete the product
app.delete("/delete/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the user is authorized:
    // If the user is vendor and owns the product, allow
    if (
      req.user.role !== "admin" &&
      product.vendor.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this product" });
    }

    // OPTIONAL: Delete product image from uploads/ if exists
    if (product.imgUrl && product.imgUrl.length > 0) {
      const fs = require("fs");
      product.imgUrl.forEach((imgPath) => {
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath); // delete image file
        }
      });
    }
    // Delete product from database
    await ProductModel.findByIdAndDelete(id);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err)
    res.status(500).json("server error");
  }
});

// to get the products back from the database
app.get("/allproducts", authenticateToken, async (req, res) => {
  try {
    const products = await ProductModel.find();
    res.status(200).json(products); // Add 200 OK status code
  } catch (err) {
    res.status(500).json({ error: err.message }); // Return proper error message and status
  }
});

app.get("/product/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  try {
    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    } // if product not found, send 404 status code and message
    res.status(200).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cant get product" });
  }
});

// upgrade to vendor
app.put("/becomeavendor", authenticateToken, async (req, res) => {
  const { businessName, address, phoneNumber, storeDescription } = req.body;
  const userId = req.user.id; // user id from the token

  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        businessName,
        businessAddress: address,
        phoneNumber,
        storeDescription,
        role: "vendor",
      },
      { new: true } // to return updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser); // send updated user
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// get a users who are vendors
app.get("/vendors", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    const vendors = await UserModel.find({ role: "vendor" });
    res.json(vendors);
  } catch (err) {
    console.error(err);
  }
});

// to get vendor with id
app.get("/vendor/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;

  try {
    const vendor = await UserModel.findOne({ _id: id, role: "vendor" });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// all users
app.get("/users", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const users = await UserModel.find({});
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/runadvert", authenticateToken, uploadMiddleware.single("img"), (req, res) => {  
  const {duration, price, name, desc, link, location, vendorName} = req.body;
  const userId = req.user.id;

        // Validate all required fields
        if (!name || !desc || !price || !duration || !link || !location || !vendorName ) {  
          return res.status(400).json({ message: "All fields are required" });
        }
    
        // Extract image details  
        if (!req.file) {
          return res.status(400).json({ message: "Image is required" });
        }
    
        const { originalname, path } = req.file;
        const parts = originalname.split(".");
        const ext = parts[parts.length - 1];
        const newImg = path + "." + ext;
    
        // Rename the file asynchronously
        fs.rename(path, newImg, async (err) => {
          if (err) {
            console.error("Error renaming file:", err);
            return res.status(500).json({ message: "File rename failed" });
          }

          try {
            const adsDoc = await AdsModel.create({
              duration,
              vendorName,
              img: newImg,
              price,
              name,
              desc,
              link,
              location,
              active:false,
              vendorId: userId,
              
            });
    
            res.status(200).json(adsDoc);
          } catch (err) {
            console.error("Database error:", err);
            res.status(422).json({ message: "Wrong input" });
          }
        

        })
  
})

app.get("/runadvert", authenticateToken, async (req, res) => {
  try {
    // if (req.user.role !== "admin") {
    //     return res.status(403).json({ message: "Access denied. Admins only." });
    //   }
    const ads = await AdsModel.find()
    res.status(200).json(ads)
} catch(err) {
    console.error(err) 
    res.status(500).json({ message: "Server error" })  
}
})

app.put("/runadvert", authenticateToken, async (req, res) => {
  const { adId } = req.body;

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." }); 
  }

  if (!adId) {
    return res.status(400).json({ message: "Ad ID is required" });
  }

  try {
    const updatedAd = await AdsModel.findByIdAndUpdate( adId,
      { active: true },
      { new: true } // Return the updated document
    );

    if (!updatedAd) {
      return res.status(404).json({ message: "Ad not found" });
    }

    res.status(200).json(updatedAd);
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({ message: "Server error" });
  }
})

app.post("/logout", (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",  
      path: "/",
      maxAge: 0, // delete the cookie
    })
    .json({ message: "Logged out" });
});

// payment with paystack
app.post("/verify-payment", authenticateToken, async(req, res) => {
    const { transaction_id, vendorId, vendorName, userName, fetchedProduct } = req.body;
    const user = req.user.id
    const flutterwaveSecret = process.env.FLUTTERWAVE_SECRET_KEY

    try {
        const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
            headers: {
                Authorization: `Bearer ${flutterwaveSecret}`, 
            }
        })

        const data = response.data
        if (data.status === "success") {
            // save order details to database
            OrderModel.create({
                userId: user,
                userName: userName,
                vendorId: vendorId,
                vendorName: vendorName,
                product: fetchedProduct,
                amount: data.data.amount,
                reference: data.data.flw_ref,
                status: "paid",
            })
        }

        res.json(data)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
})

app.get("/transactions", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
          }
        const orders = await OrderModel.find()
        res.status(200).json(orders)
    } catch(err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
})

app.get("/transaction/:id", authenticateToken, async (req, res) => {
  const userId = req.params.id

  try {
    const userTransaction = await OrderModel.find({userId})
    if (!userTransaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.status(200).json(userTransaction)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

// vendor order 
app.get("/orders/:id", authenticateToken, async (req, res) => {
  const vendorId = req.params.id

  try {
    const vendorOrder = await OrderModel.find({vendorId})
    if (!vendorOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(vendorOrder)
  } catch(err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

app.get("/categories/:categoryName", authenticateToken, async (req, res) => {
  const category = req.params.categoryName

  try {
    const products = await ProductModel.find({category}) 

    if (products.length === 0) {
      return res.status(404).json({message: "No products found in this category"})
    }

    res.status(200).json(products)

  } catch (err) {
    res.status(500).json({ message: 'Server error', err })
  }
})


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);  
}); 
