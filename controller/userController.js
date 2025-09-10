const dotenv = require("dotenv");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");


// ---------------------- REGISTER USER ---------------
exports.register = async (req, res) => {
    try {
        const { name, email, phone, password, role, profileImage } = req.body;

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
        });

        if (req.file) profileImage = req.file;
        await newUser.save();

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message: "User created successfully. Wait for admin approval.",
            Id: newUser._id
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

// ------------------ LOGIN USER -----------------
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(404).json({
                success: false,
                message: "email or password are missing."
            })
        }
        const user = await User.findOne({ email });
        if (!user) {
            console.warn(`[AUTH] Login failed: email is incorrect ${email}`);
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid Email",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`[AUTH] Login failed: incorrect password ${email}`);
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid Password.",
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

        console.log(`[AUTH] Login successfully: ${email}`);
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Login successfully",
            token,
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

// ----------------- get own profile ---------------
exports.getMyProfile = async (req, res) => {
    try {
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

// ---------------- update profile -----------------
exports.updateProfile = async (req, res) => {
    try {
        console.log("Updating profile ", req.user._id);

        if (req.body.name) req.user.name = req.body.name;
        if (req.body.phone) req.user.phone = req.body.phone;
        if (req.file) req.user.profileImage = req.file.path;

        await req.user.save();

        console.log("Profile updated successfully:", req.user._id);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: req.user
        });
    } catch (err) {
        console.error("Error updating profile:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: err.message
        });
    }
};


// ------------------ forgot password -----------
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;

        //  Check all fields
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Please provide oldPassword, newPassword, and confirmPassword"
            });
        }

        // 🔹 Always fetch user from DB to ensure password is available
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //  Check old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ // unauthorized
                success: false,
                message: "Old password is incorrect"
            });
        }

        //  Validate new password length
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        //  Check if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        //  Prevent reusing old password
        if (oldPassword === newPassword) {
            return res.status(409).json({ // conflict
                success: false,
                message: "Old password and new password must be different"
            });
        }

        //  Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err) {
        console.error("Error changing password:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


// ---------------- forgot password using email ----------
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "user not found" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP
        const emailSent = await sendEmail(
            user.email,
            "Password Reset OTP",
            `Your OTP is ${otp}. It will expire in 10 minutes.`
        );

        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        res.status(200).json({ success: true, message: "OTP sent to email" });

    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// ------------------- OTP verify // Verify OTP
exports.verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        const id = req.user.id;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: "user not found" });
        }

        // Validate OTP
        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        user.otp = undefined;
        user.otpExpiry = undefined;

        await user.save();
        res.status(200).json({ success: true, message: "OTP verified successfully" });

    } catch (err) {
        console.error("OTP Verification Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ------------------ reset Password -----------------------
exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        const id = req.user.id;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: "user not found" });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "Password fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        // Clear OTP
        user.otp = undefined;
        user.otpExpiry = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });

    } catch (err) {
        console.error("Set New Password Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

