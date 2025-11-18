// const mongoose = require("mongoose");

// const tokenBlacklistSchema = new mongoose.Schema({
//     token: { type: String, required: true },
//     expiresAt: { type: Date, required: true }
// });

// module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema({
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
});

//  Auto delete expired tokens
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
