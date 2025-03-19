const mongoose = require('mongoose')
const {Schema} = mongoose

const OrderSchema = new Schema ({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // reference to user model
        required: true
    },
    amount: {type: Number, required: true},
    reference: {type: String, required: true},
    status: {type: String, enum: ["pending", "paid"], default: "pending", required: true},
})

const OrderModel = mongoose.model('OrderDetails', OrderSchema)
module.exports = OrderModel
