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
const BedType = require("../models/BedType");
const Review = require("../models/review");
const Payment = require("../models/Payment");
const Atoll = require("../models/Atoll");


const BASE_URL = process.env.BASE_URL;

// ________________________________________________________

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
            { id: adminUser._id, role: "admin", name: adminUser.name },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        console.log("Admin logged in successfully:", adminUser._id);

        adminUser.adminImage = adminUser.adminImage
            ? `${process.env.BASE_URL || ""}/uploads/adminImage/${adminUser.adminImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Login successfully.",
            token: token,
            data: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                adminImage: adminUser.adminImage
            }
        });
    } catch (error) {
        console.error("Error in admin login:", error.message);
        return res.status(500).json({
            success: false,
            message: "error while admin login.",
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

        // Validate request body
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Request body is required",
                data: null,
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


// ________________________________________________________

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
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        // Fetch guesthouses
        const guestHouses = await Guesthouse.find()
            .select("-location -owner -description -facilities -__v -createdAt")
            .lean(); // lean() for better performance

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

exports.updateGuestHouse = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            address,
            location,
            contactNumber,
            description,
            price,
            facilities,
            stars,
            Atoll,
            islands
        } = req.body;

        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found",
            });
        }

        console.log(`[GUESTHOUSE] Updating guesthouse ${id} by user ${req.user?.id || "unknown"}`);

        //  Handle images (optional)
        if (req.files && req.files.length > 0) {
            guesthouse.guestHouseImage = req.files.map(file => file.filename);
        }

        //  Dynamic fields update
        const fields = {
            name,
            address,
            contactNumber,
            description,
            price,
            stars,
            Atoll,
            islands
        };

        for (const key in fields) {
            if (fields[key] !== undefined && fields[key] !== null) {
                guesthouse[key] = fields[key];
            }
        }

        //  Facilities update (must be array)
        if (facilities) {
            guesthouse.facilities = Array.isArray(facilities)
                ? facilities
                : facilities.split(",").map(f => f.trim()).filter(Boolean);
        }

        //  Location update (lng, lat)
        if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
            guesthouse.location = {
                type: "Point",
                coordinates: location.coordinates
            };
        }

        await guesthouse.save();

        //  Notification
        await createNotification(
            { userId: req.user.id, role: req.user.role },   // sender
            { userId: guesthouse.owner, role: "guesthouse" }, // receiver
            "Guesthouse Updated",
            `Your guesthouse "${guesthouse.name}" has been updated successfully by admin.`,
            "system",
            { guesthouseId: guesthouse._id }
        );

        return res.status(200).json({
            success: true,
            message: "Guesthouse updated successfully.",
            data: guesthouse
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating guesthouse",
            error: err.message,
        });
    }
};

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

        guestHouseObj.stars = guestHouseObj.stars != null ? parseFloat(guestHouseObj.stars).toFixed(1) : "0.0";
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
        guestHouseObj.reviewScore = reviewScore;
        guestHouseObj.reviewsText = reviewsText;

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
            .select("roomCategory bedType capacity photos amenities pricePerNight priceWeekly priceMonthly description active")

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        //  Convert to plain object
        const roomObj = room.toObject();

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
            .select("-__v -updatedAt")
            .lean();

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
                select: "roomCategory price"
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

        // Room count and type
        let roomCount = booking.room?.length || 0; // default 1 because schema is single room
        let roomType = [];
        if (booking.room && Array.isArray(booking.room) && booking.room.length > 0) {
            roomType = booking.room.map(r => r.roomCategory || "");
        }

        const paymentDetails = payment
            ? {
                customerName: customer.name || "",
                customerProfileImage: `${BASE_URL}/uploads/profileImage/${customer.profileImage}`,
                customerContact: customer.phone || "",
                paymentMethod: payment.paymentMethod,
                paymentStatus: payment.paymentStatus,
                paymentDate: payment.paymentDate
                    ? new Date(payment.paymentDate).toISOString().split("T")[0]
                    : null,
            }
            : {
                customerName: customer.name,
                customerProfileImage: `${BASE_URL}/uploads/profileImage/${customer.profileImage}`,
                customerContact: customer.phone || "",
                paymentMethod: "N/A",
                paymentStatus: "unpaid",
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

//___________________________________________________PROMO ____________________________________


exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: promos.length,
            message: "Successfully fetching all promo codes",
            data: promos
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

        // Required fields check
        if (!code || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: code, discountType, discountValue, startDate, endDate"
            });
        }

        // Extra validations
        if (!["flat", "percentage"].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'"
            });
        }

        if (discountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: "discountValue must be greater than 0"
            });
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: "endDate must be greater than startDate"
            });
        }

        // Create promo object
        const promo = new Promo({
            code,
            discountType,
            discountValue,
            startDate,
            endDate
        });

        await promo.save();

        res.status(201).json({
            success: true,
            message: "Promo created successfully",
            data: promo
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error creating promo",
            error: err.message
        });
    }
};

exports.getPromoById = async (req, res) => {
    try {
        const promo = await Promo.findById(req.body.id);
        if (!promo) return res.status(404).json({
            success: false,
            message: "Promo not found"
        });
        res.status(200).json({
            success: true,
            message: `Successfully fetch promo code.`,
            data: promo
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching promo", error: err.message });
    }
};

exports.updatePromo = async (req, res) => {
    try {
        const promoId = req.body.id;
        let promo = await Promo.findById(promoId);

        if (!promo) {
            return res.status(404).json({ success: false, message: "Promo not found" });
        }

        const { code, discountType, discountValue, startDate, endDate } = req.body;

        // 🔹 discountType validation
        if (discountType && !["flat", "percentage"].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'"
            });
        }

        // 🔹 discountValue validation
        if (discountValue && discountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: "discountValue must be greater than 0"
            });
        }

        // 🔹 date validation
        if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: "endDate must be greater than startDate"
            });
        }

        // 🔹 Allowed fields only
        const allowedUpdates = { code, discountType, discountValue, startDate, endDate };
        Object.keys(allowedUpdates).forEach((key) => {
            if (allowedUpdates[key] !== undefined) {
                promo[key] = allowedUpdates[key];
            }
        });

        await promo.save();

        res.status(200).json({
            success: true,
            message: "Promo updated successfully",
            data: promo
        });

    } catch (err) {
        res.status(500).json({
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

        if (promo.status === "active") {
            promo.status = "inactive"
        }
        else {
            promo.status = "active"
        }
        await promo.save();

        return res.status(200).json({
            success: true,
            message: `Promo has been ${promo.status} successfully.`,
            data: {
                promoId: promo._id,
                isActive: promo.status
            }
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
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name field is required"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Atoll image is required"
            });
        }

        const existing = await Atoll.findOne({ name });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Atoll with this name already exists"
            });
        }

        const atoll = new Atoll({
            name: name.trim(),
            atollImage: `${req.file.filename}` // store relative path
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

        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "Atoll-ID is required",
            });
        }

        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "Atoll not found",
            });
        }

        if (name) {
            atoll.name = name;
        }

        if (req.file) {
            atoll.atollImage = req.file.filename;
        }

        const updatedAtoll = await atoll.save({ validateBeforeSave: false });


        return res.status(200).json({
            success: true,
            message: "Atoll updated successfully",
            data: updatedAtoll,
        });

    } catch (error) {
        console.error("Error while editing atoll:", error);
        res.status(500).json({
            success: false,
            message: "Error while editing atoll",
            error: error.message,
        });
    }
};


exports.getAllIslands = async (req, res) => {
    try {
        const { id } = req.body || {};

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "atollId is required"
            });
        }
        const atoll = await Atoll.find({ _id: id, status: "active" });
        if (!atoll.length) {
            return res.status(404).json({
                success: false,
                message: "No active atoll found"
            });
        }

        const islands = await Island.find({ atoll: id }).select("-__v -createdAt -updatedAt"); // extra fields hata sakte ho

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

        // Validate input
        if (!name || !atollId) {
            return res.status(400).json({
                success: false,
                message: "name and atollId are required."
            });
        }

        const atoll = await Atoll.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "No atoll found"
            })
        }

        // Check for existing island
        const existingIsland = await Island.findOne({ name });
        if (existingIsland) {
            return res.status(400).json({
                success: false,
                message: "Island already exists."
            });
        }

        // Create new island
        const newIsland = new Island({
            name,
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
        if (name) {
            island.name = name;
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


exports.createFacility = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Facility name is required"
            });
        }

        // Optionally normalize name (e.g. trim, lowercase first letter, etc.)
        const normalized = name.trim();

        // Check duplicate
        const existing = await Facility.findOne({ name: normalized });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Facility already exists"
            });
        }

        const facility = new Facility({
            name: normalized

        });

        await facility.save();

        return res.status(201).json({
            success: true,
            message: "Successfully add facility"
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



