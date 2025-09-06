const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const User = require("../models/user");
const fs = require("fs");
const path = require("path");


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

        await guesthouse.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Guesthouse deleted successfully",
            guesthouse,
        });
    } catch (err) {
        console.error("[GUESTHOUSE] Delete error:", err);
        return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    }
};


//  Add room to a guesthouse (Owner only)
exports.addRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { guesthouseId, roomNumber, title, description, amenities, pricePerNight, priceWeekly, priceMonthly, capacity, availability } = req.body;

        const guesthouse = await Guesthouse.findOne({ _id: guesthouseId, owner: ownerId });
        if (!guesthouse) {
            return res.status(403).json({ success: false, message: "Guesthouse not found or unauthorized" });
        }

        const existingRoom = await Room.findOne({ guesthouse: guesthouseId, roomNumber });
        if (existingRoom) {
            return res.status(400).json({ success: false, message: `Room number ${roomNumber} already exists` });
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
