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

        const customerId = req.user.id;
        const favorites = await Favorites.find({ customer: customerId }).select("guesthouse");
        const favoriteIds = favorites.map(f => f.guesthouse.toString());

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
                gh.stars = gh.stars != null ? parseFloat(gh.stars).toFixed(1) : "0.0";

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
            NoOfGuestHouse: guestHousesWithUrls.length,
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
        const { id } = req.params;
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5050}`;

        // Find guesthouse by Id
        const guestHouse = await Guesthouse.findById(id, { isFavourite: 0, location: 0, createdAt: 0, __v: 0, contactNumber: 0, owner: 0 });

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

        guestHouseObj.stars = guestHouseObj.stars != null ? parseFloat(guestHouseObj.stars).toFixed(1) : "0.0";

        const reviews = await Review.find({ guesthouse: id }).sort({ createdAt: -1 });

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

        logger.info(`[GuestHouse] Fetched successfully: ${id}`);

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

// -------------------------------------------- ROOMS ---------------------------------------
exports.getAllRoomsByGuesthouseId = async (req, res) => {
    try {
        const guesthouseId = req.params.guesthouseId;
        const { checkIn, checkOut } = req.body || {};

        let checkInDate, checkOutDate;
        if (checkIn && checkOut) {
            checkInDate = new Date(checkIn);
            checkOutDate = new Date(checkOut);
        }

        if (checkInDate && checkOutDate) {
            if (checkInDate > checkOutDate) {
                return res.status(400).json({
                    success: false,
                    message: "Check-in date must be before check-out date."
                });
            }
            if (checkInDate.getTime() === checkOutDate.getTime()) {
                return res.status(400).json({
                    success: false,
                    message: "Check-in and check-out dates cannot be the same."
                });
            }
        }
        // Get all rooms for the guesthouse
        let rooms = await Room.find({ guesthouse: guesthouseId }, { createdAt: 0, __v: 0 }).lean();

        if (!rooms || rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse."
            });
        }
        if (checkInDate && checkOutDate) {
            rooms = rooms.filter(room => {
                if (!room.availability || room.availability.length === 0) return true;

                const isBooked = room.availability.some(slot => {
                    return !slot.isAvailable &&
                        checkInDate < new Date(slot.endDate) &&
                        checkOutDate > new Date(slot.startDate);
                });

                return !isBooked;
            });
        }


        // Format rooms
        const formattedRooms = rooms.map(room => ({
            id: room._id,
            roomType: room.roomCategory || "",
            pricePerNight: room.pricePerNight || 0,
            images: (room.photos || []).map(img => `${BASE_URL}/uploads/rooms/${img.trim()}`)
        }));

        logger.info(`[Rooms] Fetched ${rooms.length} rooms for guesthouse ${guesthouseId}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetched rooms",
            count: formattedRooms.length,
            data: formattedRooms
        });

    } catch (error) {
        logger.error(`[Rooms] Error fetching rooms for guesthouse ${req.params.guesthouseId}: ${error.message}`, { stack: error.stack });
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
            logger.warn(`[Room] Room not found: ${id}`);
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

        logger.info(`[Room] Successfully fetched room: ${id}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetched room.",
            data: room
        });

    } catch (error) {
        logger.error(`[Room] Error fetching room ${req.params.id}: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching room.",
            error: error.message
        });
    }
};

// exports.searchRooms = async (req, res) => {
//     try {

//         // search room by using filter 
//         const { city, startDate, endDate, capacity, minPrice, maxPrice, amenities, sort: sortQuery } = req.query;

//         let filter = {};

//         // Capacity filter
//         if (capacity) {
//             filter.capacity = { $gte: Number(capacity) };
//         }

//         // City filter
//         if (city) {
//             const guesthouses = await Guesthouse.find({
//                 city: { $regex: city, $options: 'i' }
//             }).select('_id');

//             filter.guesthouse = { $in: guesthouses.map(g => g._id) };
//         }

//         // Price filter
//         if (minPrice || maxPrice) {
//             filter.pricePerNight = {};
//             if (minPrice) filter.pricePerNight.$gte = Number(minPrice);
//             if (maxPrice) filter.pricePerNight.$lte = Number(maxPrice);
//         }

//         // Amenities filter (all amenities must match)
//         if (amenities) {
//             let amenitiesArray = amenities.split(",").map(a => a.trim());

//             filter.amenities = {
//                 $all: amenitiesArray.map(a => new RegExp(`^${a}$`, "i"))
//             };
//         }

//         // Sorting logic
//         let sort = {};
//         if (sortQuery) {
//             if (req.query.sort === "lowest") {
//                 sort.pricePerNight = 1;
//             } else if (req.query.sort === "highest") {
//                 sort.pricePerNight = -1;
//             }
//         } else {
//             sort.createdAt = -1;
//         }

//         const BASE_URL = process.env.BASE_URL || `http://192.168.1.33:${process.env.PORT || 5000}`;

//         // Fetch rooms
//         let rooms = await Room.find(filter)
//             .populate('guesthouse', 'name city address')
//             .sort(sort)
//             .lean();

//         // Extra filter: Check availability overlap
//         if (startDate && endDate) {
//             const start = new Date(startDate);
//             const end = new Date(endDate);

//             rooms = rooms.filter(room => {
//                 if (!room.availability || room.availability.length === 0) return true;

//                 for (let slot of room.availability) {
//                     if (!slot.isAvailable) {
//                         const slotStart = new Date(slot.startDate);
//                         const slotEnd = new Date(slot.endDate);

//                         // Agar date ranges overlap karte hain
//                         const isOverlap = (start < slotEnd && end > slotStart);

//                         if (isOverlap) {
//                             return false; // booked hai, room reject
//                         }
//                     }
//                 }
//                 return true; // koi overlap nahi mila, room allow
//             });

//         }

//         // Update photos with full URLs
//         rooms = rooms.map(room => {
//             const photos = (room.photos || []).map(photo => `${BASE_URL}/uploads/rooms/${photo}`);
//             return { ...room, photos };
//         });

//         res.status(200).json({
//             success: true,
//             NoOfRooms: rooms.length,
//             message: "Rooms fetched successfully",
//             data: rooms
//         });

//     } catch (error) {
//         console.error("Error searching rooms ", error);
//         res.status(500).json({
//             success: false,
//             message: 'Error searching rooms',
//             error: error.message
//         });
//     }
// };

// -------------------------------------------- BOOKING --------------------------------------

// BOOKING



exports.createBooking = async (req, res) => {
    try {
        const { guesthouseId, roomId, checkIn, checkOut, promoCode, guest } = req.body;

        const customerId = req.user.id;
        console.log(req.user)
        // validate input
        if (!guesthouseId || !roomId || !checkIn || !checkOut || !guest) {
            logger.warn(`[Booking] Missing required fields by customer ${customerId}`);
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
            logger.warn(`[Booking] Invalid check-in date by customer ${customerId}`);
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
        const baseAmount = nights * room.pricePerNight;

        const cleaningFee = guesthouse.cleaningFee || 0;
        const taxPercent = guesthouse.taxPercent || 0;

        let discountAmount = 0;

        // Apply promo discount on baseAmount only
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

        // Calculate discounted amount
        const discountedAmount = Math.max(0, baseAmount - discountAmount);

        // Apply tax on discounted amount
        const taxAmount = (discountedAmount * taxPercent) / 100;

        // Final amount = discounted + tax + cleaning
        const finalAmount = Math.round(discountedAmount + taxAmount + cleaningFee);

        // Store baseAmount separately for reference
        const amount = baseAmount;


        const booking = new Booking({
            customer: customerId,
            guesthouse: guesthouseId,
            room: roomId,
            guest: guest || 0,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            nights,
            amount,          // original base room amount
            cleaningFee,
            taxAmount,
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

        logger.info(`[Booking] Booking created: ${booking._id} by customer ${customerId}`);

        return res.status(201).json({
            success: true,
            message: "Booking created successfully. plz complete your payment to confirm booking.",
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

exports.payPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const customerId = req.user.id;

        if (!id) {
            logger.warn(`[PAYMENT] Missing bookingId for customer: ${customerId}`);
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
            logger.info(`[PAYMENT] Payment attempt on non-pending booking. BookingID: ${id}, Status: ${booking.status}`);
            return res.status(400).json({
                success: false,
                message: `Booking status is "${booking.status}", payment not allowed.`
            });
        }

        // Update payment status
        booking.paymentStatus = "paid";
        booking.status = "confirmed"; // confirm booking after payment
        booking.paymentDate = new Date();
        if (req.body) {
            booking.paymentMethod = req.body.paymentMethod; // default to card
        }
        else {
            booking.paymentMethod = "upi";
        }
        booking.reason = booking.reason || "Payment completed";

        await booking.save();

        logger.info(`[PAYMENT] Payment successful. BookingID: ${id}, CustomerID: ${customerId}, Amount: ${booking.finalAmount}`);

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

        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

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
                status: booking.status,
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
    try {
        const { id } = req.params; // booking id from URL

        const booking = await Booking.findById(id)
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .populate({
                path: "room",
                select: "roomCategory price" // room model fields
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
        let roomCount = 1; // default 1 because schema is single room
        let roomType = booking.room && booking.room.roomCategory ? booking.room.roomCategory : "";


        // Payment details
        const paymentDetails = {
            customerName: customer.name || "",
            customerProfileImage: `${BASE_URL}/uploads/profileImage/${customer.profileImage}`,
            customerContact: customer.phone || "",
            paymentMethod: booking.paymentMethod || "N/A",
            paymentDate: booking.paymentDate
                ? new Date(booking.paymentDate).toISOString().split("T")[0]
                : null,
        };

        const formattedBooking = {
            id: booking._id,
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
            status: booking.status || "",
            paymentStatus: booking.paymentStatus || "",
            createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : "",
            updatedAt: booking.updatedAt ? new Date(booking.updatedAt).toISOString().split("T")[0] : "",
            paymentDetails: paymentDetails
        };

        logger.info(`[BOOKING] Successfully fetched booking ${booking._id} for customer: ${id}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetched booking details.",
            data: formattedBooking
        });
    } catch (error) {
        logger.error(`[BOOKING] Error fetching booking ${req.params.id} for customer: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
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

        logger.info(`[BOOKING] Booking ${id} successfully cancelled by customer ${customerId}`);

        res.status(200).json({
            success: true,
            message: `Booking with ID ${id} has been successfully cancelled.`,
            data: booking
        });

    } catch (error) {
        logger.error(`[BOOKING] Error cancelling booking ${req.params.id} for customer ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
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
                status: booking.status,
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Fetched ${formattedBookings.length} past bookings for customer ${customerId}`);

        res.status(200).json({
            success: true,
            message: "Past bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings,
            serverTime: new Date().toISOString()
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
                status: booking.status,
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
                status: booking.status,
                paymentStatus: booking.paymentStatus,
            };
        });

        logger.info(`[BOOKING] Fetched ${formattedBookings.length} cancelled bookings for customer ${customerId}`);

        res.status(200).json({
            success: true,
            count: formattedBookings.length,
            message: "Cancelled bookings fetched successfully.",
            data: formattedBookings,
            serverTime: new Date().toISOString()
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

// -------------------------------------------- REVIEWS ---------------------------------------
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

// exports.getAllReviews = async (req, res) => {
//     try {
//         const userId = req.user?.id;

//         if (!userId) {
//             logger.warn(`[REVIEW] Unauthorized attempt to fetch reviews`);
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized. Please login.",
//                 serverTime: new Date().toISOString()
//             });
//         }

//         const reviews = await Review.find({ customer: userId })
//             .populate("customer", "name email")
//             .populate("guesthouse", "name address")
//             .populate("room", "roomNumber")
//             .sort({ createdAt: -1 }); // latest first

//         if (!reviews || reviews.length === 0) {
//             logger.info(`[REVIEW] No reviews found for customer ${userId}`);
//             return res.status(200).json({
//                 success: true,
//                 message: "No reviews found.",
//                 count: 0,
//                 data: [],
//                 serverTime: new Date().toISOString()
//             });
//         }

//         logger.info(`[REVIEW] Fetched ${reviews.length} reviews for customer ${userId}`);
//         return res.status(200).json({
//             success: true,
//             message: "Reviews fetched successfully.",
//             count: reviews.length,
//             data: reviews,
//             serverTime: new Date().toISOString()
//         });

//     } catch (err) {
//         logger.error(`[REVIEW] Error fetching reviews for customer ${req.user?.id}. Error: ${err.message}`, { stack: err.stack });
//         return res.status(500).json({
//             success: false,
//             message: "Error fetching reviews list.",
//             error: err.message,
//             serverTime: new Date().toISOString()
//         });
//     }
// };

exports.getReviewByGuestHouse = async (req, res) => {
    try {
        const { id } = req.params; // guesthouseId from route

        if (!id) {
            logger.warn(`[REVIEW] Missing guesthouseId in request params`);
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
                serverTime: new Date().toISOString()
            });
        }

        // Get all reviews of guesthouse
        const reviews = await Review.find({ guesthouse: id })
            .populate("customer", "name profileImage")
            .select("rating comment createdAt") // only needed fields
            .lean()
            .sort({ rating: -1 });

        if (!reviews || reviews.length === 0) {
            logger.info(`[REVIEW] No reviews found for guesthouse ${id}`);
            return res.status(200).json({
                success: true,
                message: `No reviews found for guesthouse ${id}`,
                count: 0,
                data: [],
                serverTime: new Date().toISOString()
            });
        }

        // Average rating calculation
        const avgRating = reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length;

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
                ? `${BASE_URL}/uploads/profileImage/${r.customer.profileImage}`
                : null,
            rating: r.rating,
            date: r.createdAt ? r.createdAt.toISOString().split("T")[0] : null,
            comment: r.comment
        }));

        logger.info(`[REVIEW] Fetched ${reviews.length} reviews for guesthouse ${id}`);

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully",
            count: reviews.length,
            averageRating: parseFloat(avgRating.toFixed(1)),
            ratingDistribution,
            reviews: formattedReviews,
            serverTime: new Date().toISOString()
        });

    } catch (err) {
        logger.error(`[REVIEW] Error fetching guesthouse reviews for ${req.params.id}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error fetching guesthouse reviews.",
            error: err.message,
            serverTime: new Date().toISOString()
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
            discount: p.discount,
            minAmount: p.minAmount,
            maxDiscount: p.maxDiscount,
            startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : null,
            endDate: p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : null,
            createdAt: p.createdAt ? new Date(p.createdAt).toTimeString().split(" ")[0] : null, // only time
            isActive: p.isActive
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
        const { id } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // only date part

        const promo = await Promo.findOne({
            _id: id,
            isActive: true,
            endDate: { $gte: today }
        });

        if (!promo) {
            logger.info(`[PROMO] No active promo code found with ID: ${id}`);
            return res.status(404).json({
                success: true,
                message: "No active promo code found.",
                data: []
            });
        }

        logger.info(`[PROMO] Fetched active promo code with ID: ${id}`);

        const formattedPromo = {
            id: promo._id,
            code: promo.code,
            discount: promo.discount,
            minAmount: promo.minAmount,
            maxDiscount: promo.maxDiscount,
            startDate: promo.startDate ? new Date(promo.startDate).toISOString().split("T")[0] : null,
            endDate: promo.endDate ? new Date(promo.endDate).toISOString().split("T")[0] : null,
            createdAt: promo.createdAt ? new Date(promo.createdAt).toTimeString().split(" ")[0] : null, // only time
            isActive: promo.isActive
        };

        res.status(200).json({
            success: true,
            message: "Active promo code fetched successfully.",
            data: formattedPromo
        });

    } catch (err) {
        logger.error(`[PROMO] Error fetching promo ID: ${req.params.id}. Error: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            success: false,
            message: "Error fetching promo.",
            error: err.message
        });
    }
};

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
        const { notificationId } = req.params;
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
        const { notificationId } = req.params;
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

// -------------------------------------------- FAVOURITE ---------------------------------------
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
                id: fav._id,
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
        const guesthouseId = req.params.id; // corrected name
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
            logger.info(`[FAVORITES] Guesthouse already in favorites. User: ${userId}, GuesthouseId: ${guesthouseId}`);
            return res.status(400).json({
                success: false,
                message: "Guesthouse is already in favorites.",
            });
        }

        // Add to favorites
        const favorite = new Favorites({
            customer: userId,
            guesthouse: guesthouseId,
            isFavourite: 1
        });
        await favorite.save();

        logger.info(`[FAVORITES] Guesthouse ${guesthouseId} added to favorites by user: ${userId}`);

        return res.status(201).json({
            success: true,
            message: `Guesthouse ${guesthouseId} successfully added to favorites.`
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

exports.removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;

        if (!id) {
            logger.warn(`[FAVORITES] Remove favorite failed. Missing ID. User: ${customerId}`);
            return res.status(400).json({
                success: false,
                message: "ID is required.",
            });
        }

        const favorite = await Favorites.findOne({ customer: customerId, _id: id });

        if (!favorite) {
            logger.info(`[FAVORITES] No favorite found to remove. User: ${customerId}, FavoriteId: ${id}`);
            return res.status(404).json({
                success: false,
                message: "No favorite found.",
            });
        }

        await favorite.deleteOne({ _id: id });

        logger.info(`[FAVORITES] Favorite removed successfully. User: ${customerId}, FavoriteId: ${id}`);

        return res.status(200).json({
            success: true,
            message: "Removed from favorites successfully.",
        });

    } catch (error) {
        logger.error(`[FAVORITES] Error removing favorite for user: ${req.user.id}, FavoriteId: ${req.params.id}. Error: ${error.message}`, { stack: error.stack });
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



