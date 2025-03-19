const mongoose = require('mongoose');
const {Schema} = mongoose;

const UserSchema = new Schema ({
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    username: {type: String, unique: true, required: true},
    email: {type: String, unique: true, required: true},
    hashPass: String,
    role: { 
        type: String, 
        enum: ['user', 'vendor', 'admin'], // this is to limit the input to specifuc roles
        default: 'user', // default role for every user in "user"
        required: true 
    },

    // Vendor-specific fields 
    businessName: { type: String }, 
    businessAddress: { type: String },
    phoneNumber: { type: String },
    storeDescription: { type: String },
}, {timestamps: true})

const UserModel = mongoose.model("User", UserSchema)

module.exports = UserModel;    