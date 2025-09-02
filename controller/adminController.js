const AdminUser = require("../models/adminUser");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ✅ Admin Registration
exports.register = async (req, res) => {
    try {
        const data = req.body;

        // Check if admin already exists
        const existingUser = await AdminUser.findOne({ email: data.email });
        if (existingUser) {
            return res.status(409).json({   // 409 = Conflict
                success: false,
                message: "Admin already registered with this email."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);
        data.password = hashedPassword;

        // Save admin
        const newUser = new AdminUser(data);
        await newUser.save();

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully.",
            data: newUser
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};

// ✅ Admin Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check admin exists
        const adminUser = await AdminUser.findOne({ email });
        if (!adminUser) {
            return res.status(401).json({   // 401 = Unauthorized
                success: false,
                message: "Invalid credentials."
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials."
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: adminUser._id, role: "admin" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            data: adminUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ✅ Approve User Request
exports.approvalRequestUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Update approval
        user.isVerified = true;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "User approved successfully.",
            data: user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};


// exports.approvalRequestGuestHouse = async (req, res) => {
//     try {
//         const { email } = req.body;

//         // Check if user exists
//         const user = await User.findOne({ email });
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found."
//             });
//         }

//         // Update approval
//         user.isVerified = true;
//         await user.save();

//         return res.status(200).json({
//             success: true,
//             message: "User approved successfully.",
//             data: user
//         });
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error.",
//             error: err.message
//         });
//     }
// };