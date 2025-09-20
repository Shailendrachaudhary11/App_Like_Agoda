const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
    {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true }, // ✅ room added
        createdAt: { type: Date, default: Date.now },
    },
);

module.exports = mongoose.model("Favorite", favoriteSchema);
