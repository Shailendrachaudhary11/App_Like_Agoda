const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = (roles = []) => {
    return async (req, res, next) => {
        try {
            const token = req.headers['authorization']?.split(" ")[1];
            if (!token) return res.status(401).json({ message: "No token provided" });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) return res.status(404).json({ message: "User not found" });

            // Role-based check
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: "Only guesthouse_admin can add guesthouses" });
            }

            next();
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    }
};

module.exports = auth;
