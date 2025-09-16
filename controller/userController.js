const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");


// ---------------------- REGISTER USER ---------------
exports.register = async (req, res) => {
    try {
        let { name, email, phone, password, role } = req.body;

        // Normalize email
        email = email.toLowerCase().trim();

        // Check mandatory fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Name, email, phone and password are required."
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User already registered with this email.",
            });
        }

        // Check if phone already exists
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User already registered with this phone number.",
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
            profileImage: req.file ? req.file.filename : null
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
        let { email, password } = req.body;

        email = email?.toLowerCase().trim();

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
            { expiresIn: "20d" }
        );

        console.log(`[AUTH] Login successfully: ${email}`);
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Login successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
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
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Build profile image URL
        const profileImageUrl = req.user.profileImage
            ? `${BASE_URL}/uploads/profileImage/${req.user.profileImage}`
            : null;


        const userData = {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role,
            status: req.user.status,
            profileImage: profileImageUrl,
            createdAt: req.user.createdAt
        };

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Profile fetched successfully",
            data: userData
        });

    } catch (err) {
        console.error("[PROFILE] Error fetching profile:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Failed to fetch profile",
            error: err.message
        });
    }
};

// ---------------- update profile -----------------
exports.updateProfile = async (req, res) => {
    try {
        console.log("Updating profile:", req.user._id);

        // Fresh user load from DB
        let user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found"
            });
        }

        if (req.body.name) {
            let name = req.body.name;
            name = name.toLowerCase().trim();
            user.name = name;
        }

        if (req.body.phone) {
            // Check if phone already exists with another user
            const existingPhone = await User.findOne({
                phone: req.body.phone,
                _id: { $ne: req.user._id }
            });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    statusCode: 400,
                    message: "Phone number already in use by another account"
                });
            }
            user.phone = req.body.phone;
        }

        if (req.file) {
            // Save only filename in DB
            user.profileImage = req.file.filename;
        }

        await user.save();

        console.log("Profile updated successfully:", user._id);

        // BASE_URL
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Profile image URL
        const profileImageUrl = user.profileImage
            ? `${BASE_URL}/uploads/profileImage/${user.profileImage}`
            : null;

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Profile updated successfully.",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status,
                profileImage: profileImageUrl,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        console.error("[PROFILE] Error updating profile:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Failed to update profile.",
            error: err.message
        });
    }
};

// ------------------ forgot password -----------
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Check all fields
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Please provide oldPassword, newPassword, and confirmPassword."
            });
        }

        // Prevent reusing old password
        if (oldPassword === newPassword) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: "Old password and new password must be different."
            });
        }

        // Check if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "New password and confirm password do not match."
            });
        }

        // Always fetch user from DB to ensure password is available
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found."
            });
        }

        // Check old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Old password is incorrect."
            });
        }

        // Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Password updated successfully.",
            data: {
                id: user._id,
                email: user.email,
                updatedAt: user.updatedAt
            }
        });

    } catch (err) {
        console.error("[PASSWORD] Error changing password:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Server error. Please try again later.",
            error: err.message
        });
    }
};

// ---------------- forgot password using email ----------
exports.forgotPassword = async (req, res) => {
    try {
        let { email } = req.body;

        // check email exist or not
        if (!email) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Email is required"
            });
        }

        email = email.toLowerCase().trim();
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found with this email"
            });
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
            return res.status(500).json({
                success: false,
                statusCode: 500,
                message: "Failed to send OTP email. Please try again later."
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "OTP has been sent to your registered email."
        });

    } catch (err) {
        console.error("Forgot Password Error:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error during forgot password process.",
            error: err.message
        });
    }
};

// ------------------- OTP verify

exports.verifyOtp = async (req, res) => {
    try {
        let { otp, email } = req.body; // email ya phone number bhejna zaroori hai

        if (!otp || !email) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "OTP and email are required."
            });
        }

        otp = otp.toString().trim();

        // User find karo
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found."
            });
        }

        // OTP check karo
        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "No OTP found. Please request a new one."
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid OTP."
            });
        }

        if (Date.now() > user.otpExpiry) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "OTP has expired. Please request a new one."
            });
        }

        // OTP clear after success
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        console.log(`[OTP] Verified successfully for user: ${user.email}`);

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "OTP verified successfully."
        });

    } catch (err) {
        console.error("[OTP] Verification Error:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error during OTP verification.",
            error: err.message
        });
    }
};

// ------------------ reset Password -----------------------
exports.resetPassword = async (req, res) => {
    try {
        let { email, newPassword, confirmPassword } = req.body;

        newPassword = newPassword?.trim();
        confirmPassword = confirmPassword?.trim();

        if (!email || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Email, new password and confirm password are required."
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Passwords do not match."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Password must be at least 6 characters long."
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found."
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        console.log(`[RESET] Password reset successful for user: ${user.email}`);

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Password reset successfully."
        });

    } catch (err) {
        console.error("[RESET] Password reset error:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error during password reset.",
            error: err.message
        });
    }
};



