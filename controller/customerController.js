const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const { checkout } = require("../routes/userRoutes");
const Booking = require("../models/Booking")

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

        let filter = { status: "approved" };

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

// searchRooms
exports.searchRooms = async (req, res) => {
    try {
        const { city, minPrice, maxPrice, amenities, capacity, checkIn, checkOut } = req.query;

        let guesthouseFilter = { status: "approved" };
        if (city) {
            guesthouseFilter.city = { $regex: new RegExp(city, "i") };
        }

        const guesthouses = await Guesthouse.find(guesthouseFilter);

        let roomFilter = {
            guesthouse: { $in: guesthouses.map(g => g._id) },
            pricePerNight: { $gte: minPrice || 0, $lte: maxPrice || 100000 }
        };

        if (capacity) roomFilter.capacity = { $gte: Number(capacity) };
        // Amenities filter
        if (amenities) {
            roomFilter.amenities = { $all: amenities.split(",") };
        }

        // Availability filter
        if (checkIn && checkOut) {
            roomFilter.availability = {
                $elemMatch: {
                    startDate: { $lte: new Date(checkIn) },
                    endDate: { $gte: new Date(checkOut) },
                    isAvailable: true
                }
            };

            const rooms = await Room.find(roomFilter).populate("guesthouse");

            res.status(200).json({
                success: true,
                message: "Rooms are avaible according to you....",
                NoOfRooms: rooms.length,
                data: rooms
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Search failed"
        });
    }
};


// POST bookRoom
exports.bookRoom = async (req, res) => {
    try {
        const { roomId, checkIn, checkOut, promoCode } = req.body;

        if (!roomId || !checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        // ✅ Check for existing confirmed bookings with overlapping dates
        const overlappingBooking = await Booking.findOne({
            room: roomId,
            status: "confirmed",
            $or: [
                { checkIn: { $lt: new Date(checkOut), $gte: new Date(checkIn) } },
                { checkOut: { $lte: new Date(checkOut), $gt: new Date(checkIn) } },
                { checkIn: { $lte: new Date(checkIn) }, checkOut: { $gte: new Date(checkOut) } }
            ]
        });

        if (overlappingBooking) {
            return res.status(400).json({
                success: false,
                message: "Room is already booked for these dates."
            });
        }

        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        const amount = nights * room.pricePerNight;

        const booking = await Booking.create({
            customer: req.user.id,
            guesthouse: room.guesthouse._id,
            room: roomId,
            checkIn,
            checkOut,
            nights,
            amount,
            status: "pending" // initially pending until payment
        });

        res.status(201).json({
            success: true,
            message: "Booking created! Please complete payment to confirm your booking.",
            booking
        });

    } catch (error) {
        console.error("Booking error:", error);
        res.status(500).json({
            success: false,
            message: "Error booking room"
        });
    }
};


// payment done makePayment
exports.makePayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "No Booking found."
            });
        }

        if (booking.status === "confirmed") {
            res.status(200).json({
                success: true,
                message: "Your payment is already done."
            });
        }
        booking.status = "confirmed";
        await booking.save(); // ✅ Save the updated status


        res.status(200).json({
            success: true,
            amount: booking.amount,
            message: "Your payment is done and booking is confirmed."
        });
    } catch (err) {
        console.error("Payment error:", err.message); // optional: log error
        res.status(500).json({
            success: false,
            message: "Error processing payment."
        });
    }
};

// getAllBooking
exports.getAllBooking = async (req, res) => {
    try {
        const { customerId } = req.params;
        const booking = await Booking.find({ customer: customerId }).populate({ path: "guesthouse", select: "name location" });

        res.status(200).json({
            success: true,
            message: "Your Bookings: ",
            bookings: booking
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to get booking."
        });
    }
}
