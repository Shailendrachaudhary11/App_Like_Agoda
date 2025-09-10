const dotenv = require("dotenv");
dotenv.config(); 
const AdminUser = require("../models/adminUser");
const User = require("../models/user");
const Guesthouse = require("../models/Guesthouse");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room")
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const Promo = require("../models/Promo");


// ---------------- Admin Registration ----------------
exports.register = async (req, res) => {
    try {
        const data = req.body;

        console.log("Register request data:", data);

        const existingUser = await AdminUser.findOne({ email: data.email });
        if (existingUser) {
            console.log("Admin already exists:", data.email);
            return res.status(409).json({
                success: false,
                message: "Admin already registered with this email."
            });
        }

        data.password = await bcrypt.hash(data.password, 10);

        const newUser = new AdminUser(data);
        if (req.file) {
            newUser.profileImage = req.file.path;
            console.log("Profile image path set:", req.file.path);
        }
        await newUser.save();

        console.log("Admin registered successfully:", newUser._id);

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully.",
            data: newUser
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

// ---------------- Admin Login ----------------
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Admin login attempt:", email);

        const adminUser = await AdminUser.findOne({ email });
        if (!adminUser) {
            console.log("Admin not found:", email);
            return res.status(401).json({
                success: false,
                message: "Invalid email."
            });
        }

        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) {
            console.log("Invalid password attempt for:", email);
            return res.status(401).json({
                success: false,
                message: "Invalid password."
            });
        }

        const token = jwt.sign(
            { id: adminUser._id, role: "admin", name: adminUser.name },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        console.log("Admin logged in successfully:", adminUser._id);

        return res.status(200).json({
            success: true,
            message: "Login successfully.",
            token
        });
    } catch (error) {
        console.error("Error in admin login:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
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

        //  Check if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        const user = req.user; // Assuming req.user is set by auth middleware

        //  Check old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Old password is incorrect" });
        }

        //  Hash new password and save
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully" });

    } catch (err) {
        console.error("Error changing password:", err.message);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ---------------- forgot password using email ----------
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const admin = await AdminUser.findOne({ email });

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        admin.otp = otp;
        admin.otpExpiry = otpExpiry;
        await admin.save();

        // Send OTP
        const emailSent = await sendEmail(
            admin.email,
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
        const admin = await AdminUser.findById(id);

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        // Validate OTP
        if (admin.otp !== otp || Date.now() > admin.otpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        admin.otp = undefined;
        admin.otpExpiry = undefined;

        await admin.save();
        res.status(200).json({ success: true, message: "OTP verified successfully" });

    } catch (err) {
        console.error("OTP Verification Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ------------------ reset Password -----------------------
exports.setNewPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        const id = req.user.id;
        const admin = await AdminUser.findById(id);

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "Password fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;

        // Clear OTP
        admin.otp = undefined;
        admin.otpExpiry = undefined;

        await admin.save();

        res.json({ success: true, message: "Password reset successful" });

    } catch (err) {
        console.error("Set New Password Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ---------------- Get Profile ----------------
exports.getProfile = async (req, res) => {
    try {
        const id = req.user.id;
        console.log("Fetching profile for admin ID:", id);

        const user = await AdminUser.findById(id).select("-password").select("-otp").select("-otpExpiry")
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error("Error fetching admin profile:", err.message);
        return res.status(500).json({
            success: false,
            message: "Error retrieving admin profile.",
            error: err.message
        });
    }
};

// ---------------- Update Profile ----------------
exports.updateProfile = async (req, res) => {
    try {
        console.log("Updating profile for admin ID:", req.user._id);

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

// ---------------- Approve Guesthouse ----------------
exports.approveGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Approving guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "approved";
        await guesthouse.save();

        console.log("Guesthouse approved:", id);

        return res.status(200).json({
            success: true,
            message: "Guesthouse approved successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error approving guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to approve guesthouse.",
            error: err.message
        });
    }
};

// ---------------- Reject Guesthouse ----------------
exports.rejectGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Rejecting guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        await guesthouse.deleteOne();

        console.log("Guesthouse rejected:", id);

        return res.status(200).json({
            success: true,
            message: "Guesthouse rejected successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error rejecting guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to reject guesthouse.",
            error: err.message
        });
    }
};

// ----------------- Suspended GuestHouse ------------
exports.suspendedGuestHouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Suspended guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "suspended";

        await guesthouse.save();

        return res.status(200).json({
            success: true,
            message: "Guesthouse suspended successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error suspended guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to suspended guesthouse.",
            error: err.message
        });
    }
}

// ----------------- Activate GuestHouse --------------
exports.activateGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Activated guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "approved";

        await guesthouse.save();

        return res.status(200).json({
            success: true,
            message: "Guesthouse Activated successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error Activated guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to Activated guesthouse.",
            error: err.message
        });
    }
}

// ---------------- GET rooms by id ----------------
exports.getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        // Use findById if roomid is MongoDB _id
        const room = await Room.findById(id); // optional populate

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetched room",
            room: room
        });
    } catch (err) {
        console.log("Error while fetching room:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching room"
        });
    }
};

// ---------------- PUT update rooms by id ----------------
exports.editRoom = async (req, res) => {
    try {
        const { id } = req.params;

        // Find room by ID
        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const {
            roomNumber,
            title,
            description,
            amenities,
            priceWeekly,
            pricePerNight,
            priceMonthly,
            capacity
        } = req.body;

        // Update fields if provided
        if (roomNumber !== undefined) room.roomNumber = roomNumber;
        if (title !== undefined) room.title = title;
        if (description !== undefined) room.description = description;
        if (amenities !== undefined) room.amenities = amenities;
        if (pricePerNight !== undefined) room.pricePerNight = pricePerNight;
        if (priceWeekly !== undefined) room.priceWeekly = priceWeekly;
        if (priceMonthly !== undefined) room.priceMonthly = priceMonthly; // ✅ fix
        if (capacity !== undefined) room.capacity = capacity;

        // Handle new images (replace old completely)
        if (req.files && req.files.length > 0) {
            const imagePaths = req.files.map(file => file.path);
            room.photos = imagePaths;
        }

        await room.save();

        res.status(200).json({
            success: true,
            message: "Room updated successfully", // ✅ better message
            room
        });
    } catch (err) {
        console.error("Error while updating room:", err);
        res.status(500).json({
            success: false,
            message: "Error updating room"
        });
    }
};

// ------------- DELETE ROOMS --------------
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        // Use findById if roomid is MongoDB _id
        const room = await Room.findById(id); 

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

// --------------- get room by guest house Id
exports.getRoomGuestHouseBy = async (req, res) => {
    try {
        const { guesthouseId } = req.params;

        // ✅ Check if guesthouse exists
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        // ✅ Fetch rooms with ObjectId
        const rooms = await Room.find({ guesthouse: guesthouseId });

        return res.status(200).json({
            success: true,
            message: "Rooms fetched successfully.",
            totalRooms: rooms.length,
            rooms
        });

    } catch (error) {
        console.error("Error in getRoomGuestHouseBy:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching rooms."
        });
    }
};


// ---------------- Approve User ----------------
exports.approvalRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("Approving user email:", email);

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.."
            });
        }

        user.status = "approved";
        await user.save();

        console.log("User approved:", email);

        return res.status(200).json({
            success: true,
            message: "User approved successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        console.error("Error approving user:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to approve user.",
            error: err.message
        });
    }
};

// ---------------- Reject User ----------------
exports.rejectRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("Rejecting user email:", email);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        await user.deleteOne();

        console.log("User rejected:", email);

        return res.status(200).json({
            success: true,
            message: "User rejected successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        console.error("Error rejecting user:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to reject user.",
            error: err.message
        });
    }
};


// ---------------- Approve User ----------------
exports.suspendedRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("suspended user email:", email);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.status = "suspended";
        await user.save();

        console.log("User suspended:", email);

        return res.status(200).json({
            success: true,
            message: "User suspended successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        console.error("Error suspended user:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to suspended user.",
            error: err.message
        });
    }
};

// ---------------- Approve User ----------------
exports.activateRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("activating user email:", email);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.status = "approved";
        await user.save();

        console.log("User activating:", email);

        return res.status(200).json({
            success: true,
            message: "User activating successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        console.error("Error activating user:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to activating user.",
            error: err.message
        });
    }
};


// ---------------- Get All Guesthouses ----------------
exports.getAllGuestHouses = async (req, res) => {
    try {
        console.log("Fetching all guesthouses");

        const guesthouses = await Guesthouse.find()
            .populate("owner", "name email phone role profileImage isVerified createdAt");

        return res.status(200).json({
            success: true,
            NoOfGuestHouses: guesthouses.length,
            data: guesthouses
        });
    } catch (err) {
        console.error("Error fetching guesthouses:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouses.",
            error: err.message
        });
    }
};


// ---------------- Get Guesthouse By ID ----------------
exports.getGuestHousesById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Fetching guesthouse by ID:", id);

        const guesthouse = await Guesthouse.findById(id)
            .populate("owner", "name email phone role profileImage isVerified createdAt");

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: guesthouse
        });
    } catch (err) {
        console.error("Error fetching guesthouse by ID:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouse.",
            error: err.message
        });
    }
};

// ---------------- Get All customer ----------------
exports.getAllUsers = async (req, res) => {
    try {
        console.log("Fetching all customers");

        const customers = await User.find({ role: "customer" }).select("-password");
        return res.status(200).json({
            success: true,
            count: customers.length,
            data: customers
        });
    } catch (err) {
        console.error("Error fetching customers:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch customers.",
            error: err.message
        });
    }
};

// ---------------- Get customer By ID ----------------
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Fetching customer by ID:", id);

        const customer = await User.findOne({ _id: id, role: "customer" }).select("-password");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "customer not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: customer
        });
    } catch (err) {
        console.error("Error fetching customer by ID:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch customer.",
            error: err.message
        });
    }
};


// ---------------- Get All Guesthouse Owners ----------------
exports.getAllGuesthouseOwners = async (req, res) => {
    try {
        console.log("Fetching all guesthouse owners");

        const owners = await User.find({ role: "guesthouse_admin" }).select("-password");
        return res.status(200).json({
            success: true,
            count: owners.length,
            data: owners
        });
    } catch (err) {
        console.error("Error fetching guesthouse owners:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouse owners.",
            error: err.message
        });
    }
};

// ---------------- Get Guesthouse Owner By ID ----------------
exports.getGuesthouseOwnerById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Fetching guesthouse owner by ID:", id);

        const owner = await User.findOne({ _id: id, role: "guesthouse_admin" }).select("-password");

        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse owner not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: owner
        });
    } catch (err) {
        console.error("Error fetching guesthouse owner by ID:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouse owner.",
            error: err.message
        });
    }
};


// ---------------- Get all promos ---------------
exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find({ isActive: true });

        res.status(200).json({
            success: true,
            message: "All promos: ",
            NoOfPromos: promos.length,
            promos: promos
        })
    } catch (error) {
        console.error(error, "Error fetching all promos"),
            res.status(500).json({
                success: false,
                message: "Error all promos: ",
            })
    }
}


// --------------- GET promo by ID ------------
exports.getPromoById = async (req, res) => {
    try {
        const { id } = req.params;
        const promo = await Promo.findOne({ _id: id, isActive: true })
            .populate("guesthouse", "name location");

        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });

        res.status(200).json({ success: true, promo });
    } catch (err) {
        console.error("Get Promo Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// ---------------- UPDATE promo ------------
exports.updatePromo = async (req, res) => {
    try {
        const { id } = req.params;

        let promo = await Promo.findById(id);
        if (!promo) {
            return res.status(404).json({ success: false, message: "Promo not found" });
        }

        // Destructure body
        let { code, discountType, discountValue, startDate, endDate, maxUsage, isActive } = req.body;

        // If code given → uppercase + check duplicate
        if (code) {
            code = code.toUpperCase();

            const promoByCode = await Promo.findOne({ code: code, _id: { $ne: id } });
            if (promoByCode) {
                return res.status(400).json({ success: false, message: "Use a different promo code." });
            }

            promo.code = code;
        }

        // Update other fields if provided
        if (discountType) promo.discountType = discountType;
        if (discountValue) promo.discountValue = discountValue;
        if (startDate) promo.startDate = startDate;
        if (endDate) promo.endDate = endDate;
        if (maxUsage !== undefined) promo.maxUsage = maxUsage;
        if (typeof isActive === "boolean") promo.isActive = isActive;

        await promo.save();

        return res.status(200).json({
            success: true,
            message: "Promo updated successfully",
            promo
        });

    } catch (err) {
        console.error("Update Promo Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


// ----------------- DELETE promo ------------
exports.deletePromo = async (req, res) => {
    try {
        const { id } = req.params;

        const promo = await Promo.findByIdAndDelete(id);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });

        res.status(200).json({ success: true, message: "Promo deleted" });
    } catch (err) {
        console.error("Delete Promo Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};