const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const Booking = require("../models/Booking")
const Review = require("../models/review")
const Notification = require("../models/notification")
const Promo = require("../models/Promo")
const Favorites = require("../models/Favorite")
const createNotification = require("../utils/notificationHelper");
const { RunCommandCursor } = require("mongodb");
const Atolls = require("../models/Atoll");
const Facility = require("../models/Facility");
const Island = require("../models/Island");
const Bedroom = require("../models/Bedroom")

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5050}`;

// -------------------------------------------- guestHouseRoutesGUESTHOUSE  ---------------------------------------
exports.getAllGuestHouses = async (req, res) => {
    try {
        let { lng, lat, distance } = req.body;


        lng = lng ? parseFloat(lng) : null;
        lat = lat ? parseFloat(lat) : null;
        distance = distance ? parseInt(distance) : null;


        if (!lng || !lat || !distance) {
            const guestHouses = await Guesthouse.find({ status: "active" });

            if (!guestHouses || guestHouses.length === 0) {
                return res.status(404).json({
                    success: false,
                    statusCode: 404,
                    NoOfGuestHouse: 0,
                    message: "No guesthouses found.",
                    data: []
                });
            }

            // गेस्टहाउस की छवियों के लिए पूर्ण URL जोड़ें
            const guestHousesWithUrls = guestHouses.map(gh => {
                const obj = gh.toObject();
                if (obj.guestHouseImage) {
                    obj.guestHouseImage = obj.guestHouseImage.map(img => `${BASE_URL}/uploads/guestHouseImage/${img}`);
                }
                return obj;
            });

            return res.status(200).json({
                success: true,
                statusCode: 200,
                NoOfGuestHouse: guestHousesWithUrls.length,
                message: "Successfully fetched all active guesthouses.",
                data: guestHousesWithUrls
            });
        }

        // यदि lng, lat, और distance सभी उपलब्ध हैं, तो निकटतम गेस्टहाउस खोजें
        if (isNaN(lng) || isNaN(lat) || isNaN(distance)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid request body. Provide valid lng, lat, and distance."
            });
        }

        const guestHouses = await Guesthouse.find({
            status: "active",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: distance
                }
            }
        });

        if (!guestHouses || guestHouses.length === 0) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                NoOfGuestHouse: 0,
                message: "No guesthouses found nearby.",
                data: []
            });
        }

        // गेस्टहाउस की छवियों के लिए पूर्ण URL जोड़ें
        const guestHousesWithUrls = guestHouses.map(gh => {
            const obj = gh.toObject();
            if (obj.guestHouseImage) {
                obj.guestHouseImage = obj.guestHouseImage.map(img => `${BASE_URL}/uploads/guestHouseImage/${img}`);
            }
            return obj;
        });

        return res.status(200).json({
            success: true,
            statusCode: 200,
            NoOfGuestHouse: guestHousesWithUrls.length,
            message: "Successfully fetched guesthouses near you.",
            data: guestHousesWithUrls
        });

    } catch (err) {
        console.error("[GuestHouse Nearby] Error:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while searching guesthouses.",
            error: err.message
        });
    }
};

exports.getGuestHouseById = async (req, res) => {
    try {
        const { id } = req.params;

        // find guesthoue by Id
        const guestHouse = await Guesthouse.findById(id);

        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Guesthouse not found.",
                data: null
            });
        }


        const guestHouseObj = guestHouse.toObject();

        // convert image into full url path
        if (guestHouseObj.guestHouseImage) {
            guestHouseObj.guestHouseImage = guestHouseObj.guestHouseImage.map(
                img => `${BASE_URL}/uploads/guestHouseImage/${img}`
            );
        }

        // successfully fetch guesthouse details
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Guesthouse fetched successfully.",
            data: guestHouseObj
        });

    } catch (err) {
        console.error("[ERROR][GuestHouse By ID]:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while fetching guesthouse.",
            error: err.message
        });
    }
};

exports.searchGuestHouseNearBy = async (req, res) => {
    try {
        let { lng, lat, distance } = req.query;

        lng = parseFloat(lng);
        lat = parseFloat(lat);
        distance = parseInt(distance);

        if (isNaN(lng) || isNaN(lat) || isNaN(distance)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid query parameters. Provide valid lng, lat, and distance."
            });
        }

        const guestHouses = await Guesthouse.find({
            status: "active",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: distance
                }
            }
        });

        if (!guestHouses || guestHouses.length === 0) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                NoOfGuestHouse: 0,
                message: "No guesthouses found nearby.",
                data: []
            });
        }


        // Add full URLs for guestHouseImage
        const guestHousesWithUrls = guestHouses.map(gh => {
            const obj = gh.toObject();
            if (obj.guestHouseImage) {
                obj.guestHouseImage = obj.guestHouseImage.map(img => `${BASE_URL}/uploads/guestHouseImage/${img}`);
            }
            return obj;
        });

        return res.status(200).json({
            success: true,
            statusCode: 200,
            NoOfGuestHouse: guestHousesWithUrls.length,
            message: "Successfully fetched guesthouses near you.",
            data: guestHousesWithUrls
        });

    } catch (err) {
        console.error("[GuestHouse Nearby] Error:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while searching guesthouses.",
            error: err.message
        });
    }
};

// -------------------------------------------- ROOMS ---------------------------------------
exports.getAllRoomsByGuesthouseId = async (req, res) => {
    try {
        const guesthouseId = req.params.guesthouseId; // route param se id nikalna

        const rooms = await Room.find({ guesthouse: guesthouseId });

        if (!rooms || rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse."
            });
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetch all rooms",
            count: rooms.length,
            data: rooms
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching rooms by guesthouseId.",
            error: error.message
        });
    }
};

exports.getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        // find room using roomId
        const room = await Room.findById(id).populate("guesthouse", "name address");

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

        // this base url for room images full url path
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Fix photos URLs
        if (room.photos && room.photos.length > 0) {
            room.photos = room.photos.map(img => `${BASE_URL}/uploads/rooms/${img}`);
        } else {
            room.photos = [];
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetched room.",
            data: room
        });

    } catch (error) {
        console.error("[ROOM] Error fetching room:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching room.",
            error: error.message
        });
    }
};

exports.searchRooms = async (req, res) => {
    try {

        // search room by using filter 
        const { city, startDate, endDate, capacity, minPrice, maxPrice, amenities, sort: sortQuery } = req.query;

        let filter = {};

        // Capacity filter
        if (capacity) {
            filter.capacity = { $gte: Number(capacity) };
        }

        // City filter
        if (city) {
            const guesthouses = await Guesthouse.find({
                city: { $regex: city, $options: 'i' }
            }).select('_id');

            filter.guesthouse = { $in: guesthouses.map(g => g._id) };
        }

        // Price filter
        if (minPrice || maxPrice) {
            filter.pricePerNight = {};
            if (minPrice) filter.pricePerNight.$gte = Number(minPrice);
            if (maxPrice) filter.pricePerNight.$lte = Number(maxPrice);
        }

        // Amenities filter (all amenities must match)
        if (amenities) {
            let amenitiesArray = amenities.split(",").map(a => a.trim());

            filter.amenities = {
                $all: amenitiesArray.map(a => new RegExp(`^${a}$`, "i"))
            };
        }

        // Sorting logic
        let sort = {};
        if (sortQuery) {
            if (req.query.sort === "lowest") {
                sort.pricePerNight = 1;
            } else if (req.query.sort === "highest") {
                sort.pricePerNight = -1;
            }
        } else {
            sort.createdAt = -1;
        }

        const BASE_URL = process.env.BASE_URL || `http://192.168.1.33:${process.env.PORT || 5000}`;

        // Fetch rooms
        let rooms = await Room.find(filter)
            .populate('guesthouse', 'name city address')
            .sort(sort)
            .lean();

        // Extra filter: Check availability overlap
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            rooms = rooms.filter(room => {
                if (!room.availability || room.availability.length === 0) return true;

                for (let slot of room.availability) {
                    if (!slot.isAvailable) {
                        const slotStart = new Date(slot.startDate);
                        const slotEnd = new Date(slot.endDate);

                        // Agar date ranges overlap karte hain
                        const isOverlap = (start < slotEnd && end > slotStart);

                        if (isOverlap) {
                            return false; // booked hai, room reject
                        }
                    }
                }
                return true; // koi overlap nahi mila, room allow
            });

        }

        // Update photos with full URLs
        rooms = rooms.map(room => {
            const photos = (room.photos || []).map(photo => `${BASE_URL}/uploads/rooms/${photo}`);
            return { ...room, photos };
        });

        res.status(200).json({
            success: true,
            NoOfRooms: rooms.length,
            message: "Rooms fetched successfully",
            data: rooms
        });

    } catch (error) {
        console.error("Error searching rooms ", error);
        res.status(500).json({
            success: false,
            message: 'Error searching rooms',
            error: error.message
        });
    }
};

// -------------------------------------------- BOOKING --------------------------------------
exports.createBooking = async (req, res) => {
    try {
        const { guesthouseId, roomId, checkIn, checkOut, promoCode } = req.body;

        const customerId = req.user.id;
        console.log(req.user)
        // validate input
        if (!guesthouseId || !roomId || !checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: guesthouseId, roomId, customerId, checkIn, checkOut"
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ignore time part for comparison

        //  Check if check-in is today or in the future
        if (checkInDate < today) {
            return res.status(400).json({
                success: false,
                message: "Check-in date cannot be in the past."
            });
        }

        if (checkInDate >= checkOutDate) {
            return res.status(400).json({
                success: false,
                message: "Check-out date must be later than check-in date"
            });
        }

        // guesthouse check
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        // room check
        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouseId });
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found for this guesthouse."
            });
        }

        // check overlapping bookings for this room
        const overlapBooking = await Booking.findOne({
            room: roomId,
            status: { $in: ["pending", "confirmed"] }, // active bookings only
            $or: [
                {
                    checkIn: { $lte: new Date(checkOut) },
                    checkOut: { $gte: new Date(checkIn) }
                }
            ]
        });

        if (overlapBooking) {
            return res.status(400).json({
                success: false,
                message: "Room is not available for the selected dates."
            });
        }

        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        const amount = nights * room.pricePerNight;
        let finalAmount = amount;
        let discountAmount = 0;

        let promo;
        if (promoCode) {
            promo = await Promo.findOne({ code: promoCode });
            if (!promo) {
                return res.status(400).json({
                    success: false,
                    message: "No promocode found."
                })
            }

            const promoStart = new Date(promo.startDate);
            const promoEnd = new Date(promo.endDate);
            if (checkInDate >= promoStart && checkOutDate <= promoEnd) {
                if (promo.discountType === "flat") {
                    discountAmount = promo.discountValue;
                } else if (promo.discountType === "percentage") {
                    finalAmount -= (amount * promo.discountValue) / 100;
                }
                finalAmount -= discountAmount;

                if (finalAmount < 0) {
                    finalAmount = 0;
                }
            }
        }



        // let appliedPromo = null;
        // if (promoCode) {
        //     const promo = await Promo.findOne({ code: promoCode, isActive: true });
        //     if (!promo) {
        //         return res.status(404).json({
        //             suucess: false,
        //             message: "No promo code found"
        //         })
        //     }
        //     else {
        //         const promoStart = new Date(promo.startDate);
        //         const promoEnd = new Date(promo.endDate);

        //         if (checkInDate >= promoStart && checkOutDate <= promoEnd) {
        //             if (promo.discountType === "flat") {
        //                 amount -= promo.discountValue;
        //             } else if (promo.discountType === "percentage") {
        //                 amount -= (amount * promo.discountValue) / 100;
        //             }
        //             if (amount < 0) amount = 0;
        //             appliedPromo = promo.code;
        //         }
        //     }
        // }

        // create booking

        const booking = new Booking({
            customer: customerId,
            guesthouse: guesthouseId,
            room: roomId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            nights,
            amount,
            discount: discountAmount,
            finalAmount,
            promoCode: promoCode || null

        });

        await booking.save();

        // Optional: maintain availability array in Room schema
        room.availability.push({ startDate: booking.checkIn, endDate: booking.checkOut, isAvailable: false });
        await room.save();

        await createNotification(
            { userId: guesthouseId, role: "guesthouse" }, // sender = guesthouse admin
            { userId: customerId, role: "customer" },        // receiver = customer
            "Booking Created",
            `Your booking at ${guesthouse.name} from ${checkIn} to ${checkOut} is created successfully. Please complete your payment ${boking.finalAmount} to confirm your booking.`,
            "payment",
            { bookingId: booking._id, guesthouseId: guesthouseId, roomId: roomId }
        );

        await createNotification(
            { userId: customerId, role: "customer" },  // sender = customer
            { userId: guesthouseId, role: "guesthouse" },  // receiver = guesthouse
            "Booking Created",
            `Booking is created for your ${guesthouse.name} from ${checkIn} to ${checkOut} is created successfully. Payment pending.`,
            "booking",
            { bookingId: booking._id, guesthouseId: guesthouseId, roomId: roomId, customerId: customerId }
        );


        return res.status(201).json({
            success: true,
            message: "Booking created successfully. plz complete your payment to confirm booking.",
            data: booking
        });

    } catch (error) {
        console.error("Error creating booking:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while creating booking",
            error: error.message
        });
    }
};

exports.payPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Missing bookingId"
            });
        }

        // Fetch booking by ID
        const booking = await Booking.findOne({ _id: id, customer: customerId });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `Booking with ID ${id} not found.`
            });
        }

        // Only allow payment if status is pending
        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Booking status is "${booking.status}", payment not allowed.`
            });
        }

        // Update payment status
        booking.paymentStatus = "paid";
        booking.status = "confirmed"; // confirm booking after payment
        booking.reason = booking.reason || "Payment completed";

        await booking.save();

        const guesthouse = await Guesthouse.findById(booking.guesthouse);

        const guesthouseId = guesthouse._id;

        await createNotification(
            { userId: guesthouseId, role: "guesthouse" }, // sender
            { userId: customerId, role: "customer" },        // receiver
            "Payment Successful",                            // title
            `Your booking at ${guesthouse.name} from ${booking.checkIn} to ${booking.checkOut} has been confirmed.`
        );

        // send notification to guesthouse for received payment
        await createNotification(
            { userId: customerId, role: "customer" },  // sender = customer
            { userId: guesthouseId, role: "guesthouse" },  // receiver = guesthouse
            "Payment Received",
            `payment ${booking.amount} received of bookingId ${booking._id} is successfully received.`
        );

        res.status(200).json({
            success: true,
            message: `Payment ${booking.finalAmount} successful for booking ${id}`,
            data: booking
        });

    } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while processing payment",
            error: error.message
        });
    }
};

exports.allBooking = async (req, res) => {
    try {

        const customerId = req.user.id;
        console.log(customerId)
        // Get all bookings of customer - latest first
        const bookings = await Booking.find({ customer: customerId })
            .sort({ createdAt: -1 }); // -1 means descending (latest first)


        res.status(200).json({
            success: true,
            message: "Successfully fetch your bookings.",
            count: bookings.length,
            data: bookings
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "error to fetch all bookings.",
            error: error
        })
    }
}

exports.getBooking = async (req, res) => {
    try {
        const { id } = req.params; // extract booking id from URL params

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetched your booking.",
            data: booking
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking.",
            error: error.message
        });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;

        // Fetch the booking
        const booking = await Booking.findOne({ _id: id, customer: customerId });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `Booking with ID ${id} not found.`
            });
        }

        const today = new Date();

        if (new Date(booking.checkOut) < today) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel booking. Stay period is already completed."
            })
        }

        // Only allow cancel if status is pending or confirmed
        if (!["pending", "confirmed"].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel booking. Current status is "${booking.status}".`
            });
        }

        // Update booking status
        booking.status = "cancelled";

        // Handle payment refund status
        if (booking.paymentStatus === "paid") {
            booking.paymentStatus = "refunded";
            booking.reason = "Cancelled by customer after payment";
            // Optional: trigger actual refund here with payment gateway
        } else {
            booking.reason = "Cancelled by customer";
        }

        await booking.save();

        // Find the room related to this booking
        const room = await Room.findById(booking.room);

        if (room && room.availability) {
            room.availability = room.availability.filter(slot => {
                const slotStart = new Date(slot.startDate).getTime();
                const slotEnd = new Date(slot.endDate).getTime();
                const bookingStart = new Date(booking.checkIn).getTime();
                const bookingEnd = new Date(booking.checkOut).getTime();

                // delete slot only if matches the cancelled booking
                return !(slotStart === bookingStart && slotEnd === bookingEnd && slot.isAvailable === false);
            });

            await room.save();
        }

        const guesthouse = await Guesthouse.findById(booking.guesthouse);
        const guesthouseId = guesthouse._id;
        await createNotification(
            { userId: guesthouseId, role: "guesthouse" }, // sender
            { userId: customerId, role: "customer" },        // receiver
            "Cancel Booking",                            // title
            `Your booking at ${guesthouse.name} from ${booking.checkIn} to ${booking.checkOut} has been cancel. Amount ${booking.amount} will be refuded.`
        );

        res.status(200).json({
            success: true,
            message: `Booking with ID ${id} has been successfully cancelled.`,
            data: booking
        });

    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while cancelling booking.",
            error: error.message
        });
    }
};

exports.pastBooking = async (req, res) => {
    try {
        const customerId = req.user.id; // user from auth middleware
        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastBookings = await Booking.find({
            customer: customerId,
            checkOut: { $lt: today }
        }).sort({ checkOut: -1 }); // latest past bookings first

        if (pastBookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No past bookings found."
            });
        }

        res.status(200).json({
            success: true,
            count: pastBookings.length,
            message: "Past bookings fetched successfully.",
            data: pastBookings
        });
    } catch (error) {
        console.error("Error fetching past bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching past bookings.",
            error: error.message
        });
    }
};

exports.upcomingBooking = async (req, res) => {
    try {
        const customerId = req.user.id;
        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // din ka start time fix kar diya

        const bookings = await Booking.find({
            customer: customerId,
            checkIn: { $gte: today },  // sirf future ya aaj ki bookings
            status: { $in: ["pending", "confirmed"] } // active bookings only
        })
            .sort({ checkIn: 1 }) // sabse najdik wali trip pehle

        if (!bookings || bookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No upcoming bookings found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Upcoming bookings fetched successfully.",
            count: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error("Error fetching upcoming bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching upcoming trips.",
            error: error.message
        });
    }
};

exports.getCancelBookings = async (req, res) => {
    try {
        const customerId = req.user.id;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID is required."
            });
        }

        const bookings = await Booking.find({ customer: customerId, status: "cancelled" });

        if (!bookings || bookings.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                message: "No cancelled bookings found.",
                data: []
            });
        }

        //  Return cancelled bookings
        return res.status(200).json({
            success: true,
            count: bookings.length,
            message: "Cancelled bookings fetched successfully.",
            data: bookings
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching cancelled bookings.",
            error: error.message
        });
    }
};

// -------------------------------------------- REVIEWS ---------------------------------------
exports.addReviewAndRating = async (req, res) => {
    try {
        const { guestHouseId, roomId, rating, comment } = req.body;

        //  Guesthouse check
        const guestHouse = await Guesthouse.findById(guestHouseId);
        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                message: "No GuestHouse found."
            });
        }

        const rooms = await Room.findOne({ _id: roomId, guesthouse: guestHouseId })
        if (!rooms) {
            return res.status(404).json({
                success: false,
                message: "No room found in given guesthouse."
            })
        }

        //  User info from JWT
        const user = req.user; // middleware se aata h
        const customerId = user.id;

        // Review object create
        const review = new Review({
            guesthouse: guestHouseId,
            room: roomId,
            customer: customerId,
            rating,
            comment
        });

        //  Save review
        await review.save();

        res.status(201).json({
            success: true,
            message: "Review added successfully",
            review
        });

    } catch (err) {
        console.error("Add Review Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getAllReviews = async (req, res) => {
    try {

        const userId = req.user.id;

        const reviews = await Review.find({ customer: userId })
            .populate("customer", "name email")
            .populate("guesthouse", "name address")
            .populate("room", "roomNumber")
            .sort({ createdAt: -1 }); // latest first

        if (!reviews || reviews.length === 0) {
            return res.status(404).json({
                success: true,
                message: "No reviews found.",
                count: 0,
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully.",
            count: reviews.length,
            data: reviews
        });

    } catch (err) {
        console.error("[REVIEW] Error fetching reviews:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching reviews list.",
            error: err.message
        });
    }
};

exports.getReviewByGuestHouse = async (req, res) => {
    try {
        const { id } = req.params; // guesthouseId from route

        // Get all reviews of guesthouse
        const reviews = await Review.find({ guesthouse: id })
            .populate("customer", "name email")
            .populate("room", "roomNumber")
            .sort({ createdAt: -1 })
            .lean();

        if (!reviews || reviews.length === 0) {
            return res.status(404).json({
                success: true,
                message: `No reviews found for guesthouse ${id}`,
                count: 0,
                data: []
            });
        }

        // Average rating calculation
        const avgRating =
            reviews.reduce((acc, r) => acc + (r.rating || 0), 0) /
            reviews.length;

        return res.status(200).json({
            success: true,
            message: `Reviews fetched for guesthouse ${id}`,
            count: reviews.length,
            averageRating: avgRating.toFixed(1),
            data: reviews
        });

    } catch (err) {
        console.error("[REVIEW] Error fetching guesthouse reviews:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching guesthouse reviews.",
            error: err.message
        });
    }
};

exports.getReviewByRoom = async (req, res) => {
    try {
        const { id } = req.params; // roomId from route

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

        const reviews = await Review.find({ room: id })
            .populate("customer", "name email")
            .sort({ createdAt: -1 })
            .lean();

        if (!reviews || reviews.length === 0) {
            return res.status(404).json({
                success: true,
                message: `No reviews found for room ${id}`,
                count: 0,
                data: []
            });
        }

        // Average rating
        const avgRating = reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length;

        return res.status(200).json({
            success: true,
            message: `Reviews fetched for room ${id}`,
            count: reviews.length,
            averageRating: avgRating.toFixed(1),
            data: reviews
        });

    } catch (err) {
        console.error("[REVIEW] Error fetching room reviews:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching room reviews.",
            error: err.message
        });
    }
};

// -------------------------------------------- PROMOS ---------------------------------------
exports.getAllPromos = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // only date part

        const promos = await Promo.find({
            isActive: true,
            endDate: { $gte: today }
        }).sort({ createdAt: -1 });

        if (!promos || promos.length === 0) {
            return res.status(404).json({
                success: true,
                message: "No active promo codes found.",
                NoOfPromos: 0,
                data: []
            });
        }

        res.status(200).json({
            success: true,
            message: "Active promo codes fetched successfully.",
            count: promos.length,
            data: promos
        });

    } catch (err) {
        console.error("[PROMO] Error fetching promos:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching promos.",
            error: err.message
        });
    }
};

exports.getPromoById = async (req, res) => {
    try {
        const { id } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // only date part

        const promo = await Promo.findOne({
            _id: id,
            isActive: true,
            endDate: { $gte: today }
        })

        if (!promo || promo.length === 0) {
            return res.status(404).json({
                success: true,
                message: "No active promo code found.",
                data: []
            });
        }

        res.status(200).json({
            success: true,
            message: "Active promo code fetched successfully.",
            data: promo
        });

    } catch (err) {
        console.error("[PROMO] Error fetching promo:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching promo.",
            error: err.message
        });
    }
}

// -------------------------------------------- NOTIFICATION ---------------------------------------
exports.getAllNotification = async (req, res) => {
    try {
        const customerId = req.user.id;

        // Fetch notifications, latest first
        const notifications = await Notification.find({
            "receiver.userId": customerId,
            "receiver.role": "customer",
        })
            .sort({ createdAt: -1 }) // latest first
            .lean()
            .select("-sender -receiver -createdAt  -updatedAt -__v")

        if (!notifications || notifications.length === 0) {
            return res.status(200).json({
                success: true,
                statusCode: 200,
                message: "No notifications found.",
                count: 0,
                data: []
            });
        }

        const mappedNotifications = notifications.map(n => {
            return {
                id: n._id,
                title: n.title,
                message: n.message,
                isRead: n.isRead,
            };
        });

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Notifications fetched successfully.",
            count: mappedNotifications.length,
            data: mappedNotifications
        });

    } catch (error) {
        console.error("[NOTIFICATION] Error fetching notifications:", error);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Error fetching notifications.",
            error: error.message
        });
    }
};

exports.readNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const customerId = req.user.id;

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": customerId,
        }).select("-sender -receiver -createdAt  -updatedAt -__v");

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        //  Mark as read
        notification.isRead = true;
        await notification.save();

        const mappedNotifications = {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
        }


        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: mappedNotifications
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
        const { notificationId } = req.params;
        const customerId = req.user.id;

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": customerId,
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

// -------------------------------------------- FAVOURITE ---------------------------------------
exports.getfavorites = async (req, res) => {
    try {
        const customerId = req.user.id;
        const favorites = await Favorites.find({ customer: customerId }).populate("room", "roomNumber guesthouse");
        if (!favorites || favorites.length === 0) {
            res.status(200).json({
                success: true,
                message: "No favorite guesthouse found.",
                data: []
            })
        }
        return res.status(200).json({
            success: true,
            message: "Favorite rooms fetched successfully.",
            count: favorites.length,
            data: favorites,
        });
    } catch (err) {
        console.error("Error in getFavorites:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch favorites",
            error: err.message,
        });
    }

}

exports.addFavorites = async (req, res) => {
    try {
        const roomId = req.params.id; // get from URL params
        const userId = req.user.id;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "room ID is required.",
            });
        }

        // Optional: check if guesthouse exists
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "room not found.",
            });
        }

        // Check if already favorited
        const existingFavorite = await Favorites.findOne({ customer: userId, room: roomId });
        if (existingFavorite) {
            return res.status(400).json({
                success: false,
                message: "room is already in favorites.",
            });
        }

        // Add to favorites
        const favorite = new Favorites({
            customer: userId,
            room: roomId,
        });
        await favorite.save();

        return res.status(201).json({
            success: true,
            message: `room ${roomId} successfully added to favorites.`,
            data: favorite,
        });

    } catch (error) {
        console.error("Error adding room to favorites:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add room to favorites.",
            error: error.message,
        });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required.",
            });
        }

        const favorite = await Favorites.findOne({ customer: customerId, _id: id });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: "no favorite found.",
            });
        }

        await favorite.deleteOne({ _id: id });

        return res.status(200).json({
            success: true,
            message: "Removed from favorites successfully.",
        });

    } catch (error) {
        console.error("Error removing from favorites:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove from favorites.",
            error: error.message,
        });
    }
};

// ---------------------------------------- get islands/ facilities / atolls
exports.createAtoll = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name field is required"
            });
        }

        // Check if an atoll with same name exists already (optional)
        const existing = await Atolls.findOne({ name });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Atoll with this name already exists"
            });
        }

        const atoll = new Atolls({
            name
            // createdAt is auto defaulted
        });

        await atoll.save();

        return res.status(201).json({
            success: true,
            data: atoll
        });
    } catch (err) {
        console.error("[Atoll] createAtoll error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};

exports.getAllAtolls = async (req, res) => {
    try {
        const atolls = await Atolls.find({}, { _id: 1, name: 1, createdAt: 1 }).lean();

        const modifiedAtolls = atolls.map(atoll => ({
            id: atoll._id,
            name: atoll.name,

        }));

        res.status(200).json({
            success: true,
            count: modifiedAtolls.length,
            message: "Successfully fetched all atolls",
            data: modifiedAtolls
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching atolls",
            error: error.message
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

exports.addBedroomNames = async (req, res) => {

    try {
        const { name } = req.body; // Expecting an array of bedroom names

        if (!name) {
            return res.status(400).json({ message: 'Please provide a bedroom name.' });
        }

        const bedroom = await Bedroom.findOneAndUpdate(
            {},
            { $addToSet: { names: name } }, // Adds each name to the array if not already present
            { new: true, upsert: true }
        );

        res.status(200).json({ message: 'Bedroom names added successfully.', bedroom });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while adding bedroom names.' });
    }
};

exports.setMaxPrice = async (req, res) => {
    const { maxPrice } = req.body; // Expecting a string value for maxPrice

    if (!maxPrice) {
        return res.status(400).json({ message: 'Please provide a maxPrice.' });
    }

    try {
        const bedroom = await Bedroom.findOneAndUpdate(
            {},
            { $set: { maxPrice } },
            { new: true, upsert: true }
        );

        res.status(200).json({ message: 'Max price set successfully.', bedroom });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while setting the max price.' });
    }
};

exports.getbedroom = async (req, res) => {
    try {
        const bedroom = await Bedroom.findOne(); // Assuming only one document exists

        if (!bedroom) {
            return res.status(404).json({
                success: false,
                message: "No bedroom data found",
            });
        }

        // Constructing the response as per your specified structure
        const response = {
            success: true,
            message: "Successfully fetched all bedroom types",
            maxPrice: bedroom.maxPrice.toString(),
            data: bedroom.names.map(name => ({
                id: bedroom._id.toString(),
                name: name,
            })),
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(500).json({
            success: false,
            message: "Error fetching bedroom data",
            error: error.message,
        });
    }
};


exports.getAllfacilities = async (req, res) => {
    try {
        const facilities = await Facility.find({}, { _id: 1, name: 1 }).lean().sort({ createdAt: -1 });

        const modifiedAtolls = facilities.map(facilitie => ({
            id: facilitie._id,
            name: facilitie.name,

        }));

        res.status(200).json({
            success: true,
            count: modifiedAtolls.length,
            message: "Succefully fetch all facilities",
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


exports.getAllIslands = async (req, res) => {
    try {
        // Use req.query to get the atollId from the query string
        const { atollId } = req.query;

        // Validate that atollId is provided
        if (!atollId) {
            return res.status(400).json({
                success: false,
                message: "atollId query parameter is required"
            });
        }

        // Fetch islands that match the atollId
        const islands = await Island.find({ atoll: atollId });

        // Return the result
        res.status(200).json({
            success: true,
            count: islands.length,
            data: islands
        });
    } catch (error) {
        // Handle any errors that occur
        res.status(500).json({
            success: false,
            message: "Error fetching islands",
            error: error.message // It's helpful to include the error message for debugging
        });
    }
};


