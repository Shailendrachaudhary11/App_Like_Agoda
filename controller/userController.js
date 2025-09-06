const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// REGISTER USER
exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.warn(`[AUTH] User already exists: ${email}`);
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User already registered with this email.",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user
        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role,
            profileImage: req.file ? req.file.path : undefined, // multer se aayi file
        });

        await newUser.save();

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message: "User created successfully. Wait for admin approval.",
            data: newUser,
        });
    } catch (err) {
        console.error("[AUTH] Error during registration:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Something went wrong during registration.",
            error: err.message,
        });
    }
};

// LOGIN USER
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            console.warn(`[AUTH] Login failed: user not found ${email}`);
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid credentials",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`[AUTH] Login failed: incorrect password ${email}`);
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid credentials",
            });
        }

        // Check approval for guesthouse_admin
        if (user.status !== "approved") {
            console.warn(`[AUTH] Login failed: user not verified ${email}`);
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Your account is not approved by admin yet.",
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        console.log(`[AUTH] Login successful: ${email}`);
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Login successful",
            token,
            role: user.role,
        });
    } catch (err) {
        console.error("[AUTH] Error during login:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal Server Error during login",
            error: err.message,
        });
    }
};

// get own profile
exports.getMyProfile = async (req, res) => {
    try {
        // req.user is already set by verifyToken middleware
        res.status(200).json({
            success: true,
            data: req.user
        });
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
            error: err.message
        });
    }
};

// update profile
exports.updateProfile = async (req, res) => {
    try {
        if (req.body.name) req.user.name = req.body.name;
        if (req.body.email) req.user.email = req.body.email;
        if (req.body.phone) req.user.phone = req.body.phone;


        if (req.file) {
            req.user.profileImage = req.file.path;
        }
        await req.user.save();
        res.status(200).json({
            success: true,
            data: req.user
        })


    } catch (err) {
        console.error("Error updated profile:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: err.message
        });
    }
}

exports.changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        if (!email || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: "false",
                message: "Please provide Email, OldPassword, NewPassword"
            })
        }
        const user = await User.findOne({email});
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Old password is incorrect" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        await user.save();
        res.status(200).json({ success: true, message: "Password updated successfully" });
    }
    catch (err) {
        console.error("Error changing password:", err.message);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
}

