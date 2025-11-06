const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const createNotification = require("../utils/notificationHelper");
const Admin = require("../models/adminUser")

exports.register = async (req, res) => {
    try {
        let { name, email, phone, password, confirmPassword, role, address } = req.body;

        //Required fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, Email, Password, and Phone are required."
            });
        }

        if (typeof confirmPassword !== "undefined") {
            if (password !== confirmPassword) {
                return res.status(400).json({ success: false, message: "Password and confirmPassword do not match" });
            }
        }

        //Password length
        if (password.length < 6 || password.length > 20) {
            return res.status(400).json({
                success: false,
                message: "Password must be between 6 and 20 characters."
            });
        }

        //Normalize email
        email = email.toLowerCase().trim();

        //Validate phone format
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ success: false, message: "Phone must be 10 digits." });
        }

        //Check duplicates (email or phone) in one query
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            const msg = existingUser.email === email
                ? "Email already registered."
                : "Phone number already registered.";
            return res.status(400).json({ success: false, message: msg });
        }

        //Validate role
        const allowedRoles = ["customer", "guesthouse"];
        let userRole = role ? role.toLowerCase() : "customer";
        if (!allowedRoles.includes(userRole)) userRole = "customer";

        //Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        //Create new user
        const newUser = new User({
            name: name.trim().charAt(0).toUpperCase() + name.trim().slice(1),
            email,
            phone,
            address: address?.trim() || null,
            password: hashedPassword,
            role: userRole,
            profileImage: null,
            status: userRole === "customer" ? "active" : "inactive"
        });

        if (req.file) {
            newUser.profileImage = req.file.filename;
        }


        //Save user first
        await newUser.save();

        // Notify admin if guesthouse
        if (userRole === "guesthouse") {
            const masterAdmin = await Admin.findOne({ role: "admin" });
            if (masterAdmin) {
                await createNotification(
                    { userId: newUser._id, role: "guesthouse" },
                    { userId: masterAdmin._id, role: "admin" },
                    "New Guesthouse Registration",
                    `Guesthouse "${newUser.name}" has registered and is waiting for approval.`,
                    "system",
                    { guesthouseId: newUser._id }
                );
            } else {
                console.warn("[NOTIFICATION] No master admin found.");
            }
        }

        // Return response
        return res.status(201).json({
            success: true,
            message: userRole === "customer"
                ? "Customer registered & approved successfully."
                : "Guesthouse registered. Wait for admin approval.",
            id: newUser._id
        });

    } catch (err) {
        console.error("[AUTH] Registration error:", err.stack);
        return res.status(500).json({
            success: false,
            message: "Registration failed.",
            error: err.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        let { email, phone, password } = req.body;

        //malize email
        if (email) {
            email = email.toLowerCase().trim();
        }

        //idate required fields
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

        //d user by email or phone
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

        //ify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn("[AUTH] Login failed: invalid password");
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Invalid password.",
            });
        }

        //ck account status
        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: "Your account is not active.",
            });
        }

        //erate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "20d" }
        );

        //mat profile image URL
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

        const userId = req.user.id;
        const user = await User.findById(userId);
        const BASE_URL = process.env.BASE_URL;

        //ld profile image URL
        const profileImageUrl = user.profileImage
            ? `${BASE_URL}/uploads/profileImage/${user.profileImage}`
            : null;


        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            role: user.role,
            status: user.status,
            profileImage: profileImageUrl
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

        let { name, email, phone, profileImage, address } = req.body || {};


        //ate name if provided
        if (name) {
            if (name.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 4 characters long",
                    data: null,
                });
            }
            user.name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        //ate email if provided
        if (email) {
            email = email.toString().trim().toLowerCase();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                    data: null,
                });
            }

            //ck if email already exists for another user
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

        //ate phone if provided
        if (phone) {
            phone = phone.toString().trim();

            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be a valid 10-digit number",
                    data: null,
                });
            }

            //ck if phone already exists for another user
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

        //ate profile image if uploaded
        if (req.file) {
            user.profileImage = req.file.filename;
        }

        if (address) {
            user.address = address.trim();
        }
        await user.save();


        console.log("Profile updated successfully:", user._id);

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

        //ck all fields
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Please provide oldPassword, newPassword, and confirmPassword."
            });
        }

        //vent reusing old password
        if (oldPassword === newPassword) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: "Old password and new password must be different."
            });
        }

        //ck if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "New password and confirm password do not match."
            });
        }

        //ays fetch user from DB to ensure password is available
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found."
            });
        }

        //ck old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Old password is incorrect."
            });
        }

        //h new password and save
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

        //erate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp; //e OTP in DB
        await user.save();

        //erate JWT token for OTP verification
        const token = jwt.sign(
            { email: user.email, id: user._id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "20m" }
        );

        //d OTP via email
        const emailSent = await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}. It will expire in 10 minutes.`);
        if (!emailSent) return res.status(500).json({ success: false, message: "Failed to send OTP email." });

        return res.status(200).json({
            success: true,
            message: "OTP sent to your email.",
            token //ent must send this in Authorization header
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

        // correct → generate reset token
        const resetToken = jwt.sign(
            { email: user.email, id: user._id, action: "resetPassword" },
            process.env.JWT_SECRET,
            { expiresIn: "20m" }
        );

        //ar OTP after use
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
        const decoded = req.user; //m verifyToken middleware

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

        //ate password
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = null; //ar OTP after success
        await user.save();

        return res.status(200).json({ success: true, message: "Password reset successfully" });

    } catch (err) {
        console.error("[RESET PASSWORD] Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
    }
};
