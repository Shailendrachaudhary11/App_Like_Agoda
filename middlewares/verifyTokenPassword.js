const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    try {
        const token = req.headers["authorization"]?.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Token required" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("[TOKEN VERIFY] Error:", err.message);
        return res.status(401).json({ success: false, message: "Invalid or expired token", error: err.message });
    }
};

module.exports = verifyToken;
