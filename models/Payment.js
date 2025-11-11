const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true },

    paymentMethod: {
        type: String,
        enum: ['Card', 'Paypal', 'UPI', 'Wallet'],
        required: true
    },

    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'refunded', 'failed'],
        default: 'unpaid'
    },

    paymentDate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },

    requestId: { type: String, unique: true }
});

paymentSchema.pre('save', async function (next) {
    if (!this.requestId) {
        let unique = false;
        let reqId;

        while (!unique) {
            const randomNum = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
            reqId = `P${randomNum}`;
            const existing = await mongoose.model('Payment').findOne({ requestId: reqId });
            if (!existing) unique = true;
        }

        this.requestId = reqId;
    }
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);
