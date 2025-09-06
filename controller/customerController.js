const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");

//  Search for nearby guesthouses based on coordinates and distance
exports.searchNearbyRooms = async (req, res) => {
    try {
        const { lng, lat, distance } = req.query;

        // Validate query parameters
        if (!lng || !lat || !distance) {
            return res.status(400).json({ 
                success: false, 
                message: "Please provide lng, lat, and distance" 
            });
        }

        // Find guesthouses near the provided location
        const guestHouses = await Guesthouse.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(distance)
                }
            }
        });

        return res.status(200).json({
            success: true,
            totalGuestHouses: guestHouses.length,
            data: guestHouses
        });
    } catch (err) {
        console.error("Error searching nearby rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

//  Get details of a specific room
exports.getRoomDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const room = await Room.findById(id).populate("guesthouse", "name location");

        if (!room) {
            return res.status(404).json({ 
                success: false, 
                message: "Room not found" 
            });
        }

        return res.status(200).json({
            success: true,
            message: "Room details fetched successfully",
            data: room
        });
    } catch (err) {
        console.error("Error getting room details:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

//  Search guesthouses by city or name
exports.searchGuestHouses = async (req, res) => {
    try {
        const { name, address, city, state } = req.query;

        let filter = {};

        if (name) filter.name = new RegExp(name, "i"); // Case-insensitive search
        if (address) filter.address = new RegExp(address, "i");
        if (city) filter.city = new RegExp(city, "i"); // Case-insensitive search
        if (state) filter.state = new RegExp(state, "i");

        const guestHouses = await Guesthouse.find(filter);

        return res.status(200).json({
            success: true,
            totalGuestHouses: guestHouses.length,
            message: "Guest Houses fetched successfully",
            data: guestHouses
        });
    } catch (err) {
        console.error("Error searching rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

//  Get all rooms of a specific guesthouse
exports.getGuestHouseRooms = async (req, res) => {
    try {
        const { id } = req.params;

        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guest House not found"
            });
        }

        const rooms = await Room.find({ guesthouse: guesthouse._id });

        return res.status(200).json({
            success: true,
            totalRooms: rooms.length,
            data: rooms
        });
    } catch (err) {
        console.error("Error fetching guesthouse rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

