const mongoose = require('mongoose')
const {Schema} = mongoose

const OrderSchema = new Schema ({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // reference to user model
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // reference to user model
        required: true
    },
    vendorName: {
        type: String, required: true, 
    },
    product: {
        type: Map,
        required: true
    },
    amount: {type: Number, required: true},
    reference: {type: String, required: true},
    status: {type: String, enum: ["pending", "paid"], default: "pending", required: true},
    
}, { timestamps: true })

const OrderModel = mongoose.model('OrderDetails', OrderSchema)
module.exports = OrderModel
