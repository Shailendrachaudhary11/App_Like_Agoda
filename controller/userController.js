const dotenv = require("dotenv");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/sendEmail");
const crypto = require("crypto");


// ---------------------- REGISTER USER ---------------
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



