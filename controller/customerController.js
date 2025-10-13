const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const Booking = require("../models/Booking")
const Review = require("../models/review")
const Notification = require("../models/notification")
const Promo = require("../models/Promo")
const Favorites = require("../models/Favorite")
const createNotification = require("../utils/notificationHelper");
const Atolls = require("../models/Atoll");
const Facility = require("../models/Facility");
const Island = require("../models/Island");
const Bedroom = require("../models/Bedroom");
const logger = require('../utils/logger');
const Payment = require("../models/Payment")

const BASE_URL = process.env.BASE_URL;

exports.getAllGuestHouses = async (req, res) => {
    try {
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
        if (atolls && typeof atolls === "string") {
            filter.atolls = atolls;
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
            .populate("atolls", "name")
            .populate("islands", "name")
            .sort(sortOption)
            .select("-location -owner -contactNumber -description -facilities -__v -createdAt")
            .lean(); // lean() for better performance

        if (!guestHouses.length) {
            return res.status(200).json({
                success: true,
                count: 0,
                message: "No guesthouses found.",
                data: []
            });
        }

        const customerId = req.user.id;
        const favorites = await Favorites.find({ customer: customerId }).select("guesthouse");
        const favoriteIds = favorites.map(f => f.guesthouse.toString());

        // Add full image URLs & reviews count
        const guestHousesWithUrls = await Promise.all(
            guestHouses.map(async gh => {
                gh.id = gh._id;
                delete gh._id;

                if (gh.atolls && typeof gh.atolls === "object") {
                    gh.atolls = gh.atolls.name;
                }
                if (gh.islands && typeof gh.islands === "object") {
                    gh.islands = gh.islands.name;
                }

                if (gh.guestHouseImage && Array.isArray(gh.guestHouseImage)) {
                    gh.guestHouseImage = gh.guestHouseImage.map(
                        img => `${BASE_URL}/uploads/guestHouseImage/${img}`
                    );
                }
                gh.stars = gh.stars != null ? parseFloat(gh.stars).toFixed(1) : "0.0";
                gh.cleaningFee = gh.cleaningFee ? parseFloat(gh.cleaningFee) : 0;
                gh.taxPercent = gh.taxPercent ? parseFloat(gh.taxPercent) : 0;

                try {
                    const reviews = await Review.countDocuments({ guesthouse: gh.id });
                    gh.reviews = reviews;
                } catch {
                    gh.reviews = 0;
                }

                gh.isFavourite = favoriteIds.includes(gh.id.toString()) ? 1 : 0;

                return gh;
            })
        );

        logger.info("Fetched %d guesthouses successfully.", guestHousesWithUrls.length);

        return res.status(200).json({
            success: true,
            statusCode: 200,
            count: guestHousesWithUrls.length,
            message: "Successfully fetched all active guesthouses.",
            data: guestHousesWithUrls
        });

    } catch (err) {
        logger.error("Internal server error in getAllGuestHouses: %s", err.stack);
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
        const { guesthouseId } = req.body;

        // Find guesthouse by Id
        const guestHouseObj = await Guesthouse.findById(guesthouseId)
            .populate("atolls", "name")
            .populate("islands", "name")
            .populate("facilities", "name")
            .select("-isFavourite -location -createdAt -__v -contactNumber -owner").lean();


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
        // Convert atolls, islands, facilities to proper format
        if (guestHouseObj.atolls && typeof guestHouseObj.atolls === "object") {
            guestHouseObj.atolls = guestHouseObj.atolls.name;
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

        guestHouseObj.rating = Number(rating);
        guestHouseObj.reviewsCount = reviewsCount;
        guestHouseObj.reviewScore = reviewScore;
        guestHouseObj.reviewsText = reviewsText;

        logger.info(`[GuestHouse] Fetched successfully`);

        // Successfully fetched guesthouse details
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Guesthouse fetched successfully.",
            data: guestHouseObj
        });

    } catch (err) {
        logger.error(`[GuestHouse] Error fetching by ID: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while fetching guesthouse.",
            error: err.message
        });
    }
};

exports.getAllRoomsByGuesthouseId = async (req, res) => {
    try {
        const { guesthouseId } = req.body || {};

        // Build base query
        const query = {
            guesthouse: guesthouseId,
            active: "active"
        };

        const rooms = await Room.find(query).lean();

        if (!rooms || rooms.length === 0) {
            return res.status(404).json({
                success: true,
                message: "No rooms found for this guesthouse."
            });
        }

        // Category descriptions
        const categoryDescriptions = {
            "Standard": "Budget-friendly rooms with essential comfort.",
            "Deluxe": "Comfortable rooms with modern design and facilities.",
            "Suite": "Spacious rooms with premium amenities and sea view.",
            "Family": "Ideal for families, spacious and cozy.",
            "Dormitory": "Shared rooms with basic amenities."
        };

        // Group rooms by category
        const groupedRooms = {};
        rooms.forEach(room => {
            const category = room.roomCategory || "Uncategorized";
            if (!groupedRooms[category]) {
                groupedRooms[category] = {
                    category_id: Object.keys(groupedRooms).length + 1,
                    category_name: category + " Rooms",
                    category_description: categoryDescriptions[category] || "",
                    rooms: []
                };
            }

            groupedRooms[category].rooms.push({
                room_id: room._id,
                room_description: room.description || category,
                price_per_night: room.pricePerNight,
                bed: room.bedType,
                images: (room.photos || []).map(img => `${BASE_URL}/uploads/rooms/${img.trim()}`)
            });
        });

        const data = Object.values(groupedRooms);

        return res.status(200).json({
            success: true,
            message: "Room list fetched successfully",
            data
        });

    } catch (error) {
        console.error("Error in getAllRoomsByGuesthouseId:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching rooms by guesthouseId.",
            error: error.message
        });
    }
};


exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.body;

        // find room using roomId
        const room = await Room.findById(roomId).populate("guesthouse", "name address");

        if (!room) {
            logger.warn(`[Room] Room not found: ${roomId}`);
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

        // Fix photos URLs
        if (room.photos && room.photos.length > 0) {
            room.photos = room.photos.map(img => `${BASE_URL}/uploads/rooms/${img}`);
        } else {
            room.photos = [];
        }

        logger.info(`[Room] Successfully fetched room: ${roomId}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetched room.",
            data: room
        });

    } catch (error) {
        logger.error(`[Room] Error fetching room ${roomId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching room.",
            error: error.message
        });
    }
};

//_______________________________________ BOOKING _______________________________________

exports.createBooking = async (req, res) => {
    try {
        const { guesthouseId, roomId, checkIn, checkOut, promoCode, guest } = req.body;
        const customerId = req.user.id;

        if (!guesthouseId || !roomId || !checkIn || !checkOut || !guest || !Array.isArray(roomId)) {
            logger.warn(`[Booking] Missing or invalid fields by customer ${customerId}`);
            return res.status(400).json({
                success: false,
                message: "Missing or invalid fields: guesthouseId, roomId (array), checkIn, checkOut, guest"
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkInDate < today) {
            return res.status(400).json({ success: false, message: "Check-in date cannot be in the past." });
        }

        if (checkInDate >= checkOutDate) {
            return res.status(400).json({ success: false, message: "Check-out date must be later than check-in date" });
        }

        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found." });
        }

        const rooms = await Room.find({ _id: { $in: roomId }, guesthouse: guesthouseId });
        if (rooms.length !== roomId.length) {
            return res.status(404).json({ success: false, message: "One or more rooms not found for this guesthouse." });
        }

        // Check availability for each room
        for (const room of rooms) {
            const overlap = await Booking.findOne({
                room: room._id,
                status: { $in: ["pending", "confirmed"] },
                $or: [
                    { checkIn: { $lte: checkOutDate }, checkOut: { $gte: checkInDate } }
                ]
            });
            if (overlap) {
                return res.status(400).json({
                    success: false,
                    message: `Room ${room._id} is not available for the selected dates.`
                });
            }
        }

        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const baseAmount = rooms.reduce((sum, room) => sum + (room.pricePerNight * nights), 0);

        const cleaningFee = guesthouse.cleaningFee || 0;
        const taxPercent = guesthouse.taxPercent || 0;

        let discountAmount = 0;
        if (promoCode) {
            const promo = await Promo.findOne({ code: promoCode });
            if (promo) {
                const promoStart = new Date(promo.startDate);
                const promoEnd = new Date(promo.endDate);
                if (checkInDate >= promoStart && checkOutDate <= promoEnd) {
                    if (promo.discountType === "flat") {
                        discountAmount = promo.discountValue;
                    } else if (promo.discountType === "percentage") {
                        discountAmount = (baseAmount * promo.discountValue) / 100;
                    }
                }
            }
        }

        const discountedAmount = Math.max(0, baseAmount - discountAmount);
        const taxAmount = (discountedAmount * taxPercent) / 100;
        const finalAmount = Math.round(discountedAmount + taxAmount + cleaningFee);

        const booking = new Booking({
            customer: customerId,
            guesthouse: guesthouseId,
            room: roomId,
            guest,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            nights,
            amount: baseAmount,
            cleaningFee,
            taxAmount,
            discount: discountAmount,
            finalAmount,
            promoCode: promoCode || null
        });

        await booking.save();

        // Update availability for each room
        for (const room of rooms) {
            room.availability.push({
                startDate: checkInDate,
                endDate: checkOutDate,
                isAvailable: false
            });
            await room.save();
        }

        await createNotification(
            { userId: guesthouseId, role: "guesthouse" },
            { userId: customerId, role: "customer" },
            "Booking Created",
            `Your booking at ${guesthouse.name} from ${checkIn} to ${checkOut} is created successfully. Please complete your payment ₹${booking.finalAmount} to confirm your booking.`,
            "payment",
            { bookingId: booking._id, guesthouseId, roomId }
        );

        await createNotification(
            { userId: customerId, role: "customer" },
            { userId: guesthouseId, role: "guesthouse" },
            "Booking Created",
            `Booking created for ${guesthouse.name} from ${checkIn} to ${checkOut}. Payment pending.`,
            "booking",
            { bookingId: booking._id, guesthouseId, roomId, customerId }
        );

        logger.info(`[Booking] Booking created: ${booking._id} by customer ${customerId}`);

        return res.status(201).json({
            success: true,
            message: "Booking created successfully. Please complete your payment to confirm booking.",
            data: booking
        });

    } catch (error) {
        logger.error(`[Booking] Error creating booking by customer ${req.user.id}: ${error.message}`, { stack: error.stack });
        return res.status(500).json({
            success: false,
            message: "Internal server error while creating booking",
            error: error.message
        });
    }
};


exports.proceedPayment = async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID is required.",
            });
        }

        const booking = await Booking.findById(bookingId)
            .populate("guesthouse", "name")
            .populate("room", "roomName");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found.",
            });
        }

        // Format date as “10 September 2025”
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
        };

        // Build response same as shown in UI
        const bookingDetails = {
            noOfRooms: booking.room ? booking.room.length : 1,
            totalNight: booking.nights.toString().padStart(2, "0"),
            checkIn: formatDate(booking.checkIn),
            checkOut: formatDate(booking.checkOut),
            noOfPerson: booking.guest.toString().padStart(2, "0"),
            price: booking.amount,
            cleaningFee: booking.cleaningFee,
            taxes: booking.taxAmount,
            discount: booking.discount ? booking.discount : 0,
            total: booking.finalAmount,
        };

        return res.status(200).json({
            success: true,
            message: "Booking details fetched successfully.",
            data: bookingDetails,
        });
    } catch (error) {
        console.error(" Error in proceedPayment:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while fetching booking details.",
            error: error.message,
        });
    }
};

exports.getAllPaymentTypes = async (req, res) => {
    try {

        // Static payment types
        const paymentTypes = [
            {
                name: "Card",
                image: `${BASE_URL}/uploads/payment/card.png`
            },
            {
                name: "PayPal",
                image: `${BASE_URL}/uploads/payment/paypal.png`
            },
            {
                name: "UPI",
                image: `${BASE_URL}/uploads/payment/upi.jpg`
            },
            {
                name: "Wallet",
                image: `${BASE_URL}/uploads/payment/stripe.webp`
            }
        ];

        res.status(200).json({
            success: true,
            message: "Payment types fetched successfully.",
            count: paymentTypes.length,
            data: paymentTypes
        });

    } catch (error) {
        console.error("Error fetching payment types:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching payment types.",
            error: error.message
        });
    }
};

exports.payPayment = async (req, res) => {
    try {
        const { bookingId, paymentMethod } = req.body;

        const customerId = req.user.id;

        if (!bookingId) {
            logger.warn(`[PAYMENT] Missing bookingId for customer: ${customerId}`);
            return res.status(400).json({
                success: false,
                message: "Missing bookingId"
            });
        }

        // Fetch booking by ID
        const booking = await Booking.findOne({ _id: bookingId, customer: customerId });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `Booking with ID ${bookingId} not found.`
            });
        }

        // Only allow payment if status is pending
        if (booking.status !== "pending") {
            logger.info(`[PAYMENT] Payment attempt on non-pending booking. BookingID: ${bookingId}, Status: ${booking.status}`);
            return res.status(400).json({
                success: false,
                message: `Booking status is "${booking.status}", payment not allowed.`
            });
        }

        // Update payment status
        booking.status = "confirmed"; // confirm booking after payment
        booking.reason = booking.reason || "Payment completed";

        await booking.save();

        const payment = new Payment({
            booking: booking._id,
            amount: booking.finalAmount,
            paymentMethod: paymentMethod,
            paymentStatus: "paid"
        });

        await payment.save();

        logger.info(`[PAYMENT] Payment successful. BookingID: ${bookingId}, CustomerID: ${customerId}, Amount: ${booking.finalAmount}`);

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
            `payment ${booking.amount} received of bookingId ${bookingId} is successfully received.`
        );

        res.status(200).json({
            success: true,
            message: `Payment ${booking.finalAmount} successful for booking ${bookingId}`,
            data: booking
        });

    } catch (error) {
        logger.error(`[PAYMENT] Error processing payment: ${error.message}`, { stack: error.stack });
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
        const { status } = req.body || {}; // optional filter

        let query = { customer: customerId };

        if (status && status.toLowerCase() !== "all") {
            query.status = status;
        }

        let bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        // Auto-update booking status to 'complete' if checkOut < today
        const today = new Date();
        for (let booking of bookings) {
            if (booking.status === "confirmed" && new Date(booking.checkOut) < today) {
                booking.status = "completed";
                await booking.save();
            }
        }

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage?.length) {
                guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
            }

            // Room count logic
            let roomCount = 0;
            if (Array.isArray(booking.room)) roomCount = booking.room.length;
            else if (typeof booking.room === "number") roomCount = booking.room;
            else if (booking.room) roomCount = 1;

            return {
                id: booking._id,
                guesthouse: guesthouse._id || null,
                guestHouseImg,
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
                    booking.status.slice(1), // <-- Capitalized here,
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Successfully fetched ${formattedBookings.length} bookings for customer: ${customerId}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetched your bookings.",
            count: formattedBookings.length,
            data: formattedBookings,
        });
    } catch (error) {
        logger.error(`[BOOKING] Error fetching bookings for customer: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching all bookings.",
            error: error.message,
        });
    }
};

exports.getBooking = async (req, res) => {
    let bookingId;
    try {
        bookingId = req.body.bookingId; // booking id from body
        const customerId = req.user.id;

        const booking = await Booking.findOne({
            _id: bookingId,
            customer: customerId,
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
        let roomType = booking.room && booking.room.roomCategory ? booking.room.roomCategory : "";

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
                customerName: "N/A",
                customerProfileImage: "N/A",
                customerContact: "N/A",
                paymentMethod: "N/A",
                paymentStatus: "unpaid",
                paymentDate: null,
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
        logger.error(`[BOOKING] Error fetching booking ${bookingId} for customer: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching booking.",
            error: error.message
        });
    }
};

exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.body;
    const customerId = req.user.id;
    try {

        // Fetch the booking
        const booking = await Booking.findOne({ _id: bookingId, customer: customerId });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `Booking with ID ${bookingId} not found.`
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


        if (booking.paymentStatus === "paid") {
            booking.paymentStatus = "refunded";
            booking.reason = "Cancelled by customer after payment";

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
            message: `Booking with ID ${bookingId} has been successfully cancelled.`,
            data: booking
        });

    } catch (error) {
        logger.error(`[BOOKING] Error cancelling booking ${bookingId} for customer ${customerId}. Error: ${error.message}`, { stack: error.stack });
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
            logger.warn(`[BOOKING] Unauthorized access attempt to past bookings`);
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        logger.info(`[BOOKING] Fetching past bookings for customer ${customerId}`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastBookings = await Booking.find({
            customer: customerId,
            checkOut: { $lt: today }
        })
            .sort({ checkOut: -1 }) // latest past bookings first
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!pastBookings || pastBookings.length === 0) {
            logger.info(`[BOOKING] No past bookings found for customer ${customerId}`);
            return res.status(200).json({
                success: true,
                message: "No past bookings found.",
                count: 0,
                data: [],
                serverTime: new Date().toISOString()
            });
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
                status: booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1), // <-- Capitalized here
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Fetched ${formattedBookings.length} past bookings for customer ${customerId}`);

        res.status(200).json({
            success: true,
            message: "Past bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings
        });

    } catch (error) {
        logger.error(`[BOOKING] Error fetching past bookings for customer ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
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
            logger.warn(`[BOOKING] Unauthorized access attempt to upcoming bookings`);
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        logger.info(`[BOOKING] Fetching upcoming bookings for customer ${customerId}`);

        const today = new Date();
        today.setHours(0, 0, 0, 0); // din ka start time fix

        const bookings = await Booking.find({
            customer: customerId,
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
            logger.info(`[BOOKING] No upcoming bookings found for customer ${customerId}`);
            return res.status(200).json({
                success: true,
                message: "No upcoming bookings found.",
                count: 0,
                data: [],
                serverTime: new Date().toISOString()
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
                status: booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1), // <-- Capitalized here
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Fetched ${formattedBookings.length} upcoming bookings for customer ${customerId}`);

        return res.status(200).json({
            success: true,
            message: "Upcoming bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings,
            serverTime: new Date().toISOString()
        });

    } catch (error) {
        logger.error(`[BOOKING] Error fetching upcoming bookings for customer ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
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
            logger.warn(`[BOOKING] Unauthorized access attempt to cancelled bookings`);
            return res.status(400).json({
                success: false,
                message: "Customer ID is required."
            });
        }

        logger.info(`[BOOKING] Fetching cancelled bookings for customer ${customerId}`);

        const bookings = await Booking.find({ customer: customerId, status: "cancelled" })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!bookings || bookings.length === 0) {
            logger.info(`[BOOKING] No cancelled bookings found for customer ${customerId}`);
            return res.status(200).json({
                success: true,
                count: 0,
                message: "No cancelled bookings found.",
                data: [],
                serverTime: new Date().toISOString()
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
                status: booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1), // <-- Capitalized here,
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Fetched ${formattedBookings.length} cancelled bookings for customer ${customerId}`);

        res.status(200).json({
            success: true,
            count: formattedBookings.length,
            message: "Cancelled bookings fetched successfully.",
            data: formattedBookings,
        });
    } catch (error) {
        logger.error(`[BOOKING] Error fetching cancelled bookings for customer ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching cancelled bookings.",
            error: error.message
        });
    }
};

// exports.pendingBooking = async (req, res) => {
//     try {
//         const customerId = req.user.id;
//         const pendingBookings = await Booking.find({
//             customer: customerId,
//             status: "pending"
//         })
//             .sort({ checkOut: -1 }) // latest past bookings first
//             .populate({
//                 path: "guesthouse",
//                 select: "name address guestHouseImage",
//             })
//             .select("-__v -createdAt -updatedAt");

//         if (!pendingBookings || pendingBookings.length === 0) {
//             logger.info(`[BOOKING] No pending bookings found for customer ${customerId}`);
//             return res.status(200).json({
//                 success: true,
//                 message: "No pending bookings found.",
//                 count: 0,
//                 data: [],
//                 serverTime: new Date().toISOString()
//             });
//         }

//         const formattedBookings = pendingBookings.map((booking) => {
//             const guesthouse = booking.guesthouse || {};
//             let guestHouseImg = "";

//             if (guesthouse.guestHouseImage) {
//                 if (Array.isArray(guesthouse.guestHouseImage)) {
//                     guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
//                 } else if (typeof guesthouse.guestHouseImage === "string") {
//                     guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage.split(",")[0].trim()}`;
//                 }
//             }

//             // Room count logic
//             let roomCount = 0;
//             if (Array.isArray(booking.room)) {
//                 roomCount = booking.room.length;
//             } else if (typeof booking.room === "number") {
//                 roomCount = booking.room;
//             } else if (booking.room) {
//                 roomCount = 1;
//             }

//             return {
//                 id: booking._id,
//                 guesthouse: guesthouse._id || null,
//                 guestHouseImg: guestHouseImg,
//                 guestHouseName: guesthouse.name || "",
//                 guestHouseAddress: guesthouse.address || "",
//                 checkIn: booking.checkIn
//                     ? new Date(booking.checkIn).toISOString().split("T")[0]
//                     : "",
//                 checkOut: booking.checkOut
//                     ? new Date(booking.checkOut).toISOString().split("T")[0]
//                     : "",
//                 room: roomCount,
//                 guest: booking.guest,
//                 amount: booking.amount,
//                 finalAmount: booking.finalAmount,
//                 status: booking.status.charAt(0).toUpperCase() +
//                     booking.status.slice(1), // <-- Capitalized here
//                 paymentStatus: booking.paymentStatus,
//             };
//         });

//         logger.info(`[BOOKING] Fetched ${formattedBookings.length} pending bookings for customer ${customerId}`);

//         res.status(200).json({
//             success: true,
//             message: "pending bookings fetched successfully.",
//             count: formattedBookings.length,
//             data: formattedBookings
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "error fetching pending bookings.",
//             error: error
//         })
//     }
// }


//_______________________________________ Reviews _____________________________________


exports.addReviewAndRating = async (req, res) => {
    try {
        const { guestHouseId, rating, comment } = req.body;

        // User info from JWT
        const user = req.user;
        const customerId = user?.id;

        if (!customerId) {
            logger.warn(`[REVIEW] Unauthorized attempt to add review`);
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        // Guesthouse check
        const guestHouse = await Guesthouse.findById(guestHouseId);
        if (!guestHouse) {
            logger.warn(`[REVIEW] GuestHouse not found: ${guestHouseId} by customer ${customerId}`);
            return res.status(404).json({
                success: false,
                message: "No GuestHouse found."
            });
        }

        // Review object create
        const review = new Review({
            guesthouse: guestHouseId,
            customer: customerId,
            rating,
            comment
        });

        // Save review
        await review.save();

        logger.info(`[REVIEW] Customer ${customerId} added review for GuestHouse ${guestHouseId}`);

        res.status(201).json({
            success: true,
            message: "Review added successfully",
            serverTime: new Date().toISOString()
        });

    } catch (err) {
        logger.error(`[REVIEW] Error adding review by customer ${req.user?.id}. Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
            serverTime: new Date().toISOString()
        });
    }
};

exports.getReviewByGuestHouse = async (req, res) => {
    try {
        const { guestHouseId } = req.body; // guestHouseId from request body

        if (!guestHouseId) {
            logger.warn(`[REVIEW] Missing guestHouseId in request body`);
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
                serverTime: new Date().toISOString()
            });
        }

        // Get all reviews of this guesthouse
        const reviews = await Review.find({ guesthouse: guestHouseId })
            .populate("customer", "name profileImage")
            .select("rating comment createdAt")
            .lean()
            .sort({ createdAt: -1 }); // sorted by newest first

        if (!reviews || reviews.length === 0) {
            logger.info(`[REVIEW] No reviews found for guesthouse ${guestHouseId}`);
            return res.status(200).json({
                success: true,
                message: `No reviews found for guesthouse ${guestHouseId}`,
                count: 0,
                averageRating: 0,
                ratingDistribution: { Star5: 0, Star4: 0, Star3: 0, Star2: 0, Star1: 0 },
                reviews: [],
                serverTime: new Date().toISOString()
            });
        }

        // Calculate average rating
        const totalRating = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        const avgRating = totalRating / reviews.length;

        // Calculate star distribution
        const ratingDistribution = { Star5: 0, Star4: 0, Star3: 0, Star2: 0, Star1: 0 };
        reviews.forEach(r => {
            const star = Math.round(r.rating);
            if (star >= 1 && star <= 5) ratingDistribution[`Star${star}`]++;
        });

        // Format reviews
        const formattedReviews = reviews.map(r => ({
            userName: r.customer?.name || "Anonymous",
            profileImage: r.customer?.profileImage
                ? `${BASE_URL}/uploads/profileImage/${r.customer.profileImage}`
                : `${BASE_URL}/uploads/profileImage/default.png`,
            rating: r.rating,
            date: r.createdAt ? r.createdAt.toISOString().split("T")[0] : null,
            comment: r.comment || ""
        }));

        logger.info(`[REVIEW] ${reviews.length} reviews fetched for guesthouse ${guestHouseId}`);

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully.",
            count: reviews.length,
            averageRating: parseFloat(avgRating.toFixed(1)),
            ratingDistribution,
            reviews: formattedReviews
        });

    } catch (err) {
        logger.error(`[REVIEW] Error fetching guesthouse reviews for ${req.body?.guestHouseId}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error fetching guesthouse reviews.",
            error: err.message,
            serverTime: new Date().toISOString()
        });
    }
};

exports.getAllPromos = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // only date part

        const promos = await Promo.find({
            isActive: true,
            endDate: { $gte: today }
        }).sort({ createdAt: -1 })
            .select("-createdAt -isActive")

        if (!promos || promos.length === 0) {
            logger.info("[PROMO] No active promo codes found.");
            return res.status(404).json({
                success: true,
                message: "No active promo codes found.",
                NoOfPromos: 0,
                data: []
            });
        }

        logger.info(`[PROMO] Fetched ${promos.length} active promo codes.`);

        const formattedPromos = promos.map(p => ({
            id: p._id,
            code: p.code,
            discountType: p.discountType,
            discountValue: p.discountValue,
            startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : null,
            endDate: p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Active promo codes fetched successfully.",
            count: formattedPromos.length,
            data: formattedPromos
        });

    } catch (err) {
        logger.error(`[PROMO] Error fetching promos: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error fetching promos.",
            error: err.message
        });
    }
};

exports.getPromoById = async (req, res) => {
    try {
        const { promoId } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // only date part

        const promo = await Promo.findOne({
            _id: promoId,
            isActive: true,
            endDate: { $gte: today }
        }).select("-createdAt -isActive")

        if (!promo) {
            logger.info(`[PROMO] No active promo code found with ID: ${promoId}`);
            return res.status(404).json({
                success: true,
                message: "No active promo code found.",
                data: []
            });
        }

        logger.info(`[PROMO] Fetched active promo code with ID: ${promoId}`);

        const formattedPromo = {
            id: promo._id,
            code: promo.code,
            discount: promo.discount,
            minAmount: promo.minAmount,
            maxDiscount: promo.maxDiscount,
            startDate: promo.startDate ? new Date(promo.startDate).toISOString().split("T")[0] : null,
            endDate: promo.endDate ? new Date(promo.endDate).toISOString().split("T")[0] : null,
        };

        res.status(200).json({
            success: true,
            message: "promo code fetch successfully.",
            data: formattedPromo
        });

    } catch (err) {
        logger.error(`[PROMO] Error fetching promo ID: ${promoId}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error fetching promo.",
            error: err.message
        });
    }
};

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
            .select("-sender -receiver   -updatedAt -__v")

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
            let timeOnly = null;
            if (n.createdAt) {
                const date = new Date(n.createdAt);
                // hh:mm:ss format
                timeOnly = date.toTimeString().split(" ")[0];
            }
            return {
                id: n._id,
                title: n.title,
                message: n.message,
                isRead: n.isRead,
                createdAt: timeOnly
            };
        });

        logger.info(`[NOTIFICATION] Fetched ${mappedNotifications.length} notifications for customer: ${customerId}`);
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Notifications fetched successfully.",
            count: mappedNotifications.length,
            data: mappedNotifications
        });

    } catch (error) {
        logger.error(`[NOTIFICATION] Error fetching notifications for customer: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
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
        const { notificationId } = req.body;
        const customerId = req.user.id;

        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": customerId,
        }).select("-sender -receiver -createdAt -updatedAt -__v");

        if (!notification) {
            logger.warn(`[NOTIFICATION] Notification not found for customer: ${customerId}, notificationId: ${notificationId}`);
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        // Mark as read
        notification.isRead = true;
        await notification.save();

        logger.info(`[NOTIFICATION] Notification marked as read for customer: ${customerId}, notificationId: ${notificationId}`);

        const mappedNotification = {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
        };

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: mappedNotification
        });

    } catch (err) {
        logger.error(`[NOTIFICATION] Error marking notification as read for customer: ${req.user.id}, notificationId: ${req.params.notificationId}. Error: ${err.message}`, { stack: err.stack });
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
        const customerId = req.user.id;

        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": customerId,
        });

        if (!notification) {
            logger.warn(`[NOTIFICATION] Notification not found for deletion. Customer: ${customerId}, notificationId: ${notificationId}`);
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        await notification.deleteOne();
        logger.info(`[NOTIFICATION] Notification deleted successfully. Customer: ${customerId}, notificationId: ${notificationId}`);

        return res.status(200).json({
            success: true,
            message: "Notification successfully deleted.",
            notification: notificationId
        });

    } catch (err) {
        logger.error(`[NOTIFICATION] Error deleting notification for customer: ${req.user.id}, notificationId: ${req.params.notificationId}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error deleting notification",
            error: err.message
        });
    }
};

exports.getfavorites = async (req, res) => {
    try {
        const customerId = req.user.id;

        const favorites = await Favorites.find({ customer: customerId })
            .populate({
                path: "guesthouse",
                select: "_id name guestHouseImage price"
            });

        if (!favorites || favorites.length === 0) {
            logger.info(`[FAVORITES] No favorite guesthouses found for customer: ${customerId}`);
            return res.status(200).json({
                success: true,
                message: "No favorite guesthouse found.",
                data: []
            });
        }

        const formattedFavorites = favorites.map(fav => {
            let firstImage = null;
            if (fav.guesthouse?.guestHouseImage?.length > 0) {
                firstImage = `${BASE_URL}/uploads/guestHouseImage/${fav.guesthouse.guestHouseImage[0].trim()}`;
            }

            return {
                id: fav.guesthouse._id,
                name: fav.guesthouse?.name || "",
                guestHouseImage: firstImage, //  only one image
                price: fav.guesthouse?.price || 0,
                isFavourite: fav.isFavourite
            };
        });

        logger.info(`[FAVORITES] Fetched ${formattedFavorites.length} favorite guesthouses for customer: ${customerId}`);

        return res.status(200).json({
            success: true,
            message: "Favorite guesthouses fetched successfully.",
            count: formattedFavorites.length,
            data: formattedFavorites,
        });
    } catch (err) {
        logger.error(`[FAVORITES] Error fetching favorites for customer: ${req.user.id}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Failed to fetch favorites",
            error: err.message,
        });
    }
};

exports.addFavorites = async (req, res) => {
    try {
        const guesthouseId = req.body.guesthouseId; // corrected name
        const userId = req.user.id;

        if (!guesthouseId) {
            logger.warn(`[FAVORITES] Guesthouse ID missing from request by user: ${userId}`);
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
            });
        }

        // Check if guesthouse exists
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            logger.warn(`[FAVORITES] Guesthouse not found. User: ${userId}, GuesthouseId: ${guesthouseId}`);
            return res.status(404).json({
                success: false,
                message: "No guesthouse found.",
            });
        }

        // Check if already favorited
        const existingFavorite = await Favorites.findOne({ customer: userId, guesthouse: guesthouseId });
        if (existingFavorite) {
            logger.info(`[FAVORITES] Guesthouse delete from favorites. User: ${userId}, GuesthouseId: ${guesthouseId}`);
            await existingFavorite.deleteOne();
            return res.status(200).json({
                success: true,
                message: "Guesthouse successfully remove from favourite."
            })
        }

        // Add to favorites
        const favorite = new Favorites({
            customer: userId,
            guesthouse: guesthouseId,
            isFavourite: 1
        });
        await favorite.save();

        logger.info(`[FAVORITES] Guesthouse added to favorites by user: ${userId}`);

        return res.status(201).json({
            success: true,
            message: `Guesthouse successfully added to favorites.`
        });

    } catch (error) {
        logger.error(`[FAVORITES] Error adding guesthouse to favorites for user: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
        return res.status(500).json({
            success: false,
            message: "Failed to add guesthouse to favorites.",
            error: error.message,
        });
    }
};

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
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "atollId is required"
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



