const jwt = require('jsonwebtoken');
const User = require('../models/user');
const AdminUser = require('../models/adminUser');

const auth = (roles = []) => {
    return async (req, res, next) => {
        try {
            const token = req.headers['authorization']?.split(" ")[1];
            if (!token) return res.status(401).json({ message: "No token provided" });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            let user = await User.findById(decoded.id);
            let roleSource = "User";

            if (!user) {
                user = await AdminUser.findById(decoded.id);
                roleSource = "AdminUser";
            }

            if (!user) return res.status(404).json({ message: "User not found" });

            req.user = user;

            // Role check
            if (roles.length && !roles.includes(user.role)) {
                return res.status(403).json({ message: "Permission denied" });
            }

            console.log(`User from DB (${roleSource}):`, user);
            next();
        } catch (err) {
            console.error("Auth middleware error:", err.message);
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    }
};

module.exports = auth;
