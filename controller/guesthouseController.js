const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const User = require("../models/user");
const fs = require("fs");
const path = require("path");
const mongoose = require('mongoose');
const Promo = require("../models/Promo")


// ----------------- get own profile ---------------
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

// ---------------- update profile -----------------
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


// -------------- change password ---------------
exports.changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        if (!email || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: "false",
                message: "Please provide Email, OldPassword, NewPassword"
            })
        }
        const user = await User.findOne({ email });
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

// ------------ OTP send for change Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "user not found" });
        }

        // Generate OTP (6 digit random)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP on email
        await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}. It will expire in 10 minutes.`);

        res.json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ------------------ reset Password -----------------------
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Validate OTP
        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//  Add a new guesthouse (Owner only)
exports.addGuesthouse = async (req, res) => {
    try {
        const { name, address, city, state, location, contactNumber, description } = req.body;

        console.log(`[GUESTHOUSE] Adding new guesthouse: ${name} by user ${req.user._id}`);

        // Check for duplicate guesthouse name
        const existing = await Guesthouse.findOne({ name });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse name must be unique",
            });
        }

        // Validate images
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least 1 image is required",
            });
        }

        const images = req.files.map((file) => file.path);

        const guesthouse = new Guesthouse({
            owner: req.user._id,
            name,
            address,
            city,
            state,
            location,
            contactNumber,
            description,
            images,
        });

        await guesthouse.save();

        return res.status(201).json({
            success: true,
            message: "Guesthouse added successfully. Waiting for admin approval...",
            guesthouse,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Error while adding guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while adding guesthouse",
            error: err.message,
        });
    }
};

//  Get all approved guesthouses of the logged-in owner
exports.getMyGuesthouses = async (req, res) => {
    try {
        const guesthouses = await Guesthouse.find({
            owner: req.user._id,
            status: "approved",
        });

        if (!guesthouses.length) {
            return res.status(200).json({
                success: true,
                message: "No approved guesthouses found",
                data: [],
            });
        }

        return res.status(200).json({
            success: true,
            message: "Guesthouses fetched successfully",
            count: guesthouses.length,
            data: guesthouses,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Error fetching guesthouses:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching guesthouses",
            error: err.message,
        });
    }
};

// Get a specific guesthouse by ID (Owner only)
exports.getGuestHouseById = async (req, res) => {
    try {
        const { guestId } = req.params;

        if (!guestId) {
            return res.status(400).json({
                success: false,
                message: "GuestId is required",
            });
        }

        const guesthouse = await Guesthouse.findOne({
            owner: req.user._id,
            _id: guestId,
        }).populate("owner", "name email");

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Guesthouse fetched successfully",
            data: guesthouse,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Error fetching guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching guesthouse",
            error: err.message,
        });
    }
};

//  Update a guesthouse (Owner only)
exports.updateGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found" });
        }

        // Only owner can update
        if (guesthouse.owner.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Handle new images
        if (req.files && req.files.length > 0) {
            // Delete old images
            guesthouse.images.forEach(imgPath => {
                try {
                    const fullPath = path.join(__dirname, "..", imgPath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (err) {
                    console.error("Error deleting old image:", err.message);
                }
            });
            guesthouse.images = req.files.map(file => file.path);
        }

        // Update other fields
        Object.assign(guesthouse, updates);

        await guesthouse.save();

        return res.status(200).json({
            success: true,
            message: "Guesthouse updated successfully",
            guesthouse,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Update error:", err);
        return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    }
};

// Delete a guesthouse (Owner only)
exports.deleteGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found" });
        }

        // Only owner can delete
        if (guesthouse.owner.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await Room.deleteMany({ guesthouse: new mongoose.Types.ObjectId(id) });
        await guesthouse.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Guesthouse deleted successfully and all rooms of this guesthouse deleted.",
            guesthouse,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Delete error:", err);
        return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    }
};

////////////////////////////====================ROOMS ===========================////////////////////////

//  Add room to a guesthouse (Owner only)
exports.addRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { guesthouseId, roomNumber, title, description, amenities, pricePerNight, priceWeekly, priceMonthly, capacity, availability } = req.body;

        const guesthouse = await Guesthouse.findOne({ _id: guesthouseId, owner: ownerId, status: "approved" });
        if (!guesthouse) {
            return res.status(403).json({ success: false, message: "Guesthouse not found or unauthorized or you are allowed to add rooms." });
        }

        const existingRoom = await Room.findOne({ guesthouse: guesthouseId, roomNumber });
        if (existingRoom) {
            return res.status(400).json({ success: false, message: `Room number ${roomNumber} already exists in this guestHouse.` });
        }

        const newRoom = new Room({
            guesthouse: guesthouseId,
            roomNumber,
            title,
            description,
            amenities,
            pricePerNight,
            priceWeekly,
            priceMonthly,
            capacity,
            availability,
            photos: req.files ? req.files.map(f => f.path) : [],
        });

        await newRoom.save();

        return res.status(201).json({
            success: true,
            message: "Room added successfully",
            data: newRoom,
        });
    } catch (err) {
        console.error("[ROOM] Add error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Get all rooms of a guesthouse (Owner only)
exports.getAllRooms = async (req, res) => {
    try {
        const { guestHouseId } = req.params;

        const guesthouse = await Guesthouse.findOne({ _id: guestHouseId, owner: req.user.id });
        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found or unauthorized" });
        }

        const rooms = await Room.find({ guesthouse: guestHouseId });

        return res.status(200).json({
            success: true,
            GuestHouseName: guesthouse.name,
            message: "Rooms fetched successfully",
            data: rooms,
        });
    } catch (err) {
        console.error("[ROOM] Fetch error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

//  Delete a room (Owner only)
exports.deleteRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { guesthouseId, roomId } = req.params;

        const guesthouse = await Guesthouse.findOne({ _id: guesthouseId, owner: ownerId });
        if (!guesthouse) return res.status(403).json({ success: false, message: "Unauthorized" });

        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouseId });
        if (!room) return res.status(404).json({ success: false, message: "Room not found in this guesthouse" });

        await Room.findByIdAndDelete(roomId);

        return res.status(200).json({
            success: true,
            message: `Room ${room.roomNumber} deleted successfully from guesthouse ${guesthouse.name}`,
            data: room,
        });
    } catch (err) {
        console.error("[ROOM] Delete error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

//  Update a room (Owner only)
exports.updateRoom = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { guesthouseId, roomId } = req.params;

        const guesthouse = await Guesthouse.findOne({ _id: guesthouseId, owner: ownerId });
        if (!guesthouse) return res.status(403).json({ success: false, message: "Unauthorized" });

        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouseId });
        if (!room) return res.status(404).json({ success: false, message: "Room not found in this guesthouse" });

        // Update photos if provided
        if (req.files && req.files.length > 0) {
            room.photos.forEach(imgPath => {
                try {
                    const fullPath = path.join(__dirname, "..", imgPath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (err) {
                    console.error("Error deleting old image:", err.message);
                }
            });
            room.photos = req.files.map(file => file.path);
        }

        // Update other fields
        Object.assign(room, req.body);

        await room.save();

        return res.status(200).json({
            success: true,
            message: "Room updated successfully",
            data: room,
        });
    } catch (err) {
        console.error("[ROOM] Update error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};


////////////////////////////==================== ADD PROMOS CODES By guest house owner ===========================////////////////////////

// Post add promo codes
exports.addPromo = async (req, res) => {
    try {
        const { guesthouseId, code, discountType, discountValue, startDate, endDate, maxUsage } = req.body;
        const ownerId = req.user.id; // from auth middleware

        if (!guesthouseId || !code || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(404).json({
                success: false,
                message: "Plz provide all fields like as... guesthouseId, code, discountType, discountValue, startDate, endDate, maxUsage (Optional)"
            })
        }
        // Validate guesthouse ownership
        const guesthouse = await Guesthouse.findOne({
            _id: guesthouseId, status: "approved"
        });
        if (!guesthouse) return res.status(404).json({ success: false, message: "Guesthouse not found or not approve." });
        if (guesthouse.owner.toString() !== ownerId) {
            return res.status(403).json({ success: false, message: "You are not the owner of this guesthouse" });
        }

        // Check if promo code already exists
        const existing = await Promo.findOne({ code: code.toUpperCase(), guesthouse: guesthouseId });
        if (existing) return res.status(409).json({ success: false, message: "Promo code already exists" });

        // Create promo
        const promo = new Promo({
            guesthouse: guesthouseId,
            owner: ownerId,
            code: code.toUpperCase(),
            discountType,
            discountValue,
            startDate,
            endDate,
            maxUsage: maxUsage || null,
            isActive: true
        });

        await promo.save();
        res.status(201).json({ success: true, message: "Promo code added successfully", promo });

    } catch (err) {
        console.error("Add Promo Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Get all promos for owner's guesthouses
exports.getOwnerPromos = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const promos = await Promo.find({ owner: ownerId }).populate("guesthouse", "name location");
        res.status(200).json({ success: true, count: promos.length, promos });
    } catch (err) {
        console.error("Get Promos Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Update Promo
exports.updatePromo = async (req, res) => {
    try {
        const { promoId } = req.params;
        const ownerId = req.user.id;
        const updates = req.body;

        const promo = await Promo.findById(promoId);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });

        if (promo.owner.toString() !== ownerId) {
            return res.status(403).json({ success: false, message: "You are not authorized to update this promo" });
        }

        // Only allow updating these fields
        const allowedUpdates = ["code", "discountType", "discountValue", "startDate", "endDate", "maxUsage", "isActive"];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) promo[field] = updates[field];
        });

        // Uppercase code
        if (updates.code) promo.code = updates.code.toUpperCase();

        await promo.save();
        res.status(200).json({ success: true, message: "Promo updated", promo });

    } catch (err) {
        console.error("Update Promo Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Delete Promo
exports.deletePromo = async (req, res) => {
    try {
        const { promoId } = req.params;
        const ownerId = req.user.id;

        const promo = await Promo.findById(promoId);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });

        if (promo.owner.toString() !== ownerId) {
            return res.status(403).json({ success: false, message: "You are not authorized to delete this promo" });
        }

        await promo.deleteOne();
        res.status(200).json({ success: true, message: "Promo deleted successfully" });

    } catch (err) {
        console.error("Delete Promo Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};
