const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const createNotification = require("../utils/notificationHelper");
const Admin = require("../models/adminUser")

exports.register = async (req, res) => {
    try {
        let { name, email, phone, password, role, address } = req.body;

        if (!name || !email || !password || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name, Email, Password, phoneNumber are required.",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters.",
            });
        }

        email = email.toLowerCase().trim();

        // Email or phone check
        const [existingUser, existingPhone] = await Promise.all([
            User.findOne({ email }),
            User.findOne({ phone })
        ]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User already registered with this email.",
            });
        }
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User already registered with this phone number.",
            });
        }

        //  Default role = "customer" agar role nahi bheja gaya
        let userRole = role ? role.toLowerCase() : "customer";

        const hashedPassword = await bcrypt.hash(password, 10);

        // New User
        const newUser = new User({
            name,
            email,
            phone,
            address: address || null,
            password: hashedPassword,
            role: userRole,
            profileImage: req.file ? req.file.filename : null,
            status: userRole === "customer" ? "approved" : "pending" //  Customers auto-approved
        });

        //  Notification only if guesthouse
        if (userRole === "guesthouse") {
            const masterAdmin = await Admin.findOne({ role: "admin" });

            if (masterAdmin) {
                await createNotification(
                    { userId: newUser._id, role: "guesthouse" }, // sender
                    { userId: masterAdmin._id, role: "admin" },   // receiver
                    "New Guesthouse Registration",
                    `Guesthouse "${newUser.name}" has registered and is waiting for approval.`,
                    "system",
                    { guesthouseId: newUser._id }
                );
                console.log("Notification sent");
            } else {
                console.warn("[NOTIFICATION] No master admin found in DB.");
            }
        }

        await newUser.save();

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message:
                userRole === "customer"
                    ? "Customer registered & approved successfully."
                    : "User created successfully. Wait for admin approval.",
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

exports.login = async (req, res) => {
    try {
        let { email, phone, password } = req.body;

        // Normalize email
        if (email) {
            email = email.toLowerCase().trim();
        }

        // Validate required fields
        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Email or phone number is required.",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Password is required.",
            });
        }

        // Find user by email or phone
        const query = email ? { email } : { phone };
        const user = await User.findOne(query);

        if (!user) {
            console.warn("[AUTH] Login failed: invalid email/phone");
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Invalid email or phone.",
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn("[AUTH] Login failed: invalid password");
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Invalid password.",
            });
        }

        // Check account status
        if (user.status !== "approved") {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Your account is not active or has been suspended.",
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "20d" }
        );

        // Format profile image URL
        const profileImage = user.profileImage
            ? `${process.env.BASE_URL || ""}/uploads/profileImage/${user.profileImage}`
            : null;

        console.log(`[AUTH] Login successful for user ID: ${user._id}`);

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profileImage,
                role: user.role,
                status: user.status,
            },
        });

    } catch (err) {
        console.error("[AUTH] Error during login:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error during login.",
        });
    }
};

exports.getMyProfile = async (req, res) => {
    try {
        const BASE_URL = process.env.BASE_URL;

        // Build profile image URL
        const profileImageUrl = req.user.profileImage
            ? `${BASE_URL}/uploads/profileImage/${req.user.profileImage}`
            : null;


        const userData = {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            address: req.user.address,
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

exports.updateProfile = async (req, res) => {
    try {
        let user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                data: null,
            });
        }

        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Request body is required",
                data: null,
            });
        }

        // Update name if provided
        if (req.body.name) {
            let name = req.body.name.toString().trim();
            if (name.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 4 characters long",
                    data: null,
                });
            }
            user.name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Update email if provided
        if (req.body.email) {
            let email = req.body.email.toString().trim().toLowerCase();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                    data: null,
                });
            }

            // Check if email already exists for another user
            const existingEmail = await User.findOne({
                email,
                _id: { $ne: req.user._id }
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another account",
                    data: null,
                });
            }

            user.email = email;
        }

        // Update phone if provided
        if (req.body.phone) {
            let phone = req.body.phone.toString().trim();

            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be a valid 10-digit number",
                    data: null,
                });
            }

            // Check if phone already exists for another user
            const existingPhone = await User.findOne({
                phone,
                _id: { $ne: req.user._id }
            });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already in use by another account",
                    data: null,
                });
            }

            user.phone = phone;
        }

        // Update profile image if uploaded
        if (req.file) {
            user.profileImage = req.file.filename;
        }

        if (req.body.address) {
            user.address = req.body.address.trim();
        }
        await user.save();


        console.log("Profile updated successfully:", user._id);

        // Construct profile image URL
        const profileImageUrl = user.profileImage
            ? `${process.env.BASE_URL || ""}/uploads/profileImage/${user.profileImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (err) {
        console.error("[PROFILE] Error updating profile:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: err.message,
        });
    }
};

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

exports.forgotPassword = async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        email = email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp; // save OTP in DB
        await user.save();

        // Generate JWT token for OTP verification
        const token = jwt.sign(
            { email: user.email, id: user._id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );

        // Send OTP via email
        const emailSent = await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}. It will expire in 10 minutes.`);
        if (!emailSent) return res.status(500).json({ success: false, message: "Failed to send OTP email." });

        return res.status(200).json({
            success: true,
            message: "OTP sent to your email.",
            token // client must send this in Authorization header
        });

    } catch (err) {
        console.error("[FORGOT PASSWORD] Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const decoded = req.user;

        if (!otp) return res.status(400).json({ success: false, message: "OTP is required" });
        if (!decoded || !decoded.email) return res.status(400).json({ success: false, message: "Invalid token" });

        const user = await User.findOne({ email: decoded.email, _id: decoded.id });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });


        if (user.otp !== otp.toString()) return res.status(400).json({ success: false, message: "Invalid OTP" });

        // OTP correct → generate reset token
        const resetToken = jwt.sign(
            { email: user.email, id: user._id, action: "resetPassword" },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );

        // Clear OTP after use
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: "OTP verified", resetToken });

    } catch (err) {
        console.error("[VERIFY OTP] Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const decoded = req.user; // from verifyToken middleware

        if (!newPassword || !confirmPassword)
            return res.status(400).json({ success: false, message: "New password and confirm password are required" });

        if (newPassword !== confirmPassword)
            return res.status(400).json({ success: false, message: "Passwords do not match" });

        if (newPassword.length < 6)
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

        if (decoded.action !== "resetPassword")
            return res.status(400).json({ success: false, message: "Invalid reset token" });

        const user = await User.findOne({ email: decoded.email, _id: decoded.id });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Update password
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = null; // clear OTP after success
        await user.save();

        return res.status(200).json({ success: true, message: "Password reset successfully" });

    } catch (err) {
        console.error("[RESET PASSWORD] Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
    }
};
