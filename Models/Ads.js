const mongoose = require('mongoose')
const {Schema} = mongoose

const AdsSchema = new Schema ({
    vendorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    vendorName: {type: String, required: true},
    duration: {type: String, required: true},
    img: {type: String, required: true},
    name: {type: String, required: true},
    price: {type: String, required: true},
    desc: {type: String, required: true},
    link: {type: String, required: true},
    location: {type: String, required: true},
    active: {type: Boolean, required: true},
}, { timestamps: true }
)

const AdsModel = mongoose.model("Ads", AdsSchema)

module.exports = AdsModel;