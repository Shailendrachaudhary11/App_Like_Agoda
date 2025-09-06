const jwt = require('jsonwebtoken');
const User = require('../models/user');
const adminUser = require('../models/adminUser')

const auth = (roles = []) => {
    return async (req, res, next) => {
        try {
            const token = req.headers['authorization']?.split(" ")[1];
            if (!token) return res.status(401).json({ message: "No token provided" });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");

            console.log("Decoded token:", decoded);
            console.log("User from DB:", req.user);
            console.log("Roles allowed:", roles);

            if (!req.user) {
                req.user = await adminUser.findById(decoded.id).select("-password");
            }

            if (!req.user) return res.status(404).json({ message: "User not found" });

            // Role-based check
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: "Permission denied" });
            }
            next();
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    }
};

module.exports = auth;
