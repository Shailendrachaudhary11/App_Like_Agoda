const AdminUser = require("../models/adminUser");
const Guesthouse = require("../models/Guesthouse");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room")
const Promo = require("../models/Promo");
const User = require("../models/user")
const Booking = require("../models/Booking")
const Notification = require("../models/notification")
const createNotification = require("../utils/notificationHelper");
const sendEmail = require("../utils/sendEmail");
const Facility = require("../models/Facility");
const Island = require("../models/Island");
const Review = require("../models/review");
const Payment = require("../models/Payment");
const Atoll = require("../models/Atoll");
const RoomCategory = require('../models/RoomCategory');
const BedType = require('../models/BedType');
const mongoose = require('mongoose');
const Issue = require("../models/Issue");
const moment = require("moment-timezone");
const PayoutRequest = require("../models/PayoutRequest");

const BASE_URL = process.env.BASE_URL;


// function capitalize(str) {
//     if (!str) return "";
//     return str.charAt(0).toUpperCase() + str.slice(1);
// }

function capitalize(name) {
    if (!name) return "";

    return name
        .trim()
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}



exports.register = async (req, res) => {
    try {
        const data = req.body;

        console.log("Register request data:", data);

        // Check existing user by email
        const existingUser = await AdminUser.findOne({ email: data.email });
        if (existingUser) {
            console.log("Admin already exists:", data.email);
            return res.status(409).json({
                success: false,
                message: "Admin already registered with this email."
            });
        }

        // Hash password
        data.password = await bcrypt.hash(data.password, 10);

        // Create new admin
        const newUser = new AdminUser(data);

        // Save profile image filename (not full path)
        if (req.file) {
            newUser.profileImage = req.file.filename;
            console.log("Profile image set:", req.file.filename);
        }

        await newUser.save();

        console.log("Admin registered successfully:", newUser._id);

        // BASE_URL
        const BASE_URL = process.env.BASE_URL;

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully.",
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                profileImage: newUser.profileImage
                    ? `${BASE_URL}/uploads/adminImage/${newUser.profileImage}`
                    : null,
                createdAt: newUser.createdAt
            }
        });
    } catch (err) {
        console.error("Error in admin registration:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};

exports.addUser = async (req, res) => {
    try {
        let { name, email, password, role, phone } = req.body;

        // Trim input
        name = name?.trim();
        email = email?.trim();
        role = role?.trim();
        phone = phone?.trim();

        // Name validation
        if (!name || name.length < 3 || !/^[A-Za-z\s]+$/.test(name)) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 3 characters and contain only alphabets."
            });
        }

        // Email validation
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Phone validation (optional)
        if (!phone && !/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be 10 digits."
            });
        }

        // Role validation
        const validRoles = ["Manager", "Supervisor"];
        if (!role || !validRoles.includes(capitalize(role))) {
            return res.status(400).json({
                success: false,
                message: "Role must be Manager or Supervisor."
            });
        }

        // Check email exists
        const emailExist = await AdminUser.findOne({ email });
        if (emailExist) {
            return res.status(400).json({
                success: false,
                message: "Email already exists."
            });
        }

        // Capitalize name & role
        name = capitalize(name);
        role = capitalize(role);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Image
        let adminImage = null;
        if (req.file) {
            adminImage = req.file.filename;
        }

        // Save user
        const newAdmin = new AdminUser({
            name,
            email,
            phone,
            password: hashedPassword,
            role,
            adminImage
        });

        await newAdmin.save();

        return res.status(201).json({
            success: true,
            message: "Admin user created successfully",
            data: newAdmin
        });

    } catch (error) {
        console.log("Add User Error:", error);
        // Catch mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error while add user by admin",
            error: error.message
        });
    }
};

exports.login = async (req, res) => {
    try {

        let { email, password, phone } = req.body || {};
        console.log("Admin login attempt:", email);

        if (email) {
            email = email.toLowerCase().trim();
        }

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: "Please provide email or phone"
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required.",
            });
        }

        const query = email ? { email } : { phone };
        const adminUser = await AdminUser.findOne(query);

        if (!adminUser) {
            console.warn("[AUTH] Login failed: invalid email/phone");
            return res.status(401).json({
                success: false,
                message: "Invalid email or phone.",
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) {
            console.log("Invalid password attempt for:", email);
            return res.status(401).json({
                success: false,
                message: "Invalid password."
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: adminUser._id, role: adminUser.role, name: adminUser.name },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        console.log("Admin logged in successfully:", adminUser._id);

        return res.status(200).json({
            success: true,
            message: "Login successfully.",
            token: token,
            data: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                role: adminUser.role
            }
        });
    } catch (error) {
        console.error("Error in admin login:", error.message);
        return res.status(500).json({
            success: false,
            message: "Error while login admin users",
            error: error.message
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;

        // check amdinId present or not
        if (!adminId) {
            return res.status(400).json({
                success: false,
                message: "Admin ID is missing in request.",
                data: null,
            });
        }

        const admin = await AdminUser.findById(adminId)
            .select("-password -__v -createdAt") // exclude sensitive/unnecessary fields
            .lean(); // return plain JS object (faster)

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found.",
                data: null,
            });
        }

        admin.adminImage = admin.adminImage
            ? `${BASE_URL}/uploads/adminImage/${admin.adminImage}`
            : null;


        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully.",
            data: admin,
        });
    } catch (error) {
        console.error("Error in getProfile:", error);

        return res.status(500).json({
            success: false,
            message: "Error while get profile.",
            data: null,
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;

        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Admin ID missing from token.",
            });
        }

        let user = await AdminUser.findById(adminId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
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

            const nameRegex = /^[A-Za-z\s]+$/;
            if (!nameRegex.test(name)) {
                return res.status(400).json({
                    success: false,
                    message: "Name must contain only letters (A–Z, a–z)",
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

            // Check uniqueness in AdminUser collection
            const existingEmail = await AdminUser.findOne({
                email,
                _id: { $ne: adminId }
            });

            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another admin",
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

            // Check uniqueness in AdminUser collection
            const existingPhone = await AdminUser.findOne({
                phone,
                _id: { $ne: adminId }
            });

            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already in use by another admin",
                    data: null,
                });
            }

            user.phone = phone;
        }

        // Update profile image if uploaded
        if (req.file) {
            user.adminImage = req.file.filename;
        }


        // Update address if provided
        if (req.body.address) {
            user.address = req.body.address.trim();
        }

        await user.save();

        console.log("Admin profile updated successfully:", user._id);

        // Return success
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                userId: user._id,
                profileImage: user.adminImage ? `${process.env.BASE_URL || ""}/uploads/adminImage/${user.adminImage}` : null
            }
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
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Request body is missing. Please provide oldPassword and newPassword."
            });
        }
        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Check all fields
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Please provide oldPassword, newPassword, and confirmPassword."
            });
        }

        // Prevent reusing old password
        if (oldPassword === newPassword) {
            return res.status(400).json({
                success: false,
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
        const adminUser = await AdminUser.findById(req.user.id);
        if (!adminUser) {
            return res.status(404).json({
                success: false,
                message: "adminUser not found."
            });
        }

        // Check old password
        const isMatch = await bcrypt.compare(oldPassword, adminUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect."
            });
        }

        // Hash new password and save
        adminUser.password = await bcrypt.hash(newPassword, 10);
        await adminUser.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
            data: {
                id: adminUser._id,
                email: adminUser.email
            }
        });

    } catch (err) {
        console.error("[PASSWORD] Error changing password:", err.message);
        return res.status(500).json({
            success: false,
            message: "Error while change password.",
            error: err.message
        });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        email = email.toLowerCase().trim();
        const user = await AdminUser.findOne({ email });
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
        const emailSent = await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}. It will expire in 20 minutes.`);
        if (!emailSent) return res.status(500).json({ success: false, message: "Failed to send OTP email." });

        return res.status(200).json({
            success: true,
            message: "OTP sent to your email.",
            token //ent must send this in Authorization header
        });

    } catch (err) {
        console.error("[FORGOT PASSWORD] Error:", err);
        return res.status(500).json({ success: false, message: "Error while forgot password.", error: err.message });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const decoded = req.user;

        if (!otp) return res.status(400).json({ success: false, message: "OTP is required" });
        if (!decoded || !decoded.email) return res.status(400).json({ success: false, message: "Invalid token" });

        const user = await AdminUser.findOne({ email: decoded.email, _id: decoded.id });
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
        return res.status(500).json({ success: false, message: "Error while verify otp.", error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const decoded = req.user; //m verifyToken middleware

        const user = await AdminUser.findOne({ email: decoded.email, _id: decoded.id });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (!newPassword || !confirmPassword)
            return res.status(400).json({ success: false, message: "New password and confirm password are required" });

        if (newPassword !== confirmPassword)
            return res.status(400).json({ success: false, message: "Passwords do not match" });

        if (newPassword.length < 6)
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

        if (decoded.action !== "resetPassword")
            return res.status(400).json({ success: false, message: "Invalid reset token" });

        //ate password
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = null; //ar OTP after success
        await user.save();

        return res.status(200).json({ success: true, message: "Password reset successfully" });

    } catch (err) {
        console.error("[RESET PASSWORD] Error:", err);
        return res.status(500).json({ success: false, message: "Error while reset password.", error: err.message });
    }
};

//__________________

// exports.getAllSupervisors = async (req, res) => {
//     try {
//         console.log(req.user.role);
//         let supervisors = await AdminUser.find({ role: 'Supervisor' }).select("name email phone adminImage status");

//         if (!supervisors || supervisors.length === 0) {
//             return res.status(404).json({ success: false, message: 'No supervisors found' });
//         }

//         // Add full URL for adminImage
//         supervisors = supervisors.map((admin) => {
//             return {
//                 ...admin._doc, // spread all other fields
//                 adminImage: admin.adminImage
//                     ? `${BASE_URL}/uploads/adminImage/${admin.adminImage}`
//                     : null
//             };
//         });

//         return res.status(200).json({
//             success: true,
//             count: supervisors.length,
//             data: supervisors
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
//     }
// };

exports.getAllSupervisorsMananger = async (req, res) => {
    try {
        const { role } = req.body; // expecting "Supervisor" or "Manager"

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Please provide a role (Supervisor or Manager)"
            });
        }

        let users = await AdminUser.find({ role })
            .select("name email phone adminImage status role");

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No ${role}s found`
            });
        }

        // Add image URL
        users = users.map((user) => {
            return {
                ...user._doc,
                adminImage: user.adminImage
                    ? `${BASE_URL}/uploads/adminImage/${user.adminImage}`
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            count: users.length,
            role: role,
            data: users
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

exports.getUserByRoleAndId = async (req, res) => {
    try {
        const { userId, role } = req.body;

        if (!userId || !role) {
            return res.status(400).json({
                success: false,
                message: "Please provide userId and role"
            });
        }

        const user = await AdminUser.findOne({ _id: userId, role })
            .select("-password -otp -otpExpiry -createdAt -updatedAt -__v");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: `${role} not found`
            });
        }

        // Add full image URL
        if (user.adminImage) {
            user.adminImage = `${BASE_URL}/uploads/adminImage/${user.adminImage}`;
        }

        return res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};


exports.activeInactiveUserByRole = async (req, res) => {
    try {
        const { userId, role } = req.body;

        if (!userId || !role) {
            return res.status(400).json({
                success: false,
                message: "Please provide userId and role."
            });
        }

        let user = await AdminUser.findOne({ _id: userId, role });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: `${role} not found.`
            });
        }

        // Toggle status
        user.status = user.status === "Active" ? "Inactive" : "Active";
        await user.save();

        // Add image URL
        if (user.adminImage && !user.adminImage.startsWith("http")) {
            user.adminImage = `${BASE_URL}/uploads/adminImage/${user.adminImage}`;
        }

        return res.status(200).json({
            success: true,
            message: `${role} ${user.status} successfully.`,
            data: {
                id: user._id,
                role: user.role,
                status: user.status,
                adminImage: user.adminImage
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to update status.",
            error: err.message
        });
    }
};



exports.updateUserByRole = async (req, res) => {
    try {
        let { userId, role, name, email, phone } = req.body;

        if (!userId || !role) {
            return res.status(400).json({
                success: false,
                message: "Please provide userId and role."
            });
        }

        // Find user based on ID + ROLE
        let user = await AdminUser.findOne({ _id: userId, role });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: `${role} not found`
            });
        }

        // ---- VALIDATIONS ----
        if (name && (name.length < 3 || name.length > 50 || !/^[A-Za-z\s]+$/.test(name))) {
            return res.status(400).json({
                success: false,
                message: "Name must be 3–50 characters long & only contain letters."
            });
        }

        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format."
            });
        }

        if (phone && !/^\d{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be 10 digits."
            });
        }

        // ---- UPDATE FIELDS ----
        if (name) name = capitalize(name);
        if (name) user.name = name.trim();
        if (email) user.email = email.trim();
        if (phone) user.phone = phone.trim();

        // ---- UPDATE IMAGE ----
        if (req.file) {
            user.adminImage = req.file.filename;
        }

        await user.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: `${role} updated successfully`,
            data: user
        });

    } catch (error) {
        console.error("Error updating user by role:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

exports.deleteUserByRole = async (req, res) => {
    try {
        const { userId, role } = req.body;

        if (!userId || !role) {
            return res.status(400).json({
                success: false,
                message: "Please provide userId and role."
            });
        }

        const user = await AdminUser.findOneAndDelete({ _id: userId, role });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: `${role} not found`
            });
        }

        return res.status(200).json({
            success: true,
            message: `${role} deleted successfully`
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};



// ___________________________________________________

exports.getDashboardData = async (req, res) => {
    try {
        // Count all required stats
        const totalBookings = await Booking.countDocuments();
        const totalCustomers = await User.countDocuments({ role: "customer" });
        const totalGuesthouses = await Guesthouse.countDocuments();

        const bookings = await Booking.find({ status: { $in: ["confirmed", "completed"] } });

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0);

        // Send successful response
        return res.status(200).json({
            success: true,
            message: "Dashboard data fetched successfully",
            data: {
                totalBookings,
                totalRevenue,
                totalCustomers,
                totalGuesthouses
            }
        });

    } catch (error) {
        console.error("[DASHBOARD] Error fetching data:", error);
        return res.status(500).json({
            success: false, // should be boolean, not string
            message: "Error fetching dashboard data",
            error: error.message
        });
    }
};

exports.getMonthlyReports = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        let matchStage = {};
        if (startDate && endDate) {
            matchStage = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        const groupStage = startDate && endDate
            ? {
                $group: {
                    _id: null,
                    bookings: { $sum: 1 },
                    cancellations: {
                        $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                    },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $in: ["$status", ["confirmed", "completed"]] },
                                "$finalAmount",
                                0
                            ]
                        }
                    }
                }
            }
            : {
                $group: {
                    _id: { $month: "$createdAt" },
                    bookings: { $sum: 1 },
                    cancellations: {
                        $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                    },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $in: ["$status", ["confirmed", "completed"]] },
                                "$finalAmount",
                                0
                            ]
                        }
                    }
                }
            };

        const sortStage = startDate && endDate ? { "_id": 1 } : { "_id": 1 };

        const reports = await Booking.aggregate([
            { $match: matchStage },
            groupStage,
            { $sort: sortStage }
        ]);

        let formattedData;

        if (startDate && endDate) {
            // Single summary result
            const result = reports[0] || { bookings: 0, cancellations: 0, revenue: 0 };
            return res.status(200).json({
                success: true,
                message: `Report from ${startDate} to ${endDate}`,
                data: result
            });
        } else {
            // Monthly data
            const months = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];
            formattedData = months.map((month, index) => {
                const found = reports.find(r => r._id === index + 1);
                return {
                    month,
                    bookings: found ? found.bookings : 0,
                    cancellations: found ? found.cancellations : 0,
                    revenue: found ? found.revenue : 0
                };
            });
        }

        res.status(200).json({
            success: true,
            message: startDate && endDate
                ? "Successfully fetched daily data"
                : "Successfully fetched monthly data",
            data: formattedData
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getAllGuestOwner = async (req, res) => {
    try {
        const guestOwners = await User.find({
            role: "guesthouse"
        })
            .select('name email phone address profileImage status createdAt')
            .sort({ createdAt: -1 });

        const updatedGuestOwners = guestOwners.map(guestOwner => {
            const guestOwnerObj = guestOwner.toObject();
            if (guestOwnerObj.profileImage) {
                guestOwnerObj.profileImage = `${BASE_URL}/uploads/profileImage/${guestOwnerObj.profileImage}`;
            }
            return guestOwnerObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all guesthouse owners.",
            count: updatedGuestOwners.length,
            data: updatedGuestOwners
        });
    } catch (err) {
        console.error("[CUSTOMER] Error fetching customers:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching guesthouse owners",
            error: err.message
        });
    }
};

exports.getGuestOwnerById = async (req, res) => {
    try {
        const { guestHouseOwnerId } = req.body;

        // Validate ID format
        if (!guestHouseOwnerId) {
            return res.status(400).json({
                success: false,
                message: "Valid GuestHouse Owner ID is required.",
                data: null,
            });
        }

        const guestHouseOwner = await User.findById(guestHouseOwnerId)
            .select('name email phone address profileImage role status createdAt')
            .lean();

        if (!guestHouseOwner) {
            return res.status(404).json({
                success: false,
                message: "GuestHouse Owner not found.",
                data: null,
            });
        }

        // Full profile image URL
        guestHouseOwner.profileImage = guestHouseOwner.profileImage
            ? `${process.env.BASE_URL || ""}/uploads/profileImage/${guestHouseOwner.profileImage}`
            : null;

        if (guestHouseOwner.status) {
            guestHouseOwner.status = guestHouseOwner.status.charAt(0).toUpperCase() + guestHouseOwner.status.slice(1);
        }

        return res.status(200).json({
            success: true,
            message: "GuestHouse Owner fetched successfully.",
            data: guestHouseOwner,
        });

    } catch (error) {
        console.error("Error fetching GuestHouse Owner by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Could not fetch GuestHouse Owner.",
            error: error.message
        });
    }
};

exports.activeInactiveOwner = async (req, res) => {
    try {
        const { guestHouseOwnerId } = req.body;
        if (!guestHouseOwnerId) {
            return res.status(400).json({ success: false, message: "owner ID is required." });
        }

        const owner = await User.findById(guestHouseOwnerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "guesthouse owner not found."
            });
        }

        if (owner.status === "active") {
            owner.status = "inactive"
        }

        else {
            owner.status = "active"
        }

        await owner.save();
        const subject = `Your guesthouse account is ${owner.status}`;
        const message = `Dear ${owner.name},\n\nYour guesthouse account has been ${owner.status}.\n\nThank you,\nTeam Cheap RoomsMV`;

        // Send email
        sendEmail(owner.email, subject, message)
            .then(() => console.log("Email sent"))
            .catch((emailErr) => console.error("Email sending failed:", emailErr.message));

        return res.status(200).json({
            success: true,
            message: `Guesthouse owner ${owner.status} successfully.`,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "error while active-inactive guesthouse owner",
            error: error
        })
    }
}

exports.updatedGuestOwner = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "plz provide req body"
            })
        }
        const { guestHouseOwnerId, name, email, phone, address } = req.body;

        if (!name && !email && !phone && !address && !req.file) {
            res.status(400).json({
                success: false,
                message: "At least one field (name, email, phone, address, or image) must be provided.",
            })
        }
        if (!guestHouseOwnerId) {
            return res.status(400).json({
                success: false,
                message: "guestHouseOwnerId is required."
            });
        }

        const owner = await User.findById(guestHouseOwnerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "guesthouse owner not found."
            });
        }

        //  Update basic fields
        if (name) owner.name = name;
        if (email) owner.email = email;
        if (phone) owner.phone = phone;
        if (address) owner.address = address;

        //  Handle image upload correctly
        if (req.file) {
            owner.profileImage = req.file.filename; // or full URL if needed
        }

        await owner.save();

        return res.status(200).json({
            success: true,
            message: "Guesthouse owner updated successfully."
        });

    } catch (error) {
        console.error("Error updating guesthouse owner:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating guesthouse owner",
            error: error.message
        });
    }
};

exports.deleteOwner = async (req, res) => {
    try {
        const { guesthouseOwnerId } = req.body;

        if (!guesthouseOwnerId) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse ownerId is missing.",
            });
        }

        // Find owner
        const owner = await User.findById(guesthouseOwnerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse owner not found.",
            });
        }

        // Delete owner
        await User.findByIdAndDelete(guesthouseOwnerId);

        return res.status(200).json({
            success: true,
            message: "Guesthouse owner deleted successfully.",
        });

    } catch (error) {
        console.error("Delete Owner Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting guesthouse owner.",
            error: error.message,
        });
    }
};



// exports.getPendingRegistration = async (req, res) => {
//     try {
//         const guestOwners = await User.find({ role: "guesthouse", status: "pending" })
//             .select('name email phone address profileImage status createdAt')
//             .sort({ createdAt: -1 });

//         const updatedGuestOwners = guestOwners.map(guestOwner => {
//             const guestOwnerObj = guestOwner.toObject();
//             if (guestOwnerObj.profileImage) {
//                 guestOwnerObj.profileImage = `${BASE_URL}/uploads/profileImage/${guestOwnerObj.profileImage}`;
//             }
//             return guestOwnerObj;
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Successfully fetched all pending guesthouse registration.",
//             count: updatedGuestOwners.length,
//             data: updatedGuestOwners
//         });
//     } catch (err) {
//         console.error("[CUSTOMER] Error fetching customers:", err.message);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error while fetching customers",
//             error: err.message
//         });
//     }
// };


exports.getAllGuestHouses = async (req, res) => {
    try {
        // const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        const guestHouses = await Guesthouse.find()
            .select("-location -owner -description -facilities -__v -createdAt -isFavourite")
            .populate("atolls", "name")
            .populate("islands", "name")
            .sort({ createdAt: -1 }) // lateset first
            .lean();

        if (!guestHouses.length) {
            return res.status(200).json({
                success: true,
                NoOfGuestHouse: 0,
                message: "No guesthouses found.",
                data: []
            });
        }

        // Add full image URLs & reviews count
        const guestHousesWithUrls = await Promise.all(
            guestHouses.map(async gh => {

                // Images full URL
                if (gh.guestHouseImage && Array.isArray(gh.guestHouseImage)) {
                    gh.guestHouseImage = gh.guestHouseImage.map(
                        img => `${BASE_URL}/uploads/guestHouseImage/${img}`
                    );
                }

                // Count reviews correctly
                try {
                    const reviews = await Review.countDocuments({ guesthouse: gh._id });
                    gh.reviews = reviews;
                } catch {
                    gh.reviews = 0;
                }

                gh.name = gh.name.charAt(0).toUpperCase() + gh.name.slice(1);


                // Replace atoll/island with their names only
                gh.atolls = gh.atolls?.name || null;
                gh.islands = gh.islands?.name || null;

                return gh;
            })
        );

        return res.status(200).json({
            success: true,
            statusCode: 200,
            NoOfGuestHouse: guestHousesWithUrls.length,
            message: "Successfully fetched all active guesthouses.",
            data: guestHousesWithUrls
        });

    } catch (err) {
        console.error("[GuestHouse] Error:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while fetching guesthouses.",
            error: err.message
        });
    }
};

// exports.updateGuestHouse = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const {
//             name,
//             address,
//             location,
//             contactNumber,
//             description,
//             price,
//             facilities,
//             stars,
//             Atoll,
//             islands
//         } = req.body;

//         const guesthouse = await Guesthouse.findById(id);

//         if (!guesthouse) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Guesthouse not found",
//             });
//         }

//         console.log(`[GUESTHOUSE] Updating guesthouse ${id} by user ${req.user?.id || "unknown"}`);

//         //  Handle images (optional)
//         if (req.files && req.files.length > 0) {
//             guesthouse.guestHouseImage = req.files.map(file => file.filename);
//         }

//         //  Dynamic fields update
//         const fields = {
//             name,
//             address,
//             contactNumber,
//             description,
//             price,
//             stars,
//             Atoll,
//             islands
//         };

//         for (const key in fields) {
//             if (fields[key] !== undefined && fields[key] !== null) {
//                 guesthouse[key] = fields[key];
//             }
//         }

//         //  Facilities update (must be array)
//         if (facilities) {
//             guesthouse.facilities = Array.isArray(facilities)
//                 ? facilities
//                 : facilities.split(",").map(f => f.trim()).filter(Boolean);
//         }

//         //  Location update (lng, lat)
//         if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
//             guesthouse.location = {
//                 type: "Point",
//                 coordinates: location.coordinates
//             };
//         }

//         await guesthouse.save();

//         //  Notification
//         await createNotification(
//             { userId: req.user.id, role: req.user.role },   // sender
//             { userId: guesthouse.owner, role: "guesthouse" }, // receiver
//             "Guesthouse Updated",
//             `Your guesthouse "${guesthouse.name}" has been updated successfully by admin.`,
//             "system",
//             { guesthouseId: guesthouse._id }
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Guesthouse updated successfully.",
//             data: guesthouse
//         });

//     } catch (err) {
//         console.error("[GUESTHOUSE] Error:", err.message);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error while updating guesthouse",
//             error: err.message,
//         });
//     }
// };


exports.getGuestHousesById = async (req, res) => {
    try {
        const { guesthouseId } = req.body;

        if (!guesthouseId) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Guesthouse Id found."
            });
        }

        // Find guesthouse by Id
        const guestHouseObj = await Guesthouse.findById(guesthouseId)
            .populate("atolls", "name")
            .populate("islands", "name")
            .populate("facilities", "name")
            .select("-isFavourite -location -createdAt -__v ").lean();


        const owner = await User.findById(guestHouseObj.owner).select("name email phone")


        if (!guestHouseObj) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Guesthouse not found.",
                data: null
            });
        }

        // Convert images into full URL paths
        if (guestHouseObj.guestHouseImage && guestHouseObj.guestHouseImage.length > 0) {
            guestHouseObj.guestHouseImage = guestHouseObj.guestHouseImage.map(
                img => `${BASE_URL}/uploads/guestHouseImage/${img}`
            );
        } else {
            guestHouseObj.guestHouseImage = [];
        }

        // guestHouseObj.stars = guestHouseObj.stars != null ? parseFloat(guestHouseObj.stars).toFixed(1) : "0.0";
        guestHouseObj.cleaningFee = guestHouseObj.cleaningFee ? parseFloat(guestHouseObj.cleaningFee) : 0;
        guestHouseObj.taxPercent = guestHouseObj.taxPercent ? parseFloat(guestHouseObj.taxPercent) : 0;
        // Convert Atoll, islands, facilities to proper format
        if (guestHouseObj.Atoll && typeof guestHouseObj.Atoll === "object") {
            guestHouseObj.Atoll = guestHouseObj.Atoll.name;
        }
        if (guestHouseObj.islands && typeof guestHouseObj.islands === "object") {
            guestHouseObj.islands = guestHouseObj.islands.name;
        }
        if (guestHouseObj.facilities && Array.isArray(guestHouseObj.facilities)) {
            guestHouseObj.facilities = guestHouseObj.facilities.map(f => f.name);
        }


        const reviews = await Review.find({ guesthouse: guesthouseId }).sort({ createdAt: -1 });

        let rating = 0;
        let reviewScore = 0;
        let reviewsCount = reviews.length;
        let reviewsText = "";

        const getRatingComment = (avgRating) => {
            if (avgRating >= 4.5) return "Excellent";
            else if (avgRating >= 4.0) return "Very Good";
            else if (avgRating >= 3.5) return "Good";
            else if (avgRating >= 3.0) return "Average";
            else return "Poor";
        };


        if (reviewsCount > 0) {
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);

            // Calculate average rating
            reviewScore = totalRating / reviewsCount;
            rating = reviewScore.toFixed(1);
            reviewsText = getRatingComment(reviewScore);
        }

        reviewScore = parseFloat(reviewScore.toFixed(1));

        guestHouseObj.rating = Number(rating);
        guestHouseObj.reviewsCount = reviewsCount;
        // guestHouseObj.reviewScore = reviewScore;
        guestHouseObj.reviewsText = reviewsText;

        guestHouseObj.name = guestHouseObj.name.charAt(0).toUpperCase() + guestHouseObj.name.slice(1);
        guestHouseObj.status = guestHouseObj.status.charAt(0).toUpperCase() + guestHouseObj.status.slice(1);


        guestHouseObj.ownerDetails = owner
            ? {
                name: owner.name,
                email: owner.email,
                phone: owner.phone
            }
            : null;

        // Successfully fetched guesthouse details
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Guesthouse fetched successfully.",
            data: guestHouseObj
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while fetching guesthouse.",
            error: err.message
        });
    }
};

exports.activeInactiveGuesthouse = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "Guesthouse ID is required." });
        }

        console.log(`[GUESTHOUSE] Activating and Inactivating guesthouse: ${id}`);

        // Populate owner to safely access _id and email
        const guesthouse = await Guesthouse.findById(id).populate("owner", "name email _id");
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        // Already active?
        if (guesthouse.status === "active") {
            guesthouse.status = "inactive"
        }

        else if (guesthouse.status === "inactive") {
            guesthouse.status = "active"
        }

        else {
            guesthouse.status = "active"
        }

        await guesthouse.save();

        // Send notification to owner if exists
        if (guesthouse.owner?._id) {
            await createNotification(
                guesthouse.owner._id,
                "general",
                `Your guesthouse "${guesthouse.name}" has been ${guesthouse.status} by admin.`,
                { guesthouseId: guesthouse._id }
            );
            console.log(`[GUESTHOUSE] Notification sent to owner: ${guesthouse.owner._id}`);
        }

        return res.status(200).json({
            success: true,
            message: `Guesthouse ${guesthouse.status} successfully.`,
            data: {
                id: guesthouse._id,
                name: guesthouse.name,
                ownerName: guesthouse.owner?.name,
                ownerEmail: guesthouse.owner?.email,
                status: guesthouse.status
            }
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error activating guesthouse:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to activate guesthouse.",
            error: err.message
        });
    }
};

exports.deleteGuesthouse = async (req, res) => {
    try {
        const { guesthouseId } = req.body;

        //  Validate ID
        if (!mongoose.Types.ObjectId.isValid(guesthouseId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guesthouse ID",
            });
        }

        //  Find guesthouse
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found",
            });
        }

        //  Delete guesthouse
        await Guesthouse.findByIdAndDelete(guesthouseId);

        return res.status(200).json({
            success: true,
            message: `Guesthouse "${guesthouse.name}" deleted successfully.`,
        });

    } catch (error) {
        console.error("[Guesthouse] delete error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting guesthouse",
            error: error.message,
        });
    }
};

// exports.approveGuesthouseRegistration = async (req, res) => {
//     try {
//         const { id } = req.body; // taking id from request body

//         if (!id) {
//             return res.status(400).json({ success: false, message: "Guesthouse ID is required." });
//         }

//         console.log(`[GUESTHOUSE] Approving registration: ${id}`);

//         // Find guesthouse user by ID and role
//         const guesthouseUser = await User.findOne({ _id: id, role: "guesthouse" });
//         if (!guesthouseUser) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Guesthouse registration not found."
//             });
//         }

//         if (guesthouseUser.status === "approved") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Guesthouse registration is already approved.",
//                 data: {
//                     id: guesthouseUser._id,
//                     name: guesthouseUser.name,
//                     email: guesthouseUser.email,
//                     status: guesthouseUser.status
//                 }
//             });
//         }

//         // Update status (First letter capital)
//         guesthouseUser.status = "approved";
//         await guesthouseUser.save();

//         console.log(`[GUESTHOUSE] Registration approved: ${id}`);

//         // Send approval email
//         const emailSent = await sendEmail(
//             guesthouseUser.email,
//             `Congratulations! Your Guesthouse Registration is Approved`,
//             `Dear ${guesthouseUser.name},

// We are pleased to inform you that your guesthouse registration has been successfully approved.  
// You can now log in to your account and proceed with the next steps to manage your guesthouse.

// Here are your registered details:
// - Owner Name: ${guesthouseUser.name}
// - Email: ${guesthouseUser.email}
// - Phone: ${guesthouseUser.phone}

// Next Steps:
// 1. Login to your account using your registered email.
// 2. Complete your guesthouse profile (add images, amenities, pricing, etc.).
// 3. Start managing your rooms, availability, and bookings.

// If you face any issues, feel free to reach out to our support team.

// Best Regards,  
// Team Guesthouse Management`
//         );

//         if (!emailSent)
//             return res.status(500).json({
//                 success: false,
//                 message: "Registration notification email not sent.",
//             });

//         return res.status(200).json({
//             success: true,
//             message: "Guesthouse registration approved successfully.",
//             data: {
//                 id: guesthouseUser._id,
//                 name: guesthouseUser.name,
//                 email: guesthouseUser.email,
//                 status: guesthouseUser.status,
//                 approvedAt: new Date()
//             }
//         });
//     } catch (err) {
//         console.error("[GUESTHOUSE] Error approving registration:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to approve guesthouse registration.",
//             error: err.message
//         });
//     }
// };

// exports.rejectGuesthouseRegistration = async (req, res) => {
//     try {
//         const { id } = req.body;
//         console.log("Rejecting guesthouse registration:", id);

//         const guesthouseUser = await User.findOne({ _id: id, role: "guesthouse" });
//         if (!guesthouseUser) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Guesthouse registration not found."
//             });
//         }

//         if (guesthouseUser.status === "reject") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Guesthouse registration is already reject.",
//                 data: {
//                     id: guesthouseUser._id,
//                     name: guesthouseUser.name,
//                     email: guesthouseUser.email,
//                     status: guesthouseUser.status
//                 }
//             });
//         }

//         guesthouseUser.status = "reject";

//         await guesthouseUser.save();

//         // email send to registration email for reject registration
//         await sendEmail(
//             guesthouseUser.email,
//             `Guesthouse Registration Update`,

//             `Dear ${guesthouseUser.name},

//                 We regret to inform you that your guesthouse registration has been reject at this time.  
//                 This may be due to incomplete information, verification issues, or other reasons specified in your application.

//                 Here are your submitted details:
//                 - Owner Name: ${guesthouseUser.name}
//                 - Email: ${guesthouseUser.email}
//                 - Phone: ${guesthouseUser.phone}

//                  Next Steps:
//                 1. Review the details you submitted and ensure all required information is complete and accurate.
//                 2. Correct any discrepancies and submit a new application if applicable.
//                 3. Contact our support team for further assistance or clarification regarding your application.

//                 We appreciate your interest in joining our platform and encourage you to reapply after resolving the issues.

//                 Best Regards,  
//                 Team Guesthouse Management`
//         );


//         console.log("Guesthouse registration rejected:", id);
//         return res.status(200).json({
//             success: true,
//             message: "Guesthouse registration rejected successfully.",
//             data: guesthouseUser
//         });
//     } catch (err) {
//         console.error("Error registration rejecting  guesthouse:", err.message);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to registration reject of guesthouse.",
//             error: err.message
//         });
//     }
// };

// ________________________________________________________



exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find().select("guesthouse photos active");

        if (!rooms.length) {
            return res.status(404).json({
                success: false,
                message: "No rooms found"
            });
        }

        // Collect all unique guesthouse IDs to avoid multiple DB hits
        const guesthouseIds = [...new Set(rooms.map(r => r.guesthouse.toString()))];

        // Fetch all guesthouses in one go
        const guesthouses = await Guesthouse.find({ _id: { $in: guesthouseIds } })
            .select("name address contactNumber");

        // Create a map for quick lookup
        const guesthouseMap = {};
        guesthouses.forEach(gh => {
            guesthouseMap[gh._id.toString()] = gh;
        });

        // Format room response
        const formattedRooms = rooms.map(room => {
            const roomObj = room.toObject();
            const guesthouse = guesthouseMap[room.guesthouse?.toString()];

            return {
                _id: roomObj._id,
                guesthouseName: guesthouse?.name || "Unknown",
                guesthouseAddress: guesthouse?.address || "Unknown",
                guesthousePhone: guesthouse?.contactNumber || "NO",
                status: roomObj.active || "inactive",
                photos:
                    roomObj.photos && roomObj.photos.length > 0
                        ? roomObj.photos.map(photo => `${BASE_URL}/uploads/rooms/${photo.trim()}`)
                        : []
            };
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all rooms.",
            totalRooms: formattedRooms.length,
            data: formattedRooms
        });
    } catch (err) {
        console.error("[ROOM] Error fetching rooms:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching rooms",
            error: err.message
        });
    }
};


exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId not found."
            });
        }

        //  Fetch room with guesthouse populated
        const room = await Room.findById(roomId)
            .populate({
                path: "guesthouse",
                select: "name address contactNumber description"
            })
            .populate({
                path: "roomCategory",
                select: "name"
            })
            .populate({
                path: "bedType",
                select: "name"
            })
            .populate({
                path: "facilities",   // 🆕 populate facilities
                select: "name" // optional fields
            })
            .select("roomCategory bedType capacity photos amenities pricePerNight priceWeekly priceMonthly description active facilities")

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        //  Convert to plain object
        const roomObj = room.toObject();

        roomObj.roomCategory = roomObj.roomCategory.name;
        roomObj.bedType = roomObj.bedType.name;
        roomObj.status = roomObj.active;
        delete roomObj.active;

        //  Update room photos with full URL
        if (roomObj.photos && roomObj.photos.length > 0) {
            roomObj.photos = roomObj.photos.map(
                (photo) => `${BASE_URL}/uploads/rooms/${photo.trim()}`
            );
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched room",
            data: roomObj,
        });

    } catch (err) {
        console.error("[ROOM] Error fetching room:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching room",
            error: err.message,
        });
    }
};

exports.activeInactive = async (req, res) => {
    try {
        const { roomId } = req.body;

        //  Validate roomId
        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId is required",
            });
        }

        //  Find room by ID
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        //  Toggle status (use consistent field name)
        if (room.active === "active") {
            room.active = "inactive"
        }
        else {
            room.active = "active"
        }

        await room.save({ validateBeforeSave: false });

        //  Send proper response
        return res.status(200).json({
            success: true,
            message: `Room status updated successfully to '${room.active}'`,
            data: {
                roomId: room._id,
                status: room.active,
            },
        });

    } catch (error) {
        console.error("Error updating room status:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating room status",
            error: error.message,
        });
    }
};


exports.deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.body;

        //  Validate roomId
        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId is required",
            });
        }

        // Use findById if roomid is MongoDB _id
        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        await room.deleteOne();

        res.status(200).json({
            success: true,
            message: "Successfully delete room",
            room: room
        });
    } catch (err) {
        console.log("Error while deleting room:", err);
        res.status(500).json({
            success: false,
            message: "Error deleting room"
        });
    }
};

//______________________________________________________________

exports.getAllCustomer = async (req, res) => {
    try {
        const customers = await User.find({ role: "customer" })
            .select("name phone address profileImage status")

        const updatedCustomers = customers.map(customer => {
            const customerObj = customer.toObject();
            if (customerObj.profileImage) {
                customerObj.profileImage = `${BASE_URL}/uploads/profileImage/${customerObj.profileImage}`;
            }
            return customerObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all customers.",
            count: updatedCustomers.length,
            data: updatedCustomers
        });
    } catch (err) {
        console.error("[CUSTOMER] Error fetching customers:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching customers",
            error: err.message
        });
    }
};

exports.getCustomerById = async (req, res) => {
    try {
        const customerId = req.body.id; // get Id from url

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer Id."
            });
        }

        const customer = await User.findOne({ _id: customerId, role: "customer" }).select("name email phone address profileImage status createdAt updatedAt");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        const customerObj = customer.toObject();
        if (customerObj.profileImage) {
            customerObj.profileImage = `${BASE_URL}/uploads/profileImage/${customerObj.profileImage}`;
        }

        return res.status(200).json({
            success: true,
            message: "Customer fetched successfully.",
            data: customerObj
        });

    } catch (err) {
        console.error("[CUSTOMER] Error fetching customer by id:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching customer by id",
            error: err.message
        });
    }
};

exports.activeInactiveCustomer = async (req, res) => {
    try {
        const customerId = req.body.id; // get Id from url

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer Id."
            });
        }

        const user = await User.findById(customerId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "customer not found."
            });
        }

        if (user.status === "active") {
            user.status = "inactive";
        }
        else {
            user.status = "active";
        }

        await user.save();

        const subject = `Your account is ${user.status}`;
        const message = `Dear ${user.name},\n\nYour customer account has been ${user.status}.\n\nThank you,\nTeam Cheap RoomsMV`;

        // Send email
        sendEmail(user.email, subject, message)
            .then(() => console.log("Email sent"))
            .catch((emailErr) => console.error("Email sending failed:", emailErr.message));

        return res.status(200).json({
            success: true,
            message: `User ${user.status} successfully.`,
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: `Failed to ${user.status} user.`,
            error: err.message
        });
    }
};

exports.updateCustomer = async (req, res) => {
    try {

        const { customerId, name, email, phone, address } = req.body || {};

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "customerId not found"
            })
        }

        let user = await User.findById(customerId);
        if (!user) return res.status(404).json({ success: false, message: "Customer not found", data: null });


        if (name) {
            const trimmedName = name.toString().trim();
            if (trimmedName.length < 4)
                return res.status(400).json({ success: false, message: "Name must be at least 4 characters long", data: null });
            user.name = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
        }

        if (email) {
            const emailLower = email.toString().trim().toLowerCase();
            const existingEmail = await User.findOne({ email: emailLower, _id: { $ne: customerId } });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower))
                return res.status(400).json({ success: false, message: "Invalid email format", data: null });
            if (existingEmail)
                return res.status(400).json({ success: false, message: "Email already in use", data: null });
            user.email = emailLower;
        }

        if (phone) {
            const phoneStr = phone.toString().trim();
            const existingPhone = await User.findOne({ phone: phoneStr, _id: { $ne: customerId } });
            if (!/^[0-9]{10}$/.test(phoneStr))
                return res.status(400).json({ success: false, message: "Phone must be 10 digits", data: null });
            if (existingPhone)
                return res.status(400).json({ success: false, message: "Phone already in use", data: null });
            user.phone = phoneStr;
        }

        if (address) user.address = address.toString().trim();
        if (req.file) user.profileImage = req.file.filename;

        await user.save();

        const profileImageUrl = user.profileImage ? `${process.env.BASE_URL}/uploads/profileImage/${user.profileImage}` : null;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role: user.role,
                profileImage: profileImageUrl,
                createdAt: user.createdAt,
            },
        });

    } catch (err) {
        console.error("[PROFILE] Error updating profile:", err);
        return res.status(500).json({ success: false, message: "Failed to update profile.", error: err.message });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        const customerId = req.body.id;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer Id."
            });
        }
        const customer = await User.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        await customer.deleteOne();

        const subject = `Account Deleted`;
        const message = `Dear ${customer.name},\n\nYour customer account has been deleted by admin.\n\nThank you\nTeam Cheap RoomsMV`;

        // Send email
        sendEmail(customer.email, subject, message)
            .then(() => console.log("Email sent"))
            .catch((emailErr) => console.error("Email sending failed:", emailErr.message));

        return res.status(200).json({
            success: true,
            message: "Customer successfully deleted."
        });

    } catch (error) {
        console.error("[DELETE CUSTOMER] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete customer.",
            error: error.message
        });
    }
};

//___________________________________________________BOOKING ____________________________________

exports.getAllBooking = async (req, res) => {
    try {

        const bookings = await Booking.find()
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -updatedAt");

        // Auto-update confirmed bookings to 'completed' if checkOut < today
        const today = new Date();
        for (let booking of bookings) {
            if (booking.status === "confirmed" && new Date(booking.checkOut) < today) {
                booking.status = "completed";
                await booking.save();
            }
        }

        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
                }
            }

            // Room count logic
            let roomCount = 0;
            if (Array.isArray(booking.room)) {
                roomCount = booking.room.length;
            } else if (typeof booking.room === "number") {
                roomCount = booking.room;
            } else if (booking.room) {
                roomCount = 1;
            }

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg: guestHouseImg,
                guestHouseName: guesthouse.name
                    ? guesthouse.name.charAt(0).toUpperCase() + guesthouse.name.slice(1)
                    : "",
                guestHouseAddress: guesthouse.address || "",
                checkIn: booking.checkIn
                    ? new Date(booking.checkIn).toISOString().split("T")[0]
                    : "",
                checkOut: booking.checkOut
                    ? new Date(booking.checkOut).toISOString().split("T")[0]
                    : "",
                room: roomCount,
                guest: booking.guest,
                amount: booking.amount,
                finalAmount: booking.finalAmount,
                status: booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1),
                paymentStatus: booking.paymentStatus,
            };
        });

        res.status(200).json({
            success: true,
            message: "Successfully fetched your bookings.",
            count: formattedBookings.length,
            data: formattedBookings,
        });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching all bookings.",
            error: error.message,
        });
    }
};

exports.getBookingById = async (req, res) => {
    let bookingId;
    try {
        bookingId = req.body.bookingId; // booking id from body

        const booking = await Booking.findOne({
            _id: bookingId
        })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .populate({
                path: "room",
                select: "roomCategory name",
                populate: {
                    path: "roomCategory",
                    select: "name"
                }
            })
            .populate({
                path: "customer",
                select: "name phone profileImage"
            });


        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const payment = await Payment.findOne({ booking: booking._id });

        const guesthouse = booking.guesthouse || {};
        const customer = booking.customer || {};

        // Guest House Image
        let guestHouseImg = "";
        if (guesthouse.guestHouseImage) {
            if (Array.isArray(guesthouse.guestHouseImage) && guesthouse.guestHouseImage.length > 0) {
                guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
            } else if (typeof guesthouse.guestHouseImage === "string") {
                guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage.split(",")[0].trim()}`;
            }
        }

        let roomCount = 0;
        let roomType = [];

        if (booking.room) {
            if (Array.isArray(booking.room)) {
                roomCount = booking.room.length;
                roomType = booking.room.map(r => r?.roomCategory?.name || "");
            }
            else {
                roomCount = 1;
                roomType = [booking.room?.roomCategory?.name || ""];
            }
        }

        const paymentDetails = payment
            ? {
                customerName: customer.name || "",
                customerName: customer?.name
                    ? customer.name.trim().charAt(0).toUpperCase() + customer.name.trim().slice(1)
                    : "",
                customerProfileImage: `${BASE_URL}/uploads/profileImage/${customer.profileImage}`,
                customerContact: customer.phone || "",
                paymentMethod: payment.paymentMethod,
                paymentStatus: payment.paymentStatus
                    ? payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1)
                    : "",
                paymentDate: payment.paymentDate
                    ? new Date(payment.paymentDate).toISOString().split("T")[0]
                    : null,
            }
            : {
                customerName: customer.name,
                customerProfileImage: `${BASE_URL}/uploads/profileImage/${customer.profileImage}`,
                customerContact: customer.phone || "",
                paymentMethod: "N/A",
                paymentStatus: "N/A",
                paymentDate: "N/A",
            };

        const formattedBooking = {
            id: bookingId,
            guesthouse: guesthouse._id || null,
            guestHouseImg: guestHouseImg,
            guestHouseName: guesthouse.name || "",
            guestHouseAddress: guesthouse.address || "",
            checkIn: booking.checkIn ? new Date(booking.checkIn).toISOString().split("T")[0] : "",
            checkOut: booking.checkOut ? new Date(booking.checkOut).toISOString().split("T")[0] : "",
            totalNights: booking.nights,
            room: roomCount,
            roomType: roomType || "",
            guest: booking.guest || {}, // guest info
            amount: booking.amount || 0,
            discount: booking.discount,
            cleaningFee: booking.cleaningFee,
            taxAmount: booking.taxAmount,
            finalAmount: booking.finalAmount || 0,
            status: booking.status.charAt(0).toUpperCase() +
                booking.status.slice(1),
            createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : "",
            updatedAt: booking.updatedAt ? new Date(booking.updatedAt).toISOString().split("T")[0] : "",
            paymentDetails: paymentDetails
        };

        res.status(200).json({
            success: true,
            message: "Successfully fetched booking details.",
            data: formattedBooking
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Error fetching booking.",
            error: error.message
        });
    }
};

exports.pastBooking = async (req, res) => {
    try {
        const today = new Date();

        const pastBookings = await Booking.find({
            checkOut: { $lt: today }, // booking already ended
        })
            .sort({ checkIn: 1 }) // najdik wali trip pehle
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (pastBookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No past booking found"
            })
        }

        const formattedBookings = pastBookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
                } else if (typeof guesthouse.guestHouseImage === "string") {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage.split(",")[0].trim()}`;
                }
            }

            // Room count logic
            let roomCount = 0;
            if (Array.isArray(booking.room)) {
                roomCount = booking.room.length;
            } else if (typeof booking.room === "number") {
                roomCount = booking.room;
            } else if (booking.room) {
                roomCount = 1;
            }

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg: guestHouseImg,
                guestHouseName: guesthouse.name || "",
                guestHouseAddress: guesthouse.address || "",
                checkIn: booking.checkIn
                    ? new Date(booking.checkIn).toISOString().split("T")[0]
                    : "",
                checkOut: booking.checkOut
                    ? new Date(booking.checkOut).toISOString().split("T")[0]
                    : "",
                room: roomCount,
                guest: booking.guest,
                amount: booking.amount,
                finalAmount: booking.finalAmount,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
            };
        });

        return res.status(200).json({
            success: true,
            message: "past bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings
        });


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to fetching past booking.",
            Error: error
        })
    }
}

exports.upcomingBookings = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // din ka start time fix

        const bookings = await Booking.find({
            checkIn: { $gte: today },  // future ya aaj ki bookings
            status: { $in: ["pending", "confirmed"] } // active bookings only
        })
            .sort({ checkIn: 1 }) // najdik wali trip pehle
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!bookings || bookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No upcoming bookings found.",
                count: 0,
                data: []
            });
        }

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
                } else if (typeof guesthouse.guestHouseImage === "string") {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage.split(",")[0].trim()}`;
                }
            }

            // Room count logic
            let roomCount = 0;
            if (Array.isArray(booking.room)) {
                roomCount = booking.room.length;
            } else if (typeof booking.room === "number") {
                roomCount = booking.room;
            } else if (booking.room) {
                roomCount = 1;
            }

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg: guestHouseImg,
                guestHouseName: guesthouse.name || "",
                guestHouseAddress: guesthouse.address || "",
                checkIn: booking.checkIn
                    ? new Date(booking.checkIn).toISOString().split("T")[0]
                    : "",
                checkOut: booking.checkOut
                    ? new Date(booking.checkOut).toISOString().split("T")[0]
                    : "",
                room: roomCount,
                guest: booking.guest,
                amount: booking.amount,
                finalAmount: booking.finalAmount,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
            };
        });

        return res.status(200).json({
            success: true,
            message: "Upcoming bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings
        });

    } catch (error) {
        console.error("Error fetching upcoming bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching upcoming trips.",
            error: error.message
        });
    }
}

exports.getCancelBookings = async (req, res) => {
    try {


        const bookings = await Booking.find({ status: "cancelled" })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!bookings || bookings.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                message: "No cancelled bookings found.",
                data: []
            });
        }

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
                }
            }

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg: guestHouseImg,
                guestHouseName: guesthouse.name || "",
                guestHouseAddress: guesthouse.address || "",
                checkIn: booking.checkIn
                    ? new Date(booking.checkIn).toISOString().split("T")[0]
                    : "",
                checkOut: booking.checkOut
                    ? new Date(booking.checkOut).toISOString().split("T")[0]
                    : "",
                room: booking.room,
                guest: booking.guest,
                amount: booking.amount,
                finalAmount: booking.finalAmount,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
            };
        });

        res.status(200).json({
            success: true,
            count: formattedBookings.length,
            message: "Cancelled bookings fetched successfully.",
            data: formattedBookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching cancelled bookings.",
            error: error.message
        });
    }
};

exports.pendingBooking = async (req, res) => {
    try {
        const pendingBookings = await Booking.find({
            status: "pending"
        })
            .sort({ checkOut: -1 }) // latest past bookings first
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!pendingBookings || pendingBookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No pending bookings found.",
                count: 0,
                data: [],
                serverTime: new Date().toISOString()
            });
        }

        const formattedBookings = pendingBookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
                } else if (typeof guesthouse.guestHouseImage === "string") {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage.split(",")[0].trim()}`;
                }
            }

            // Room count logic
            let roomCount = 0;
            if (Array.isArray(booking.room)) {
                roomCount = booking.room.length;
            } else if (typeof booking.room === "number") {
                roomCount = booking.room;
            } else if (booking.room) {
                roomCount = 1;
            }

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg: guestHouseImg,
                guestHouseName: guesthouse.name || "",
                guestHouseAddress: guesthouse.address || "",
                checkIn: booking.checkIn
                    ? new Date(booking.checkIn).toISOString().split("T")[0]
                    : "",
                checkOut: booking.checkOut
                    ? new Date(booking.checkOut).toISOString().split("T")[0]
                    : "",
                room: roomCount,
                guest: booking.guest,
                amount: booking.amount,
                finalAmount: booking.finalAmount,
                status: booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1), // <-- Capitalized here
                paymentStatus: booking.paymentStatus,
            };
        });


        res.status(200).json({
            success: true,
            message: "pending bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "error fetching pending bookings.",
            error: error
        })
    }
}

exports.deleteBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;

        //  Validate bookingId
        if (!bookingId || bookingId.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Booking ID is required",
            });
        }

        // Find and delete booking
        const booking = await Booking.findByIdAndDelete(bookingId);

        //  If booking not found
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        //  Success response
        return res.status(200).json({
            success: true,
            message: "Booking deleted successfully",
            deletedBooking: booking,
        });

    } catch (error) {
        console.error("Error deleting booking:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


//___________________________________________________PROMO ____________________________________


exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find().sort({ createdAt: -1 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const promosWithUrls = promos.map(promo => ({
            ...promo.toObject(),
            code: promo.code.toUpperCase(),
            promoImage: promo.promoImage
                ? `${BASE_URL}/uploads/promoImage/${promo.promoImage}`
                : null
        }));

        res.status(200).json({
            success: true,
            count: promosWithUrls.length,
            message: "Successfully fetched all promo codes",
            data: promosWithUrls
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error fetching promos",
            error: err.message
        });
    }
};

exports.createPromo = async (req, res) => {
    try {
        const { code, discountType, discountValue, startDate, endDate } = req.body;

        //  Required fields check
        if (!code || !discountType || discountValue === undefined || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "All fields (code, discountType, discountValue, startDate, endDate) are required",
            });
        }

        //  Validate code
        if (typeof code !== 'string' || code.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: "code must be a string and at least 3 characters long",
            });
        }
        const trimmedCode = code.trim().toUpperCase();

        //  Validate discountType
        const validTypes = ["flat", "percentage"];
        if (typeof discountType !== 'string' || !validTypes.includes(discountType.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'",
            });
        }
        const normalizedType = discountType.toLowerCase();

        //  Validate discountValue
        const numericValue = Number(discountValue);
        if (isNaN(numericValue) || numericValue <= 0) {
            return res.status(400).json({
                success: false,
                message: "discountValue must be a positive number",
            });
        }

        // Validate startDate & endDate format & logic
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: "startDate and endDate must be valid dates",
            });
        }
        if (end <= start) {
            return res.status(400).json({
                success: false,
                message: "endDate must be later than startDate",
            });
        }

        //  Validate file upload
        if (!req.file || !req.file.filename) {
            return res.status(400).json({
                success: false,
                message: "Promo image is required",
            });
        }
        const promoImageFilename = req.file.filename;

        //  Check for existing promo code (duplicate)
        const existingPromo = await Promo.findOne({ code: trimmedCode });
        if (existingPromo) {
            return res.status(400).json({
                success: false,
                message: "Promo code already exists. Use a different code.",
            });
        }

        //  Create promo
        const promo = new Promo({
            code: trimmedCode,
            discountType: normalizedType,
            discountValue: numericValue,
            startDate: start,
            endDate: end,
            promoImage: promoImageFilename,
        });

        await promo.save();

        return res.status(201).json({
            success: true,
            message: "Promo created successfully",
            data: promo,
        });

    } catch (err) {
        console.error("[Promo] createPromo error:", err);

        // Handle duplicate key error (E11000)
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Promo code already exists. Please use a different code.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error while creating promo",
            error: err.message,
        });
    }
};

exports.getPromoById = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Promo ID is required"
            });
        }

        const promo = await Promo.findById(id);

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo not found"
            });
        }

        if (promo.promoImage) {
            promo.promoImage = `${BASE_URL}/uploads/promoImage/${promo.promoImage}`;
        }

        promo.code = promo.code.toUpperCase();

        return res.status(200).json({
            success: true,
            message: "Successfully fetched promo code.",
            data: promo
        });

    } catch (err) {
        console.error("Error fetching promo by ID:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching promo",
            error: err.message
        });
    }
};

exports.updatePromo = async (req, res) => {
    try {
        const { id, code, discountType, discountValue, startDate, endDate } = req.body;


        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Promo ID is required"
            });
        }

        let promo = await Promo.findById(id);
        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo not found"
            });
        }

        //  Validate discountType
        if (discountType && !["flat", "percentage"].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'"
            });
        }

        //  Validate discountValue (ensure it's a number)
        if (discountValue !== undefined) {
            const value = Number(discountValue);
            if (isNaN(value) || value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "discountValue must be a number greater than 0"
                });
            }
            promo.discountValue = value;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            return res.status(400).json({
                success: false,
                message: "endDate must be later than startDate",
            });
        }

        if (startDate) {
            promo.startDate = startDate;
        }

        if (endDate) {
            promo.endDate = endDate;
        }

        //  Update other fields if provided
        if (code) promo.code = code;
        if (discountType) promo.discountType = discountType;

        //  Update image if uploaded
        if (req.file) {
            promo.promoImage = req.file.filename;
        }

        await promo.save();

        return res.status(200).json({
            success: true,
            message: "Promo updated successfully",
            data: promo
        });

    } catch (err) {
        console.error("[PROMO UPDATE] Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Error updating promo",
            error: err.message
        });
    }
};

exports.deletePromo = async (req, res) => {
    try {
        const promo = await Promo.findByIdAndDelete(req.body.id);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, message: "Promo deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting promo", error: err.message });
    }
};

exports.activeInActivePromo = async (req, res) => {
    try {
        const { promoId } = req.body;

        if (!promoId) {
            return res.status(400).json({
                success: false,
                message: "Promo ID is required."
            });
        }

        // Find promo by ID
        const promo = await Promo.findById(promoId);
        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo not found."
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        //  Check if trying to activate an expired promo
        if (promo.endDate < today && promo.status === "inactive") {
            return res.status(400).json({
                success: false,
                message: "Cannot activate this promo — its end date has already passed."
            });
        }

        if (promo.status === "active") {
            promo.status = "inactive"
        }
        else {
            promo.status = "active"
        }
        await promo.save();

        return res.status(200).json({
            success: true,
            message: `Promo has been ${promo.status} successfully.`
        });

    } catch (error) {
        console.error("[PROMO] Active/Inactive toggle error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating promo status.",
            error: error.message
        });
    }
};


//______________________________________________________ Notification __________________________

exports.getAllNotification = async (req, res) => {
    try {
        const adminId = req.user.id;

        const notifications = await Notification.find({
            "receiver.userId": adminId,
            "receiver.role": "admin",
        })
            .sort({ createdAt: -1 })
            .select("title message createdAt")
            .lean();


        if (!notifications || notifications.length === 0) {
            return res.status(200).json({
                success: true,
                statusCode: 200,
                message: "No notifications found.",
                count: 0,
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Notifications fetched successfully.",
            count: notifications.length,
            data: notifications
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to fetching notifications",
            error: error
        })
    }
}

exports.readNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;
        const adminId = req.user.id;

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": adminId,
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        //  Mark as read
        notification.isRead = true;
        await notification.save();

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: notification
        });

    } catch (err) {
        console.error("[NOTIFICATION] Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Error updating notification",
            error: err.message
        });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;
        const adminId = req.user.id;

        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": adminId,
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        await notification.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Notification successfully deleted.",
            notification: notificationId
        });

    } catch (err) {
        console.error("[NOTIFICATION] Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Error deleting notification",
            error: err.message
        });
    }
};

exports.deleteAllNotification = async (req, res) => {
    try {
        const adminId = req.user.id;

        // Find all notifications for this admin
        const notifications = await Notification.find({ "receiver.userId": adminId });

        if (!notifications || notifications.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No notifications found."
            });
        }

        // Delete all notifications for that admin
        await Notification.deleteMany({ "receiver.userId": adminId });

        return res.status(200).json({
            success: true,
            message: "All notifications deleted successfully."
        });

    } catch (error) {
        console.error("[NOTIFICATION DELETE] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting notifications.",
            error: error.message
        });
    }
};

//__________________________________ Add values

exports.getAllAtolls = async (req, res) => {
    try {
        const atolls = await Atoll.find().lean();

        const results = await Promise.all(
            atolls.map(async (atoll) => {
                const islands = await Island.countDocuments({ atoll: atoll._id });
                const image = `${BASE_URL}/uploads/atolls/${atoll.atollImage}`

                return {
                    atollId: atoll._id,
                    name: atoll.name,
                    atollImage: image,
                    noofIsland: islands,
                    status: atoll.status
                };
            })
        )
        res.status(200).json({
            success: true,
            message: "Atolls with guesthouse count fetched successfully",
            data: results,
        });

    } catch (error) {
        console.error("Error fetching atoll data:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching atoll guesthouse data",
            error: error.message,
        });
    }
}

exports.createAtoll = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Name field is required",
            });
        }

        const trimmedName = name.trim();
        const nameRegex = /^[A-Za-z\s]+$/;

        if (!nameRegex.test(trimmedName)) {
            return res.status(400).json({
                success: false,
                message: "Name should contain only letters (A–Z, a–z).",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Atoll image is required"
            });
        }

        //  FIRST LETTER CAPITAL
        const formattedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1).toLowerCase();

        const existing = await Atoll.findOne({
            name: { $regex: new RegExp(`^${formattedName}$`, "i") }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Atoll with this name already exists",
            });
        }

        const atoll = new Atoll({
            name: formattedName,
            atollImage: req.file.filename
        });

        await atoll.save();

        return res.status(201).json({
            success: true,
            message: "Atoll created successfully",
            data: atoll
        });

    } catch (err) {
        console.error("[Atoll] createAtoll error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error while creating atoll",
            error: err.message
        });
    }
};

exports.activeInActiveAtoll = async (req, res) => {
    try {
        const { atollId } = req.body;

        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "Atoll ID is required",
            });
        }

        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: `Atoll not found with ID: ${atollId}`,
            });
        }

        // Toggle status
        if (atoll.status === "active") {
            atoll.status = "inactive";
        } else {
            atoll.status = "active";
        }

        await atoll.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: `Atoll status updated to ${atoll.status}`,
            data: atoll,
        });

    } catch (error) {
        console.error("Error while toggling atoll status:", error);
        return res.status(500).json({
            success: false,
            message: "Error while updating atoll status",
            error: error.message,
        });
    }
};

exports.deleteAtoll = async (req, res) => {
    try {
        const { atollId } = req.body;

        //  Validate input
        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "Atoll ID is required."
            });
        }

        //  Check if the Atoll exists
        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "Atoll not found."
            });
        }

        //  Delete the Atoll
        await Atoll.findByIdAndDelete(atollId);

        //  Return success response
        return res.status(200).json({
            success: true,
            message: "Atoll deleted successfully."
        });

    } catch (error) {
        console.error("Error deleting Atoll:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting Atoll.",
            error: error.message
        });
    }
};

exports.editAtoll = async (req, res) => {
    try {
        const { atollId, name } = req.body;

        // 🔹 Validate atollId
        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "Atoll-ID is required",
            });
        }
        if (!mongoose.Types.ObjectId.isValid(atollId)) {
            return res.status(400).json({
                success: false,
                message: "Atoll-ID is not a valid ID",
            });
        }

        // 🔹 Validate name (if provided)
        let formattedName = null;

        if (name !== undefined) {
            if (typeof name !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Name must be a string",
                });
            }

            const trimmedName = name.trim();

            if (trimmedName.length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 3 characters",
                });
            }

            if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
                return res.status(400).json({
                    success: false,
                    message: "Name must contain only letters.",
                });
            }

            // ⭐ FIRST LETTER CAPITAL
            formattedName =
                trimmedName.charAt(0).toUpperCase() +
                trimmedName.slice(1).toLowerCase();
        }

        // 🔹 Find atoll
        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "Atoll not found",
            });
        }

        // 🔹 Duplicate Name Check (exclude current)
        if (formattedName) {
            const existing = await Atoll.findOne({
                _id: { $ne: atollId },
                name: { $regex: new RegExp(`^${formattedName}$`, "i") }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Another Atoll with this name already exists",
                });
            }

            atoll.name = formattedName;
        }

        // 🔹 Image update
        if (req.file) {
            atoll.atollImage = req.file.filename;
        }

        const updatedAtoll = await atoll.save();

        return res.status(200).json({
            success: true,
            message: "Atoll updated successfully",
            data: updatedAtoll,
        });

    } catch (error) {
        console.error("Error while editing atoll:", error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: messages
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error while editing atoll",
            error: error.message,
        });
    }
};

//______________________

exports.getAllIslands = async (req, res) => {
    try {
        const { atollId } = req.body || {};

        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "atollId is required"
            });
        }
        const atoll = await Atoll.find({ _id: atollId, status: "active" });
        if (!atoll.length) {
            return res.status(404).json({
                success: false,
                message: "No active atoll found"
            });
        }

        const islands = await Island.find({ atoll: atollId }).select("-__v -createdAt -updatedAt"); // extra fields hata sakte ho

        // Convert _id -> id
        const formattedIslands = islands.map(island => {
            const obj = island.toObject();
            obj.id = obj._id;   // new key
            delete obj._id;     // remove old _id
            return obj;
        });

        res.status(200).json({
            success: true,
            count: formattedIslands.length,
            data: formattedIslands
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching islands",
            error: error.message
        });
    }
};

exports.createIslands = async (req, res) => {
    try {
        const { name, atollId } = req.body;

        // 1. Validate input presence
        if (!name || !atollId) {
            return res.status(400).json({
                success: false,
                message: "Both name and atollId are required."
            });
        }

        // 2. Validate types & formats
        if (typeof name !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Name must be a string."
            });
        }

        let trimmedName = name.trim();

        if (trimmedName.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 3 characters long."
            });
        }

        if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
            return res.status(400).json({
                success: false,
                message: "Name must contain only letters."
            });
        }

        // 🌟 Capitalize: First letter uppercase + rest lowercase
        trimmedName =
            trimmedName.charAt(0).toUpperCase() +
            trimmedName.slice(1).toLowerCase();

        if (!mongoose.Types.ObjectId.isValid(atollId)) {
            return res.status(400).json({
                success: false,
                message: "atollId is not a valid identifier."
            });
        }

        // 3. Check if atoll exists
        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "No Atoll found with the given atollId."
            });
        }

        // 4. Case-insensitive duplicate check
        const existingIsland = await Island.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
        });

        if (existingIsland) {
            return res.status(400).json({
                success: false,
                message: "Island with this name already exists."
            });
        }

        // 5. Create new island
        const newIsland = new Island({
            name: trimmedName,
            atoll: atollId,
            createdAt: new Date()
        });

        await newIsland.save();

        return res.status(201).json({
            success: true,
            message: "Island successfully added.",
            data: newIsland
        });

    } catch (err) {
        console.error("[Island] createIsland error:", err);

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                errors
            });
        }

        return res.status(500).json({
            success: false,
            message: "An error occurred while adding the island.",
            error: err.message
        });
    }
};

exports.activeInActiveIsland = async (req, res) => {
    try {
        const { islandId } = req.body;

        if (!islandId) {
            return res.status(400).json({
                success: false,
                message: "Island ID is required",
            });
        }

        const island = await Island.findById(islandId);
        if (!island) {
            return res.status(404).json({
                success: false,
                message: `Island not found with ID: ${islandId}`,
            });
        }

        if (island.status === "active") {
            island.status = "inactive";
        } else {
            island.status = "active";
        }

        await island.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: `Island status updated to ${island.status}`,
            data: island,
        });

    } catch (error) {
        console.error("Error while toggling island status:", error);
        return res.status(500).json({
            success: false,
            message: "Error while updating island status",
            error: error.message,
        });
    }
};

exports.deleteIsland = async (req, res) => {
    try {
        const { islandId } = req.body;

        if (!islandId) {
            return res.status(400).json({
                success: false,
                message: "Island ID is required",
            });
        }

        const island = await Island.findById(islandId);
        if (!island) {
            return res.status(404).json({
                success: false,
                message: "Island not found",
            });
        }

        await Island.findByIdAndDelete(islandId);

        return res.status(200).json({
            success: true,
            message: "Island deleted successfully",
        });
    } catch (error) {
        console.error("Error while deleting island:", error);
        res.status(500).json({
            success: false,
            message: "Error while deleting island",
            error: error.message,
        });
    }
};

exports.editIsland = async (req, res) => {
    try {
        const { islandId, name } = req.body;

        if (!islandId) {
            return res.status(400).json({
                success: false,
                message: "Island ID is required",
            });
        }

        const island = await Island.findById(islandId);
        if (!island) {
            return res.status(404).json({
                success: false,
                message: "Island not found",
            });
        }

        if (name && name.trim() !== "") {
            const trimmedName = name.trim();
            const nameRegex = /^[A-Za-z\s]+$/;

            if (!nameRegex.test(trimmedName)) {
                return res.status(400).json({
                    success: false,
                    message: "Name should contain only letters (A–Z, a–z).",
                });
            }

            // ⭐ FIRST LETTER CAPITAL
            const formattedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1).toLowerCase();

            const existingIsland = await Island.findOne({
                _id: { $ne: islandId },
                name: { $regex: new RegExp(`^${formattedName}$`, "i") }
            });

            if (existingIsland) {
                return res.status(400).json({
                    success: false,
                    message: "Island with this name already exists.",
                });
            }

            island.name = formattedName;
        }

        const updatedIsland = await island.save();

        return res.status(200).json({
            success: true,
            message: "Island updated successfully",
            data: updatedIsland,
        });

    } catch (error) {
        console.error("Error while editing island:", error);
        res.status(500).json({
            success: false,
            message: "Error while editing island",
            error: error.message,
        });
    }
};


//________________________ FACILITY___________________

exports.getAllfacilities = async (req, res) => {
    try {
        const facilities = await Facility.find()
            .select("name status")
            .sort({ createdAt: -1 })
            .lean();

        const modifiedAtolls = facilities.map(facilitie => {
            const name = facilitie.name
                ? facilitie.name.charAt(0).toUpperCase() + facilitie.name.slice(1)
                : "";

            return {
                id: facilitie._id,
                name: name,
                status: facilitie.status
            };
        });

        res.status(200).json({
            success: true,
            count: modifiedAtolls.length,
            message: "Successfully fetch all facilities",
            data: modifiedAtolls
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching facilities",
            error: error.message // It's helpful to include the error message for debugging
        });
    }
};

exports.updateFacility = async (req, res) => {
    try {
        const { facilityId, name } = req.body;

        // 1. Validate facilityId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return res.status(400).json({
                success: false,
                message: "Valid facilityId is required"
            });
        }

        // 2. Find existing facility
        const facility = await Facility.findById(facilityId);
        if (!facility) {
            return res.status(404).json({
                success: false,
                message: "Facility not found"
            });
        }

        // 3. If name provided then validate it
        if (name !== undefined) {

            if (typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: "Facility name must be a non-empty string"
                });
            }

            let normalized = name.trim();

            if (normalized.length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "Facility name must be at least 3 characters long"
                });
            }

            if (!/^[A-Za-z\s]+$/.test(normalized)) {
                return res.status(400).json({
                    success: false,
                    message: "Facility name must contain only letters and spaces"
                });
            }

            // 🌟 Capitalize: First letter uppercase + rest lowercase
            normalized =
                normalized.charAt(0).toUpperCase() +
                normalized.slice(1).toLowerCase();

            // Duplicate check (ignore current facility)
            const existing = await Facility.findOne({
                name: { $regex: new RegExp(`^${normalized}$`, "i") },
                _id: { $ne: facilityId }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Another facility with this name already exists"
                });
            }

            facility.name = normalized;
        }

        // 4. Update timestamp
        facility.updatedAt = new Date();

        const updated = await facility.save();

        return res.status(200).json({
            success: true,
            message: "Facility updated successfully",
            data: updated
        });

    } catch (err) {
        console.error("[Facility] updateFacility error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating facility",
            error: err.message
        });
    }
};

exports.activeInactiveFacility = async (req, res) => {
    try {
        const { facilityId } = req.body;

        // 1. Validate facilityId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return res.status(400).json({
                success: false,
                message: "Valid facilityId is required"
            });
        }

        //  Find facility
        let facility = await Facility.findById(facilityId);
        if (!facility) {
            return res.status(404).json({
                success: false,
                message: "Facility not found"
            });
        }
        // console.log(facility);

        facility.status = facility.status === "active" ? "inactive" : "active";

        await facility.save();

        return res.status(200).json({
            success: true,
            message: `Facility status has been changed to ${facility.status} successfully`,
        });

    } catch (err) {
        console.error("[Facility] changeFacilityStatus error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error to update status of facility",
            error: err.message
        });
    }
};

exports.createFacility = async (req, res) => {
    try {
        const { name } = req.body;

        // 1. Required check
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Facility name is required and must be a string"
            });
        }

        let normalized = name.trim();

        // 2. Length check
        if (normalized.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Facility name must be at least 3 characters long"
            });
        }

        // 3. Letters only
        if (!/^[A-Za-z\s]+$/.test(normalized)) {
            return res.status(400).json({
                success: false,
                message: "Facility name must contain only letters and spaces"
            });
        }

        // 🌟 4. Capitalize First Letter + Lowercase Rest
        normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();

        // 5. Duplicate check (case-insensitive)
        const existing = await Facility.findOne({
            name: { $regex: new RegExp(`^${normalized}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Facility already exists"
            });
        }

        // 6. Save
        const facility = new Facility({
            name: normalized,
            status: "active"
        });

        await facility.save();

        return res.status(201).json({
            success: true,
            message: "Successfully added facility",
            data: facility
        });

    } catch (err) {
        console.error("[Facility] createFacility error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};

exports.deleteFacility = async (req, res) => {
    try {
        const { facilityId } = req.body;

        //  Validate input
        if (!facilityId) {
            return res.status(400).json({
                success: false,
                message: "Facility ID is required."
            });
        }

        //  Check if the facility exists
        const facility = await Facility.findById(facilityId);
        if (!facility) {
            return res.status(404).json({
                success: false,
                message: "Facility not found."
            });
        }

        //  Delete the facility
        await Facility.findByIdAndDelete(facilityId);

        //  Return success response
        return res.status(200).json({
            success: true,
            message: "Facility deleted successfully."
        });

    } catch (error) {
        console.error("Error deleting facility:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting facility.",
            error: error.message
        });
    }
};


//_________________________________Create Room Category_____________________

exports.createRoomCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }

        const trimmedName = name.trim();

        trimmedName =
            trimmedName.charAt(0).toUpperCase() +
            trimmedName.slice(1).toLowerCase();

        //  Validate name pattern (must start with a capital letter, min 3 chars)

        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(trimmedName)) {
            return res.status(400).json({
                success: false,
                message: "Name should contain only letters (A–Z, a–z).",
            });
        }
        // const nameRegex = /^[A-Za-z\s]{3,}$/;
        // if (!nameRegex.test(trimmedName)) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Name must start with a capital letter and be at least 3 characters long.",
        //     });
        // }

        const existing = await RoomCategory.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Room Category already exists.",
            });
        }


        const formattedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

        //  Create category
        const newCategory = await RoomCategory.create({
            name: formattedName,
            status: "active",
        });


        res.status(201).json({
            success: true,
            message: "Room Category added successfully",
            data: newCategory
        });
    } catch (error) {
        console.error("[RoomCategory] create error:", error);
        res.status(500).json({ success: false, message: "Server error while create adding room-category", error: error.message });
    }
};

exports.getAllRoomCategories = async (req, res) => {
    try {
        const categories = await RoomCategory.find()
            .sort({ createdAt: -1 })
            .lean();

        if (!categories || categories.length === 0) {
            return res.status(404).json({
                success: false,
                count: 0,
                message: "No room categories found.",
                data: [],
            });
        }

        const formattedCategories = categories.map(cat => ({
            ...cat,
            name:
                cat.name && typeof cat.name === "string"
                    ? cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
                    : cat.name,
        }));

        return res.status(200).json({
            success: true,
            count: formattedCategories.length,
            message: "Fetched all room categories successfully.",
            data: formattedCategories,
        });

    } catch (error) {
        console.error("[GET_ALL_ROOM_CATEGORIES_ERROR]", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching room categories.",
            error: error.message,
        });
    }
};

exports.updateRoomCategory = async (req, res) => {
    try {
        const { roomCatId, name } = req.body;

        //  roomCatId required
        if (!roomCatId) {
            return res.status(400).json({
                success: false,
                message: "Room Category ID is required",
            });
        }

        const roomCategory = await RoomCategory.findById(roomCatId);
        if (!roomCategory) {
            return res.status(404).json({
                success: false,
                message: "Room Category not found",
            });
        }

        //  If name provided → validate + capitalize
        if (name && name.trim()) {
            let trimmedName = name.trim();

            //  First letter capital, rest lowercase
            trimmedName =
                trimmedName.charAt(0).toUpperCase() +
                trimmedName.slice(1).toLowerCase();

            //  Validation
            const nameRegex = /^[A-Za-z\s]{3,}$/;
            if (!nameRegex.test(trimmedName)) {
                return res.status(400).json({
                    success: false,
                    message: "Name must contain only letters and be at least 3 characters long.",
                });
            }

            //  Duplicate check (exclude current)
            const existing = await RoomCategory.findOne({
                _id: { $ne: roomCatId },
                name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Room Category with this name already exists.",
                });
            }

            roomCategory.name = trimmedName;
        }

        const updated = await roomCategory.save();

        res.status(200).json({
            success: true,
            message: "Room Category updated successfully",
            data: updated
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating room category",
            error: error.message
        });
    }
};

exports.changeRoomCategoryStatus = async (req, res) => {
    try {
        const { roomCatId } = req.body;

        const roomCat = await RoomCategory.findById(roomCatId);
        if (!roomCat) {
            return res.status(404).json({
                success: false,
                message: "Room Category not found"
            });
        }

        if (roomCat.status === "active") {
            roomCat.status = "inactive"
        }
        else {
            roomCat.status = "active"
        }

        await roomCat.save();

        res.status(200).json({
            success: true,
            message: `Room Category status updated to ${roomCat.status}`
        });

    } catch (error) {
        console.error("[RoomCategory] change status error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating status",
            error: error.message
        });
    }
};

exports.deleteRoomCategory = async (req, res) => {
    try {
        const { roomCatId } = req.body;

        const deleted = await RoomCategory.findByIdAndDelete(roomCatId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Room Category not found" });
        }

        res.status(200).json({
            success: true,
            message: "Room Category deleted successfully"
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error deleting room category", error: error.message });
    }
};

//__________________________________ADD BED TYPE_______________________________________________

exports.addBedType = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Bed Type name is required and must be a non-empty string"
            });
        }

        const nameRegex = /^[A-Za-z\s]{3,50}$/;
        if (!nameRegex.test(name.trim())) {
            return res.status(400).json({
                success: false,
                message: "Bed Type name must contain only letters, min 3 characters long"
            });
        }

        // Format first letter capital
        const formattedName =
            name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();

        // Check for duplicate (case-insensitive)
        const existing = await BedType.findOne({
            name: { $regex: new RegExp(`^${formattedName}$`, "i") }
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Bed Type already exists"
            });
        }

        // Save formatted name
        const newBedType = await BedType.create({ name: formattedName });

        res.status(201).json({
            success: true,
            message: "Bed Type added successfully",
            data: newBedType
        });

    } catch (error) {
        console.error("Add Bed Type Error:", error);
        res.status(500).json({ success: false, message: "Server Error while adding bedType" });
    }
};

exports.getAllBedTypes = async (req, res) => {
    try {
        const bedTypes = await BedType.find().sort({ createdAt: -1 }).lean();

        const formatted = bedTypes.map(bt => ({
            ...bt,
            name: bt.name.charAt(0).toUpperCase() + bt.name.slice(1).toLowerCase()
        }));

        res.status(200).json({
            success: true,
            message: "Fetched all Bed Types successfully",
            data: formatted
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error while fetching all bedTypes" });
    }
};

exports.editBedType = async (req, res) => {
    try {
        const { bedTypeId, name } = req.body;

        // 🔹 bedTypeId required
        if (!bedTypeId || bedTypeId.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Bed Type ID is required",
            });
        }

        // 🔹 Name validation basic
        if (!name || name.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: "Bed Type name must be at least 3 characters long",
            });
        }

        // 🔹 Trim + Capitalize
        let formattedName =
            name.trim().charAt(0).toUpperCase() +
            name.trim().slice(1).toLowerCase();

        // 🔹 Letters-only check
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(formattedName)) {
            return res.status(400).json({
                success: false,
                message: "Bed Type name should contain only letters (A–Z, a–z).",
            });
        }

        // 🔹 Case-insensitive duplicate check (exclude current bedTypeId)
        const existing = await BedType.findOne({
            name: { $regex: new RegExp(`^${formattedName}$`, "i") },
            _id: { $ne: bedTypeId }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Bed Type name already exists",
            });
        }

        // 🔹 Update
        const updated = await BedType.findByIdAndUpdate(
            bedTypeId,
            { name: formattedName },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Bed Type updated successfully",
            data: updated
        });

    } catch (error) {
        console.error("[BedType] edit error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while editing Bed Type",
            error: error.message
        });
    }
};


exports.changeStatusBedType = async (req, res) => {
    try {
        const { bedTypeId } = req.body;

        const bedType = await BedType.findById(bedTypeId);
        if (!bedType) {
            return res.status(404).json({ success: false, message: "Bed Type not found" });
        }

        bedType.status = bedType.status === "active" ? "inactive" : "active";
        await bedType.save();

        res.status(200).json({
            success: true,
            message: `Bed Type status changed to ${bedType.status}`,
            data: bedType
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error while changing status of bedType" });
    }
};

exports.deleteBedType = async (req, res) => {
    try {
        const { bedTypeId } = req.body;

        const deleted = await BedType.findByIdAndDelete(bedTypeId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Bed Type not found" });
        }

        res.status(200).json({
            success: true,
            message: "Bed Type deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error while deleting bedType" });
    }
};

//__________________________ MANAGE PAYMENT______________________________

exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate({
                path: "booking",
                populate: [
                    { path: "customer", select: "name" },
                    { path: "guesthouse", select: "name" }
                ]
            })
            .sort({ createdAt: -1 }); // Latest first

        return res.status(200).json({
            success: true,
            message: "Payment list fetched successfully",
            data: payments.map(p => {

                // Capitalize paymentStatus
                const status = p.paymentStatus
                    ? p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1)
                    : "N/A";

                return {
                    _id: p._id,
                    guesthouse: p.booking?.guesthouse?.name || "N/A",
                    customer: p.booking?.customer?.name || "N/A",
                    amount: p.amount,
                    paymentMethod: p.paymentMethod,
                    paymentStatus: status,
                    paymentDate: p.paymentDate,
                    checkIn: p.booking?.checkIn,
                    checkOut: p.booking?.checkOut,
                    nights: p.booking?.nights,
                };
            })
        });
    } catch (error) {
        console.error("Error fetching payments:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payments",
            error: error.message
        });
    }
};

exports.deletePayment = async (req, res) => {
    try {
        const { paymentId } = req.body;

        //  Validate paymentId
        if (!paymentId || paymentId.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "paymentId is required",
            });
        }

        // Find and delete payment
        const payment = await Payment.findByIdAndDelete(paymentId);

        //  If payment not found
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }

        //  Success response
        return res.status(200).json({
            success: true,
            message: "Payment deleted successfully",
            deletedPayment: payment,
        });

    } catch (error) {
        console.error("Error deleting payment:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

exports.getPaymentDetails = async (req, res) => {
    try {
        const { paymentId } = req.body;

        if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({
                success: false,
                message: "Valid paymentId is required"
            });
        }

        const payment = await Payment.findById(paymentId)
            .populate({
                path: "booking",
                populate: [
                    { path: "customer", select: "name email phone address" },
                    { path: "guesthouse", select: "name address contactNumber description price cleaningFee taxPercent" }
                ]
            });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        // Construct separate sections
        const booking = payment.booking;
        const customer = booking.customer || {};
        const guesthouse = booking.guesthouse || {};

        return res.status(200).json({
            success: true,
            message: "Payment details fetched successfully",
            data: {
                payment: {
                    _id: payment._id,
                    amount: payment.amount,
                    paymentMethod: payment.paymentMethod,
                    paymentStatus: payment.paymentStatus
                        ? payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1)
                        : "",
                    paymentDate: payment.paymentDate
                },
                booking: {
                    _id: booking._id,
                    checkIn: booking.checkIn,
                    checkOut: booking.checkOut,
                    nights: booking.nights,
                    amount: booking.amount,
                    cleaningFee: booking.cleaningFee,
                    taxAmount: booking.taxAmount,
                    discount: booking.discount,
                    finalAmount: booking.finalAmount,
                    reason: booking.reason,
                    status: booking.status
                        ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                        : "",
                },
                customer: {
                    _id: customer._id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address
                },
                guesthouse: {
                    _id: guesthouse._id,
                    name: guesthouse.name,
                    address: guesthouse.address,
                    contactNumber: guesthouse.contactNumber,
                    description: guesthouse.description,
                    price: guesthouse.price,
                    cleaningFee: guesthouse.cleaningFee,
                    taxPercent: guesthouse.taxPercent
                }
            }
        });

    } catch (error) {
        console.error("Error while fetching payment details:", error);
        return res.status(500).json({
            success: false,
            message: "Error while fetching payment details",
            error: error.message
        });
    }
};

exports.getIssueTypes = async (req, res) => {
    try {
        const issueTypes = [
            "Booking Related Issue",
            "Payment / Refund Issue",
            "Room Issue",
            "Staff Behaviour",
            "Check-in / Check-out Issue",
            "Amenities / Service Issue",
            "Fake Listing / Misleading Information",
            "Cancellation Issue",
            "Safety / Security Issue",
            "Other"
        ];

        return res.status(200).json({
            success: true,
            message: "Issue types fetched successfully",
            count: issueTypes.length,
            data: issueTypes
        });

    } catch (error) {
        console.error("[Issue] getIssueTypes error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching issue types",
            error: error.message
        });
    }
};

// ______________________ MANAGE REPORT

exports.getReports = async (req, res) => {
    try {
        const reports = await Issue.find()
            .select("issueType ticketId status customer guesthouse createdAt")
            .populate("customer", "name")
            .populate("guesthouse", "name")
            .sort({ createdAt: -1 })

        if (!reports || reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No reports found"
            });
        }

        const formatted = reports.map((report) => ({
            _id: report._id,
            ticketId: report.ticketId,
            issueType: report.issueType,
            status: report.status,
            time: moment(report.createdAt)
                .tz("Asia/Kolkata")
                .format("DD-MM-YYYY hh:mm A"),
            customer: report.customer?.name || "N/A",
            guesthouse: report.guesthouse?.name || "N/A"
        }))

        return res.status(200).json({
            success: true,
            message: "Reports fetched successfully",
            count: formatted.length,
            data: formatted
        });

    } catch (error) {
        console.error("[Issue] getReports error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching reports",
            error: error.message
        });
    }
};

exports.changeStatusReport = async (req, res) => {
    try {
        const { reportId, status } = req.body;

        // Validate required fields
        if (!reportId || !status) {
            return res.status(400).json({
                success: false,
                message: "reportId and status are required",
            });
        }

        // Validate status values
        const validStatuses = ["Pending", "In Progress", "Resolved", "Rejected"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
            });
        }

        // Find existing report first
        const report = await Issue.findById(reportId);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        // Check if report is already Resolved or Rejected
        if (["Resolved", "Rejected"].includes(report.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change status because this report is already ${report.status}.`,
            });
        }

        // Update the report status
        report.status = status;
        await report.save();

        return res.status(200).json({
            success: true,
            message: "Report status updated successfully",
            data: report,
        });

    } catch (error) {
        console.error("[Issue] changeStatusReport error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while changing the status of report",
            error: error.message,
        });
    }
};

exports.viewReport = async (req, res) => {
    try {
        const { reportId } = req.body;

        if (!reportId) {
            return res.status(400).json({
                success: false,
                message: "reportId is required",
            });
        }

        const report = await Issue.findById(reportId)
            .populate("customer", "name email phone")
            .populate("guesthouse", "name address contactNumber");

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        const formatted = {
            _id: report._id,
            ticketId: report.ticketId,
            issueType: report.issueType,
            description: report.description,
            status: report.status,
            createdAt: moment(report.createdAt)
                .tz("Asia/Kolkata")
                .format("DD-MM-YYYY hh:mm A"),
            customer: report.customer
                ? { name: report.customer.name, email: report.customer.email, contactNumber: report.customer.phone }
                : { name: "N/A", email: "N/A", phone: "N/A" },
            guesthouse: report.guesthouse
                ? { name: report.guesthouse.name, address: report.guesthouse.address, contactNumber: report.guesthouse.contactNumber }
                : { name: "N/A", address: "N/A", contactNumber: "N/A" },
            issueImage: report.issueImage
                ? `${BASE_URL}/uploads/issueImage/${report.issueImage}`
                : null
        };

        return res.status(200).json({
            success: true,
            message: "Report fetched successfully",
            data: formatted,
        });

    } catch (error) {
        console.error("[Issue] viewReport error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching report",
            error: error.message,
        });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const { reportId } = req.body;

        //  Validate input
        if (!reportId || reportId.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "reportId is required",
            });
        }

        // Find and delete the report
        const report = await Issue.findByIdAndDelete(reportId);

        //  Check if report exists
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        //  Success response
        return res.status(200).json({
            success: true,
            message: "Report deleted successfully",
            deletedReport: report,
        });

    } catch (error) {
        console.error("Error deleting report:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

// Manage Payouts

exports.getPayouts = async (req, res) => {
    try {
        const payouts = await PayoutRequest.find()
            .populate("guesthouse", "name contactNumber")
            .sort({ createdAt: -1 })
            .lean();

        // If no payouts exist
        if (!payouts || payouts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No payout requests found",
                total: 0,
                data: []
            });
        }

        const formatted = payouts.map(p => ({
            id: p._id,
            payoutId: p.payoutId,  // fallback
            guesthouseName: p.guesthouse?.name || "N/A",
            guesthousePhone: p.guesthouse?.contactNumber || "N/A",
            paymentCurrency: "MVR",
            amount: p.amount,
            status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
            requestedDate: moment(p.createdAt).tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm A"),
            actionDate: moment(p.updatedAt).tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm A"),
        }))

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all payout requests",
            total: payouts.length,
            data: formatted
        });

    } catch (error) {
        console.error("Error fetching payouts:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payouts",
            error: error.message
        });
    }
};

exports.changeStatusPayout = async (req, res) => {
    try {
        const { payoutId, status } = req.body;

        if (!payoutId || !status) {
            return res.status(400).json({
                success: false,
                message: "payoutId and status required"
            });
        }

        const payout = await PayoutRequest.findById(payoutId);

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout not found"
            });
        }

        // Restriction logic
        if (payout.status === "Approved" && status === "Rejected") {
            return res.status(400).json({
                success: false,
                message: "Already Approved — Cannot change to Rejected"
            });
        }

        if (payout.status === "Rejected" && status === "Approved") {
            return res.status(400).json({
                success: false,
                message: "Already Rejected — Cannot change to Approved"
            });
        }

        // Same status blocking
        if (payout.status === status) {
            return res.status(400).json({
                success: false,
                message: `Already ${status}`
            });
        }

        payout.status = status;
        payout.updatedAt = new Date();
        await payout.save();

        return res.status(200).json({
            success: true,
            message: `Payout ${status} successfully`,
            data: payout
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating status of payout."
        });
    }
}
