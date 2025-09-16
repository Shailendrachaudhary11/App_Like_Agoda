const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
    {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: "Guesthouse", required: true, },
        createdAt: { type: Date, default: Date.now },
    },
);

module.exports = mongoose.model("Favorite", favoriteSchema);
