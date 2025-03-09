const mongoose = require('mongoose');
const {Schema} = mongoose;

const UserSchema = new Schema ({
    username: {type: String, unique: true},
    email: {type: String, unique: true},
    hashPass: String
}, {timestamps: true})

const UserModel = mongoose.model("User", UserSchema)

module.exports = UserModel;    