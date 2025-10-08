const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
    {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: "Guesthouse", required: true }, //  guesthouse added
        isFavourite: {
            type: Number,
            enum: [0, 1],   // Only 0 or 1 allowed
            default: 1
        },
        createdAt: { type: Date, default: Date.now },
    },
);

module.exports = mongoose.model("Favorite", favoriteSchema);
