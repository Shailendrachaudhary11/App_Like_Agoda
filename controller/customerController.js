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
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Extract & parse body params safely
        let { lng, lat, distance, sort, atolls, islands, facilities } = req.body;

        lng = lng ? parseFloat(lng) : null;
        lat = lat ? parseFloat(lat) : null;
        distance = distance ? parseInt(distance) : 3000; // default 3 km in meters

        // Validate coordinates if provided
        if ((lng && !lat) || (!lng && lat)) {
            return res.status(400).json({
                success: false,
                message: "Both 'lng' and 'lat' are required for location-based filtering."
            });
        }

        // Build dynamic filter
        let filter = { status: "active" };
        if (facilities && Array.isArray(facilities) && facilities.length > 0) {
            filter.facilities = { $in: facilities };
        }
        if (atolls && Array.isArray(atolls) && atolls.length > 0) {
            filter.atolls = { $in: atolls };
        }
        if (islands && Array.isArray(islands) && islands.length > 0) {
            filter.islands = { $in: islands };
        }

        if (lat && lng) {
            filter.location = {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: distance
                }
            };
        }

        // Handle sorting
        let sortOption = {};
        switch (sort) {
            case "lowest":
                sortOption = { price: 1 };
                break;
            case "highest":
                sortOption = { price: -1 };
                break;
            case "stars":
                sortOption = { stars: -1 };
                break;
            default:
                sortOption = {};
        }

        // Fetch guesthouses
        const guestHouses = await Guesthouse.find(filter)
            .sort(sortOption)
            .select("-location -owner -contactNumber -description -facilities -__v -createdAt")
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
                gh.id = gh._id;
                delete gh._id;

                if (gh.guestHouseImage && Array.isArray(gh.guestHouseImage)) {
                    gh.guestHouseImage = gh.guestHouseImage.map(
                        img => `${BASE_URL}/uploads/guestHouseImage/${img}`
                    );
                }

                try {
                    const reviews = await Review.countDocuments({ guesthouse: gh.id });
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

exports.getGuestHouseById = async (req, res) => {
    try {
        const { id } = req.params;
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5050}`;

        // Find guesthouse by Id
        const guestHouse = await Guesthouse.findById(id, { location: 0, createdAt: 0, __v: 0, contactNumber: 0, owner: 0 });

        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Guesthouse not found.",
                data: null
            });
        }

        const guestHouseObj = guestHouse.toObject();

        // Convert images into full URL paths
        if (guestHouseObj.guestHouseImage && guestHouseObj.guestHouseImage.length > 0) {
            guestHouseObj.guestHouseImage = guestHouseObj.guestHouseImage.map(
                img => `${BASE_URL}/uploads/guestHouseImage/${img}`
            );
        } else {
            guestHouseObj.guestHouseImage = [];
        }

        const reviews = await Review.find({ guesthouse: id }).sort({ createdAt: -1 });

        let rating = 0;
        let reviewScore = 0;
        let reviewsCount = reviews.length;
        let reviewsText = "";

        const getRatingComment = (avgRating) => {
            if (avgRating <= 2) return "Poor";
            if (avgRating < 4) return "Good";
            return "Excellent";
        };

        if (reviewsCount > 0) {
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);

            // Calculate average rating
            reviewScore = totalRating / reviewsCount;
            rating = reviewScore.toFixed(1);
            reviewsText = getRatingComment(reviewScore);
        }

        guestHouseObj.rating = Number(rating);
        guestHouseObj.reviewsCount = reviewsCount;
        guestHouseObj.reviewScore = reviewScore;
        guestHouseObj.reviewsText = reviewsText;

        // Successfully fetched guesthouse details
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Guesthouse fetched successfully.",
            data: guestHouseObj
        });

    } catch (err) {
        console.error("[ERROR][GuestHouse By ID]:", err);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while fetching guesthouse.",
            error: err.message
        });
    }
};

// -------------------------------------------- ROOMS ---------------------------------------
exports.getAllRoomsByGuesthouseId = async (req, res) => {
    try {
        const guesthouseId = req.params.guesthouseId; // route param se id nikalna

        let rooms = await Room.find({ guesthouse: guesthouseId }, { createdAt: 0, __v: 0 }).lean();

        if (!rooms || rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse."
            });
        }

        rooms = rooms.map(room => ({
            id: room._id,
            ...room,
            _id: undefined   // remove _id
        }));

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
            `Your booking at ${guesthouse.name} from ${checkIn} to ${checkOut} is created successfully. Please complete your payment ${booking.finalAmount} to confirm your booking.`,
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
            .sort({ createdAt: -1 }) // -1 means descending (latest first)

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
        const { guestHouseId, rating, comment } = req.body;

        //  Guesthouse check
        const guestHouse = await Guesthouse.findById(guestHouseId);
        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                message: "No GuestHouse found."
            });
        }

        //  User info from JWT
        const user = req.user; // middleware se aata h
        const customerId = user.id;

        // Review object create
        const review = new Review({
            guesthouse: guestHouseId,
            customer: customerId,
            rating,
            comment
        });

        //  Save review
        await review.save();

        res.status(201).json({
            success: true,
            message: "Review added successfully"
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
            return res.status(200).json({
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
            .populate("customer", "name profileImage")
            .select("rating comment createdAt") // only needed fields
            .lean()
            .sort({ rating: -1 })

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

        const ratingDistribution = { Star5: 0, Star4: 0, Star3: 0, Star2: 0, Star1: 0 };

        reviews.forEach(r => {
            const star = Math.floor(r.rating); // e.g., 3.5 → 3
            if (star === 5) ratingDistribution.Star5++;
            else if (star === 4) ratingDistribution.Star4++;
            else if (star === 3) ratingDistribution.Star3++;
            else if (star === 2) ratingDistribution.Star2++;
            else if (star === 1) ratingDistribution.Star1++;
        });


        const formattedReviews = reviews.map(r => ({
            userName: r.customer?.name || "Anonymous",
            profileImage: r.customer?.profileImage
                ? `${BASE_URL}/uploads/profileImage/${r.customer.profileImage}` // full url
                : null,
            rating: r.rating,
            date: r.createdAt ? r.createdAt.toISOString().split("T")[0] : null,
            comment: r.comment
        }));

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully",
            averageRating: parseFloat(avgRating.toFixed(1)),
            ratingDistribution,
            reviews: formattedReviews
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

// exports.getReviewByRoom = async (req, res) => {
//     try {
//         const { id } = req.params; // roomId from route

//         const room = await Room.findById(id);
//         if (!room) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Room not found."
//             });
//         }

//         const reviews = await Review.find({ room: id })
//             .populate("customer", "name email")
//             .sort({ createdAt: -1 })
//             .lean();

//         if (!reviews || reviews.length === 0) {
//             return res.status(404).json({
//                 success: true,
//                 message: `No reviews found for room ${id}`,
//                 count: 0,
//                 data: []
//             });
//         }

//         // Average rating
//         const avgRating = reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length;

//         return res.status(200).json({
//             success: true,
//             message: `Reviews fetched for room ${id}`,
//             count: reviews.length,
//             averageRating: avgRating.toFixed(1),
//             data: reviews
//         });

//     } catch (err) {
//         console.error("[REVIEW] Error fetching room reviews:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Error fetching room reviews.",
//             error: err.message
//         });
//     }
// };

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
        const favorites = await Favorites.find({ customer: customerId }).populate("guesthouse");
        if (!favorites || favorites.length === 0) {
            res.status(200).json({
                success: true,
                message: "No favorite guesthouse found.",
                data: []
            })
        }
        return res.status(200).json({
            success: true,
            message: "Favorite guesthouses fetched successfully.",
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
        const guesthouseId = req.params.id; // corrected name
        const userId = req.user.id;

        if (!guesthouseId) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
            });
        }

        // Check if guesthouse exists
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found.",
            });
        }

        // Check if already favorited
        const existingFavorite = await Favorites.findOne({ customer: userId, guesthouse: guesthouseId });
        if (existingFavorite) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse is already in favorites.",
            });
        }

        // Add to favorites
        const favorite = new Favorites({
            customer: userId,
            guesthouse: guesthouseId,
        });
        await favorite.save();

        return res.status(201).json({
            success: true,
            message: `Guesthouse ${guesthouseId} successfully added to favorites.`
        });

    } catch (error) {
        console.error("Error adding guesthouse to favorites:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add guesthouse to favorites.",
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

exports.getbedroom = async (req, res) => {
    try {
        const bedroom = await Bedroom.find().sort().select("-__v"); // Assuming only one document exists

        if (!bedroom || bedroom.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No bedroom data found",
            });
        }

        // Sort numerically based on number in name
        const sortedBedrooms = bedroom.sort((a, b) => {
            const numA = parseInt(a.name); // e.g., "3 bedroom" => 3
            const numB = parseInt(b.name);
            return numA - numB;
        });

        // Map to rename _id -> id
        const formattedBedrooms = sortedBedrooms.map(b => {
            const obj = b.toObject();
            obj.id = obj._id;
            delete obj._id;
            return obj;
        });

        const response = {
            success: true,
            message: "Successfully fetched all bedroom types",
            data: formattedBedrooms
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error fetching bedroom data",
            error: error.message,
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

exports.getAllIslands = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "atollId parameter is required"
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



