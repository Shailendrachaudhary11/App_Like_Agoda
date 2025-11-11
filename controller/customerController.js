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
const BedType = require("../models/BedType")
const RoomCategory = require("../models/RoomCategory");
const logger = require('../utils/logger');
const Payment = require("../models/Payment");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const User = require("../models/user");
const { isExpired } = require('../utils/cardUtils');
const Card = require('../models/Card');
const Wallet = require("../models/Wallet");
const getRemainingTime = require("../utils/remainingTime");
const Atoll = require("../models/Atoll");
const Issue = require("../models/Issue");
const mongoose = require('mongoose');

const BASE_URL = process.env.BASE_URL;

exports.getAllGuesthouseWithAllAtolls = async (req, res) => {
    try {
        const atolls = await Atoll.find({ status: "active" }).lean();

        const results = await Promise.all(
            atolls.map(async (atoll) => {
                const guesthouseCount = await Guesthouse.countDocuments({ atolls: atoll._id });
                const image = `${BASE_URL}/uploads/atolls/${atoll.atollImage}`

                return {
                    atollId: atoll._id,
                    name: atoll.name,
                    atollImage: image,
                    noOfGuesthouse: guesthouseCount
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

exports.getPromoImage = async (req, res) => {
    try {
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const endOfToday = new Date(today.setHours(23, 59, 59, 999));

        // Active promos fetch karo
        const promos = await Promo.find({
            status: "active",
            startDate: { $lte: endOfToday },
            endDate: { $gte: startOfToday },
        })
            .sort({ createdAt: -1 })
            .select("promoImage");

        if (!promos.length) {
            return res.status(404).json({
                success: false,
                message: "No active promo available today",
            });
        }

        // Full URL ke sath array create karo
        const promoImagesUrl = promos.map(promo => `${BASE_URL}/uploads/promoImage/${promo.promoImage}`);

        res.status(200).json({
            success: true,
            message: "Successfully fetch all offers images",
            promoImages: promoImagesUrl, // full URLs
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Something went wrong while fetching offers images",
            error: err.message,
        });
    }
};


exports.getAllGuestHouses = async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                success: false,
                message: "Request body is required"
            });
        }

        let { lng, lat, distance, sort, price, atolls, islands, facilities, bedTypes } = req.body;

        lng = lng ? parseFloat(lng) : null;
        lat = lat ? parseFloat(lat) : null;
        distance = distance ? parseInt(distance) : 3000;

        if ((lng && !lat) || (!lng && lat)) {
            return res.status(400).json({
                success: false,
                message: "Both 'lng' and 'lat' are required for location-based filtering."
            });
        }

        let filter = { status: "active" };
        if (price) filter.price = { $lte: parseFloat(price) };
        if (facilities && Array.isArray(facilities) && facilities.length > 0)
            filter.facilities = { $in: facilities };
        if (atolls && typeof atolls === "string") filter.atolls = atolls;
        if (islands && Array.isArray(islands) && islands.length > 0)
            filter.islands = { $in: islands };
        if (lat && lng) {
            filter.location = {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: distance
                }
            };
        }

        let sortOption = {};
        switch (sort) {
            case "lowest": sortOption = { price: 1 }; break;
            case "highest": sortOption = { price: -1 }; break;
            case "stars": sortOption = { stars: -1 }; break;
        }

        // BedType filter logic
        let guesthouseIds = [];
        if (bedTypes && Array.isArray(bedTypes) && bedTypes.length > 0) {
            const rooms = await Room.find({ bedType: { $in: bedTypes } }).select("guesthouse");
            guesthouseIds = rooms.map(r => r.guesthouse.toString());

            if (guesthouseIds.length > 0) {
                filter._id = { $in: guesthouseIds };
            }
        }

        const guestHouses = await Guesthouse.find(filter)
            .populate("atolls", "name")
            .populate("islands", "name")
            .sort(sortOption)
            .sort({ createdAt: -1 })
            .select("-location -owner -contactNumber -description -facilities -__v -createdAt")
            .lean();

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

        const guestHousesWithUrls = await Promise.all(
            guestHouses.map(async gh => {
                gh.id = gh._id;
                delete gh._id;

                if (gh.atolls && typeof gh.atolls === "object") gh.atolls = gh.atolls.name;
                if (gh.islands && typeof gh.islands === "object") gh.islands = gh.islands.name;

                if (gh.guestHouseImage && Array.isArray(gh.guestHouseImage)) {
                    gh.guestHouseImage = gh.guestHouseImage.map(
                        img => `${BASE_URL}/uploads/guestHouseImage/${img}`
                    );
                }

                gh.cleaningFee = gh.cleaningFee ? parseFloat(gh.cleaningFee) : 0;
                gh.taxPercent = gh.taxPercent ? parseFloat(gh.taxPercent) : 0;

                try {
                    // 👇 Ye aggregation reviews ka count aur average dono nikalta hai
                    const reviewStats = await Review.aggregate([
                        { $match: { guesthouse: gh.id } },
                        {
                            $group: {
                                _id: "$guesthouse",
                                averageRating: { $avg: "$rating" },
                                totalReviews: { $sum: 1 }
                            }
                        }
                    ]);

                    if (reviewStats.length > 0) {
                        gh.stars = reviewStats[0].averageRating
                            ? reviewStats[0].averageRating.toFixed(1).toString()
                            : "0.0";
                        gh.reviews = reviewStats[0].totalReviews;
                    } else {
                        gh.stars = "0.0";
                        gh.reviews = 0;
                    }
                } catch (error) {
                    gh.stars = 0.0;
                    gh.reviews = 0;
                }

                gh.isFavourite = favoriteIds.includes(gh.id.toString()) ? 1 : 0;

                return gh;
            })
        );

        logger.info("Fetched %d guesthouses successfully.", guestHousesWithUrls.length);

        if (sort === "stars") {
            guestHousesWithUrls.sort((a, b) => parseFloat(b.stars) - parseFloat(a.stars));
        }

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

        reviewScore = parseFloat(reviewScore.toFixed(1));

        guestHouseObj.stars = reviewScore ? reviewScore.toFixed(1).toString() : "0.0";
        guestHouseObj.cleaningFee = guestHouseObj.cleaningFee ? parseFloat(guestHouseObj.cleaningFee) : 0;
        guestHouseObj.taxPercent = guestHouseObj.taxPercent ? parseFloat(guestHouseObj.taxPercent) : 0;

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

//_______________________ rooms by guesthouse______________--

exports.getAllRoomsByGuesthouseId = async (req, res) => {
    try {
        const { guesthouseId, checkIn, checkOut } = req.body;

        if (!guesthouseId || !checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: "guesthouseId, checkIn and checkOut are required."
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format."
            });
        }

        if (checkOutDate <= checkInDate) {
            return res.status(400).json({
                success: false,
                message: "checkOut must be after checkIn."
            });
        }

        // Populate category, bed type, and facilities
        const rooms = await Room.find({ guesthouse: guesthouseId, active: "active" })
            .populate("roomCategory", "name description") // includes description from DB
            .populate("bedType", "name")
            .populate("facilities", "name")
            .lean();

        if (!rooms.length) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse."
            });
        }

        // Generate date range between check-in and check-out
        const getDatesBetween = (start, end) => {
            const dates = [];
            const current = new Date(start);
            while (current <= end) {
                dates.push(new Date(current).toISOString().split("T")[0]);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const requiredDates = getDatesBetween(checkInDate, checkOutDate);

        // Filter rooms that are available for all required dates
        const availableRooms = rooms.filter(room => {
            if (!Array.isArray(room.availability)) return false;

            const availabilityMap = {};
            room.availability.forEach(slot => {
                const dateKey = new Date(slot.date).toISOString().split("T")[0];
                availabilityMap[dateKey] = slot.isAvailable;
            });

            return requiredDates.every(date => availabilityMap[date] === true);
        });

        if (!availableRooms.length) {
            return res.status(200).json({
                success: true,
                message: "No rooms available for selected dates.",
                data: []
            });
        }

        // 🧠 Group rooms by category (with DB description)
        const groupedRooms = {};

        availableRooms.forEach(room => {
            const category = room.roomCategory?.name || "Uncategorized";
            const categoryDescription = room.roomCategory?.description || "No description available.";

            if (!groupedRooms[category]) {
                groupedRooms[category] = {
                    category_id: room.roomCategory?._id || null,
                    category_name: `${category} Rooms`,
                    category_description: categoryDescription,
                    rooms: []
                };
            }

            groupedRooms[category].rooms.push({
                room_id: room._id,
                room_description: room.description || category,
                price_per_night: room.pricePerNight,
                bed: room.bedType?.name || null,
                facilities: room.facilities.map(f => f.name),
                images: (room.photos || []).map(img => `${BASE_URL}/uploads/rooms/${img.trim()}`)
            });
        });

        return res.status(200).json({
            success: true,
            message: "Available rooms fetched successfully",
            NoOfRooms: availableRooms.length,
            data: Object.values(groupedRooms)
        });

    } catch (error) {
        console.error("Error in getAllRoomsByGuesthouseId:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching available rooms.",
            error: error.message
        });
    }
};


exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId is required."
            });
        }

        // Fetch room with populated references
        const room = await Room.findById(roomId)
            .populate("guesthouse", "name address")
            .populate("roomCategory", "name")
            .populate("bedType", "name")
            .populate("facilities", "name");

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

        // Fix photo URLs
        const photos = (room.photos || []).map(img => `${BASE_URL}/uploads/rooms/${img}`);

        const formattedAvailability = (room.availability || [])
            .map(item => ({
                _id: item._id,
                date: new Date(item.date).toISOString().split("T")[0], // only date
                isAvailable: item.isAvailable
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // ✅ optional sorting by date

        // Extract populated field values
        const roomCategoryName = room.roomCategory?.name || null;
        const bedTypeName = room.bedType?.name || null;
        const facilityNames = Array.isArray(room.facilities)
            ? room.facilities.map(f => f.name)
            : [];

        // Construct final response
        const responseData = {
            _id: room._id,
            guesthouse: room.guesthouse,
            roomCategory: roomCategoryName,
            bedType: bedTypeName,
            facilities: facilityNames,
            description: room.description,
            pricePerNight: room.pricePerNight,
            pricePerWeek: room.priceWeekly,
            pricePerMonth: room.priceMonthly,
            roomAvailable: formattedAvailability,
            photos,
            active: room.active,
        };

        res.status(200).json({
            success: true,
            message: "Successfully fetched room.",
            data: responseData
        });

    } catch (error) {
        console.error(`[Room] Error fetching room ${req.body.roomId}:`, error);
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
        const {
            guesthouseId,
            roomId,
            checkIn,
            checkOut,
            guest,
            discount,
            totalPrice,
            paymentMethod
        } = req.body;

        const customerId = req.user.id;

        //  Validation
        if (
            !guesthouseId ||
            !roomId ||
            !Array.isArray(roomId) ||
            !checkIn ||
            !checkOut ||
            !guest ||
            !paymentMethod
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Missing or invalid fields: guesthouseId, roomId (array), checkIn, checkOut, guest, paymentMethod",
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkInDate < today)
            return res.status(400).json({ success: false, message: "Check-in date cannot be in the past." });

        if (checkOutDate <= checkInDate)
            return res.status(400).json({ success: false, message: "Check-out date must be after check-in date." });

        //  Fetch guesthouse and rooms
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse)
            return res.status(404).json({ success: false, message: "Guesthouse not found." });

        const rooms = await Room.find({ _id: { $in: roomId }, guesthouse: guesthouseId });
        if (rooms.length !== roomId.length)
            return res.status(404).json({ success: false, message: "One or more rooms not found for this guesthouse." });

        // Generate all dates between checkIn and checkOut (exclusive of checkout)
        const getDatesBetween = (start, end) => {
            const dates = [];
            const current = new Date(start);
            while (current <= end) { // exclude checkOut day
                const isoDate = new Date(current).toISOString().split("T")[0];
                dates.push(isoDate);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const requestedDates = getDatesBetween(checkInDate, checkOutDate);

        //  Check each room’s availability
        for (const room of rooms) {
            const unavailable = requestedDates.filter(dateStr => {
                const match = room.availability.find(a =>
                    new Date(a.date).toISOString().split("T")[0] === dateStr && a.isAvailable === false
                );
                return !!match;
            });

            if (unavailable.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Room ${room._id} is not available for the selected dates.`,
                    unavailableDates: unavailable,
                });
            }
        }

        //  Create booking document
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const baseAmount = rooms.reduce((sum, room) => sum + (room.pricePerNight * nights), 0);
        const cleaningFee = guesthouse.cleaningFee || 0;
        const taxPercent = guesthouse.taxPercent || 0;
        const taxAmount = (baseAmount * taxPercent) / 100;


        const booking = new Booking({
            customer: customerId,
            guesthouse: guesthouseId,
            room: roomId,
            guest,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            nights,
            amount: Math.round(baseAmount),
            cleaningFee: Math.round(cleaningFee),
            taxAmount: Math.round(taxAmount),
            discount: Math.round(discount),
            finalAmount: Math.round(totalPrice),
            status: paymentMethod ? "confirmed" : "pending",
            reason: paymentMethod ? "Payment completed" : "Awaiting payment"
        });

        if (paymentMethod) {
            const validPaymentMethods = ["Card", "Paypal", "UPI", "Wallet"];
            if (!validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid payment method. Allowed: ${validPaymentMethods.join(", ")}`,
                });
            }

            const payment = new Payment({
                booking: booking._id,
                amount: totalPrice,
                paymentMethod,
                paymentStatus: "paid",
            });
            await payment.save();
        }


        await booking.save();

        //  Update each room’s availability array
        for (const room of rooms) {
            const updatedAvailability = room.availability.map(a => {
                const dateStr = new Date(a.date).toISOString().split("T")[0];
                if (requestedDates.includes(dateStr)) {
                    a.isAvailable = false;
                }
                return a;
            });

            room.availability = updatedAvailability;
            await room.save({ validateBeforeSave: false });
        }

        // send notification to guesthouse
        await createNotification(
            { userId: customerId, role: "customer" },
            { userId: guesthouse._id, role: "guesthouse" },
            "New Booking Received",
            `A new booking has been made for "${guesthouse.name}" from ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}.`,
            "booking",
        );
        console.log(`[NOTIFICATION] Sent: New booking for "${guesthouse.name}" added notification to owner ${guesthouse.owner}.`);

        // send confirmation to customer
        await createNotification(
            { userId: guesthouse.id, role: "guesthouse" },   // Sender = guesthouse
            { userId: customerId, role: "customer" },           // Receiver = customer
            "Booking Confirmed",
            `Your booking is confirmed at "${guesthouse.name}" from ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}.`,
            "booking"
        );

        return res.status(201).json({
            success: true,
            message: "Booking created successfully, room availability updated.",
            data: booking,
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while creating booking",
            error: error.message,
        });
    }
};


exports.bookingSummary = async (req, res) => {
    try {
        const { guesthouseId, checkIn, checkOut, guest, roomId, promoCode } = req.body;
        const guesthouse = await Guesthouse.findById(guesthouseId).select("name address guestHouseImage taxPercent cleaningFee");

        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found." });
        }

        const rooms = await Room.find({ _id: { $in: roomId }, guesthouse: guesthouseId });

        if (rooms.length === 0) {
            return res.status(404).json({ success: false, message: "these rooms not found for this guesthouse." });
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

        for (const room of rooms) {
            const overlap = await Booking.findOne({
                room: room._id,
                status: { $in: ["confirmed"] },
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
            const promo = await Promo.findOne({ code: promoCode, status: "active" });

            if (!promo) {
                return res.status(404).json({
                    success: false,
                    message: "Promo code is invalid or inactive."
                });
            }

            const promoStart = new Date(promo.startDate);
            const promoEnd = new Date(promo.endDate);

            if (checkInDate < promoStart || checkOutDate > promoEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Promo code is not valid for selected dates."
                });
            }

            // Discount calculation
            if (promo.discountType === "flat") {
                discountAmount = promo.discountValue;
            } else if (promo.discountType === "percentage") {
                discountAmount = (baseAmount * promo.discountValue) / 100;
            }
        }


        const discountedAmount = Math.max(0, baseAmount - discountAmount);
        const taxAmount = (baseAmount * taxPercent) / 100;
        const finalAmount = Math.round(discountedAmount + taxAmount + cleaningFee);

        const response = {
            guesthouseName: guesthouse.name,
            guesthouseAddress: guesthouse.address,
            guesthouseImage: guesthouse.guestHouseImage && guesthouse.guestHouseImage.length
                ? `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0]}`
                : null,
            checkIn: checkInDate.toISOString().split("T")[0],
            checkOut: checkOutDate.toISOString().split("T")[0],
            numberOfRooms: rooms.length,
            totalNights: nights,
            numberOfPersons: guest,
            basePrice: Math.round(baseAmount),
            discount: Math.round(discountAmount),
            cleaningFee: Math.round(cleaningFee),
            taxes: Math.round(taxAmount),
            totalAmount: Math.round(finalAmount)
        };

        return res.status(200).json({
            success: true,
            message: "Booking summary calculated successfully",
            data: response
        });

    } catch (error) {

    }
}

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


exports.allBooking = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { status } = req.body || {}; // optional filter

        let query = { customer: customerId };

        if (status && status.toLowerCase() !== "all") {
            query.status = status.toLowerCase();
        }

        let bookings = await Booking.find(query)
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })


        // Auto-update confirmed bookings to 'completed' if checkOut < today
        const today = new Date();
        for (let booking of bookings) {
            if (booking.status === "confirmed" && new Date(booking.checkOut) < today) {
                booking.status = "completed";
                await booking.save();
            }
        }

        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

            // Capitalize status
            let statusFormatted = booking.status
                ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                : "Pending";

            // Payment status: if booking.status = pending, paymentStatus is pending

            let paymentStatus = "N/A";

            if (booking.status === "pending") {
                paymentStatus = "pending";
            } else if (booking.status === "cancelled") {
                paymentStatus = "refunded";
            } else {
                paymentStatus = "paid";
            }


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
                status: statusFormatted,
                paymentStatus,
                remainingTime: booking.checkIn ? getRemainingTime(booking.checkIn, booking.checkOut, booking.status) : "N/A",
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
                populate: {
                    path: "roomCategory",
                    select: "name",
                },
                select: "roomCategory price",
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
            roomType = booking.room.map(r => r.roomCategory.name || "");
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
                paymentStatus: "N/A",
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
        logger.error(`[BOOKING] Error fetching booking ${bookingId} for customer: ${req.user.id}. Error: ${error.message}`, { stack: error.stack });
        res.status(500).json({
            success: false,
            message: "Error fetching booking.",
            error: error.message
        });
    }
};


exports.downloadInvoice = async (req, res) => {
    try {
        const { bookingId } = req.body;

        // Populate guesthouse, customer, and roomCategory (to get names instead of IDs)
        const booking = await Booking.findById(bookingId)
            .populate({ path: "guesthouse", select: "name address guestHouseImage" })
            .populate({
                path: "room",
                populate: { path: "roomCategory", select: "name" },
                select: "roomCategory price"
            })
            .populate({ path: "customer", select: "name phone profileImage" });

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        //  Ensure invoice folder exists
        const invoiceDir = path.resolve(__dirname, "../public/invoices");
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        // Create invoice PDF path
        const invoicePath = path.join(invoiceDir, `invoice-${bookingId}.pdf`);
        const doc = new PDFDocument({ margin: 50 });
        const writeStream = fs.createWriteStream(invoicePath);
        doc.pipe(writeStream);

        //  Header
        doc.fontSize(22).text("Booking Invoice", { align: "center", underline: true });
        doc.moveDown(1);

        //  Guesthouse Information
        const guesthouse = booking.guesthouse || {};
        doc.fontSize(14).text("Guesthouse Information", { underline: true });
        doc.fontSize(12)
            .text(`Name: ${guesthouse.name || "N/A"}`)
            .text(`Address: ${guesthouse.address || "N/A"}`);
        doc.moveDown(0.5);

        //  Customer Information
        const customer = booking.customer || {};
        const payment = await Payment.findOne({ booking: bookingId }) || {};
        doc.fontSize(14).text("Customer Information", { underline: true });
        doc.fontSize(12)
            .text(`Name: ${customer.name || payment.customerName || "N/A"}`)
            .text(`Contact: ${customer.phone || payment.customerContact || "N/A"}`)
            .text(`Payment Method: ${payment.paymentMethod || "N/A"}`)
            .text(`Payment Status: ${payment.paymentStatus || "N/A"}`);
        doc.moveDown(0.5);

        //  Booking Details
        const checkIn = booking.checkIn ? new Date(booking.checkIn).toLocaleDateString("en-IN") : "N/A";
        const checkOut = booking.checkOut ? new Date(booking.checkOut).toLocaleDateString("en-IN") : "N/A";
        let totalNights = booking.nights;
        if (!totalNights && booking.checkIn && booking.checkOut) {
            const diff = new Date(booking.checkOut) - new Date(booking.checkIn);
            totalNights = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        let roomType = [];
        if (booking.room && Array.isArray(booking.room) && booking.room.length > 0) {
            roomType = booking.room.map(r => r.roomCategory.name || "");
        }

        doc.fontSize(14).text("Booking Details", { underline: true });
        doc.fontSize(12)
            .text(`Check-In: ${checkIn}`)
            .text(`Check-Out: ${checkOut}`)
            .text(`Total Nights: ${totalNights || 0}`)
            .text(`Room-category${roomType.length > 1 ? "(s)" : ""}: ${roomType.join(", ")}`)
            .text(`Guests: ${booking.guest || 0}`);
        doc.moveDown(0.5);

        //  Pricing Summary
        doc.fontSize(14).text("Pricing Summary", { underline: true });
        doc.fontSize(12)
            .text(`Amount: Rs.${booking.amount || 0}`)
            .text(`Discount: Rs.${booking.discount || 0}`)
            .text(`Cleaning Fee: Rs.${booking.cleaningFee || 0}`)
            .text(`Tax Amount: Rs.${booking.taxAmount || 0}`)
            .text(`Final Amount: Rs.${booking.finalAmount || 0}`);
        doc.moveDown(0.5);

        // status
        doc.fontSize(14).text("Status", { underline: true });
        doc.fontSize(12)
            .text(`Booking Status: ${booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : "N/A"}`)
            .text(`Booking Created At: ${booking.createdAt ? new Date(booking.createdAt).toLocaleDateString("en-IN") : "N/A"}`);

        // Finalize PDF
        doc.end();

        // Return public URL after PDF is written
        writeStream.on("finish", () => {
            const fileUrl = `${BASE_URL}/invoices/invoice-${bookingId}.pdf`;
            res.json({
                success: true,
                message: "Invoice generated successfully.",
                url: fileUrl
            });
        });

        writeStream.on("error", (err) => {
            console.error("PDF write error:", err);
            res.status(500).json({ success: false, message: "Error saving invoice" });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error generating invoice" });
    }
};

exports.cancelBooking = async (req, res) => {
    const { bookingId, refundType } = req.body;
    const customerId = req.user.id;

    try {
        if (!bookingId || !refundType) {
            return res.status(400).json({
                success: false,
                message: "Booking ID and refund type are required.",
            });
        }

        if (!["wallet", "bank"].includes(refundType.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid refund type. Choose 'wallet' or 'bank'.",
            });
        }

        // 🔹 Find booking by ID & customer
        const booking = await Booking.findOne({ _id: bookingId, customer: customerId });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `Booking with ID ${bookingId} not found.`,
            });
        }

        const today = new Date();
        const checkInTime = new Date(booking.checkIn);
        const checkOutTime = new Date(booking.checkOut);

        if (checkOutTime < today) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel booking. Stay period already completed.",
            });
        }

        if (!["pending", "confirmed"].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel booking. Current status is "${booking.status}".`,
            });
        }

        // 🔹 Remaining hours before check-in
        const remainingHours = (checkInTime - today) / (1000 * 60 * 60);

        //  Include checkout date (fixed)
        const getDatesBetween = (start, end) => {
            const dates = [];
            const current = new Date(start);
            while (current <= end) { //  changed < to <=
                dates.push(new Date(current).toISOString().split("T")[0]);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const bookedDates = getDatesBetween(checkInTime, checkOutTime);

        //  Function to release room availability (supports array or single)
        const releaseRoomAvailability = async (roomData) => {
            if (!roomData) return;
            const roomIds = Array.isArray(roomData) ? roomData : [roomData];

            for (const roomId of roomIds) {
                const room = await Room.findById(roomId);
                if (room && Array.isArray(room.availability)) {
                    room.availability = room.availability.map((a) => {
                        const dateStr = new Date(a.date).toISOString().split("T")[0];
                        if (bookedDates.includes(dateStr)) {
                            a.isAvailable = true; //  restore availability
                        }
                        return a;
                    });
                    await room.save({ validateBeforeSave: false });
                    console.log(`Room ${room._id} availability restored.`);
                }
            }
        };

        //  CASE 1: Cancellation within 12 hours → No refund
        if (remainingHours < 12) {
            booking.status = "cancelled";
            booking.reason = "Cancelled — No refund (less than 12 hours before check-in)";
            await booking.save();

            await releaseRoomAvailability(booking.room);

            const guesthouse = await Guesthouse.findById(booking.guesthouse);
            if (guesthouse) {
                await createNotification(
                    { userId: guesthouse._id, role: "guesthouse" },
                    { userId: customerId, role: "customer" },
                    "Booking Cancelled (No Refund)",
                    `Your booking at ${guesthouse.name} from ${booking.checkIn} to ${booking.checkOut} was cancelled less than 12 hours before check-in. No refund applicable.`
                );
            }

            return res.status(200).json({
                success: true,
                message: "Booking cancelled successfully, but no refund (less than 12 hours before check-in).",
            });
        }

        //  CASE 2: Refund applicable
        const refundAmount = booking.finalAmount || 0;

        if (refundType.toLowerCase() === "wallet") {
            let wallet = await Wallet.findOne({ user: customerId });

            if (!wallet) {
                wallet = new Wallet({
                    user: customerId,
                    balance: refundAmount,
                    transactions: [
                        { amount: refundAmount, type: "credit", transactionId: `REF-${Date.now()}` },
                    ],
                });
            } else {
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: "credit",
                    transactionId: `TRANS-${Date.now()}`,
                });
            }

            await wallet.save();
        }

        booking.status = "cancelled";
        booking.reason =
            refundType.toLowerCase() === "wallet"
                ? "Booking cancelled — refund sent to wallet."
                : "Booking cancelled — refund sent to bank.";
        await booking.save();

        const payment = await Payment.findOne({ booking: bookingId });
        if (payment && payment.paymentStatus === "paid") {
            payment.paymentStatus = "refunded";
            payment.refundDate = new Date();
            await payment.save();
        }

        //  Restore availability for all booked rooms
        await releaseRoomAvailability(booking.room);

        // Notification
        const guesthouse = await Guesthouse.findById(booking.guesthouse);
        if (guesthouse) {
            await createNotification(
                { userId: customerId, role: "customer" },
                { userId: guesthouse._id, role: "guesthouse" },
                "Booking Cancelled & Refunded",
                `Booking for "${guesthouse.name}" has been cancelled by the customer. Refund of ₹${refundAmount} sent to ${refundType}. Stay was from ${checkInTime.toDateString()} to ${checkOutTime.toDateString()}.`,
                "booking"
            );
            console.log(`[NOTIFICATION] Sent: Booking cancelled with refund for "${guesthouse.name}" to owner ${guesthouse.owner}.`);

            // to customer
            await createNotification(
                { userId: guesthouse._id, role: "guesthouse" },
                { userId: customerId, role: "customer" },
                "Booking Cancelled & Refunded",
                `Booking for "${guesthouse.name}" has been cancelled by the customer. Refund of ₹${refundAmount} sent to ${refundType}. Stay was from ${checkInTime.toDateString()} to ${checkOutTime.toDateString()}.`,
                "booking"
            );
            console.log(`[NOTIFICATION] Sent: Booking cancelled with refund for "${guesthouse.name}" to owner ${guesthouse.owner}.`);
        }
        return res.status(200).json({
            success: true,
            message: `Booking cancelled successfully. Refund sent to ${refundType}.`,
        });

    } catch (error) {
        console.error(" Error cancelling booking:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while cancelling booking.",
            error: error.message,
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
                remainingTime: booking.checkIn ? getRemainingTime(booking.checkIn, booking.checkOut, booking.status) : "N/A",
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
                remainingTime: booking.checkIn ? getRemainingTime(booking.checkIn, booking.checkOut, booking.status) : "N/A",
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
                remainingTime: booking.checkIn ? getRemainingTime(booking.checkIn, booking.checkOut, booking.status) : "N/A",
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
            error: err.message
        });
    }
};

// _______________________ PROMOS

exports.getAllPromos = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // remove time portion

        const istOffset = 5.5 * 60 * 60 * 1000; // +5:30 hours
        const todayIST = new Date(today.getTime() + istOffset);

        const promos = await Promo.find({
            status: "active",
            startDate: { $lte: todayIST }, // promo already started
            endDate: { $gte: todayIST },   // promo not yet ended
        })
            .sort({ createdAt: -1 })
            .select("-createdAt -updatedAt -__v");

        if (!promos || promos.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No active promo codes available for today.",
                count: 0,
                data: [],
            });
        }

        const formattedPromos = promos.map((p) => ({
            id: p._id,
            code: p.code,
            discountType: p.discountType,
            discountValue: p.discountValue,
            startDate: p.startDate
                ? new Date(p.startDate).toISOString().split("T")[0]
                : null,
            endDate: p.endDate
                ? new Date(p.endDate).toISOString().split("T")[0]
                : null,
            status: p.status,
        }));

        return res.status(200).json({
            success: true,
            message: "Active promo codes for today fetched successfully.",
            count: formattedPromos.length,
            data: formattedPromos,
        });
    } catch (err) {
        console.error(`[PROMO] Error fetching promos: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: "Error fetching promos.",
            error: err.message,
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
            status: "active",
        }).select("-createdAt -updatedAt -__v")

        if (!promo) {
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

//__________________ Notification _________________________

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

        await User.findByIdAndUpdate(req.user.id, {
            lastNotificationCheck: new Date()
        });

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


exports.deleteAllNotifications = async (req, res) => {
    try {
        const customerId = req.user.id;

        const result = await Notification.deleteMany({
            "receiver.userId": customerId,
            "receiver.role": "customer"
        });

        return res.status(200).json({
            success: true,
            message: "All notifications deleted successfully.",
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error("Error deleting notifications:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

exports.countNewNotifications = async (req, res) => {
    try {
        const customerId = req.user.id;
        const customer = await User.findById(customerId);
        const lastCheck = customer.lastNotificationCheck || new Date(0); // agar null ho toh purani date

        const newCount = await Notification.countDocuments({
            "receiver.userId": customerId,
            "receiver.role": "customer",
            createdAt: { $gt: lastCheck }
        });

        return res.status(200).json({
            success: true,
            message: "New notification count fetched.",
            newCount
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching new notification count.",
            error: error.message
        });
    }
}

//_______________________________ favorites _____________________

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

//______________________________ for filters ________________________


exports.getAllAtolls = async (req, res) => {
    try {
        const atolls = await Atolls.find(
            { status: "active" },
            { _id: 1, name: 1, createdAt: 1 }
        )
            .sort({ createdAt: -1 }) // descending order (newest first)
            .lean();


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
        const facilities = await Facility.find(
            { status: "active" },
            { _id: 1, name: 1, status: 1 }
        )
            .sort({ createdAt: -1 })
            .lean();

        const modifiedAtolls = facilities.map(facilitie => ({
            id: facilitie._id,
            name: facilitie.name,
            status: facilitie.status
        }));

        res.status(200).json({
            success: true,
            count: modifiedAtolls.length,
            message: "Successfully fetch all facilities",
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

        const islands = await Island.find({ status: "active", atoll: id }).select("-__v -createdAt -updatedAt"); // extra fields hata sakte ho

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

exports.getAllBedTypes = async (req, res) => {
    try {
        const bedTypes = await BedType.find().select("name").lean();

        res.status(200).json({
            success: true,
            count: bedTypes.length,
            message: "Successfully fetched all bedTypes",
            data: bedTypes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching atolls",
            error: error.message
        });
    }
}

//________________________________ card _________________________________

exports.addCard = async (req, res) => {
    try {
        const customerId = req.user.id;
        const customer = await User.findById(customerId);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const { cardNumber, expiry, cvv, fullName } = req.body;

        // Required fields check
        if (!cardNumber || !expiry || !cvv || !fullName) {
            return res.status(400).json({
                success: false,
                message: "cardNumber, expiry, cvv and fullName are required"
            });
        }

        // Clean card number
        const cleanedNumber = cardNumber.replace(/\D/g, '');

        // Duplicate card check (after cleanedNumber is defined)
        const existingCard = await Card.findOne({
            user: customerId,
            cardNumber: cleanedNumber
        });

        if (existingCard) {
            return res.status(400).json({
                success: false,
                message: "This card is already added."
            });
        }

        // Card validation
        if (cleanedNumber.length !== 16) {
            return res.status(400).json({ success: false, message: "Invalid Card number" });
        }

        if (isExpired(expiry)) {
            return res.status(400).json({ success: false, message: "Card is expired" });
        }

        const cvvStr = cvv.toString().trim();
        if (!/^\d{3,4}$/.test(cvvStr)) {
            return res.status(400).json({ success: false, message: "Invalid CVV" });
        }

        const formattedFullName = fullName
            .trim()
            .split(/\s+/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');

        // Create & save card
        const newCard = new Card({
            user: customerId,
            cardNumber: cleanedNumber,
            expiry,
            fullName: formattedFullName,
            cvv: cvvStr // remove in production
        });

        await newCard.save();

        return res.status(201).json({
            success: true,
            message: "Card added successfully",
            data: {
                id: newCard._id,
                last4: cleanedNumber.slice(-4),
                expiry: newCard.expiry,
                fullName: newCard.fullName
            }
        });

    } catch (error) {
        logger.error(`Error adding card for user ${req.user.id}: ${error}`);
        return res.status(500).json({
            success: false,
            message: "Error adding card details",
            error: error.message
        });
    }
};

exports.getAllCards = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch all cards of the user, newest first
        const cards = await Card.find({ user: userId }).sort({ createdAt: -1 });

        if (!cards || cards.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const formatCardNumber = (num) => {
            const cleaned = (num + '').replace(/\D/g, '');
            return cleaned.match(/.{1,4}/g)?.join(' ') ?? cleaned;
        }

        // Map to safe response
        const safeCards = cards.map(card => {
            return {
                id: card._id,
                fullName: card.fullName,
                cardNumber: formatCardNumber(card.cardNumber),
                expiry: card.expiry,

            };
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetch all cards",
            data: safeCards
        });

    } catch (error) {
        console.error(`[CARD] Error fetching cards for user ${req.user?.id}:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch cards',
            error: error.message
        });
    }
};

//___________________________________ WALLET _____________________________________
exports.addWallet = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { amount } = req.body;

        //  Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        //  Find wallet
        let wallet = await Wallet.findOne({ user: customerId });

        //  Create transaction
        const transaction = {
            amount,
            type: 'credit',
            transactionId: `TRANS${Date.now()}`,
            date: new Date()
        };

        //  Create or update wallet
        if (!wallet) {
            wallet = new Wallet({
                user: customerId,
                balance: amount,
                transactions: [transaction]
            });
        } else {
            wallet.balance += amount;
            wallet.transactions.push(transaction);
            wallet.updatedAt = new Date();
        }

        await wallet.save();

        //  Response
        return res.status(200).json({
            success: true,
            message: 'Amount added successfully',
            data: {
                balance: wallet.balance,
                transaction
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error while adding amount to wallet",
            error: error.message
        });
    }
};


exports.getWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user.id });

        if (!wallet) {
            return res.status(200).json({
                success: true,
                message: 'Wallet not found, returning default values',
                data: {
                    balance: 0,
                    transactions: []
                }
            });
        }

        // Ensure sorting works even if date is string
        const sortedTransactions = [...wallet.transactions].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        return res.status(200).json({
            success: true,
            message: 'Wallet fetched successfully',
            data: {
                balance: wallet.balance,
                transactions: sortedTransactions
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching wallet',
            error: err.message
        });
    }
};

//_____________________________ Report and Issue

exports.report = async (req, res) => {
    try {
        const customerId = req.user.id;

        const { issueType, description, guesthouse } = req.body;

        if (!issueType || !description || !guesthouse) {
            return res.status(400).json({
                success: false,
                message: "All fields (issueType, description, name, email, phone, guesthouse) are required",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(guesthouse)) {
            return res.status(400).json({
                success: false,
                message: "Invalid guesthouse ID",
            });
        }

        const guesthousefound = await Guesthouse.findById(guesthouse);

        if (!guesthousefound) {
            return res.status(404).json({
                success: false,
                message: "guesthouse not found"
            })
        }

        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        const ticketId = `T-${randomNumber}`;

        const newIssue = new Issue({
            issueType,
            ticketId,
            description,
            guesthouse,
            customer: customerId,
            issueImage: req.file ? req.file.filename : null,
        });


        await newIssue.save();

        return res.status(201).json({
            success: true,
            message: "Issue reported successfully",
            data: newIssue,
        });
    } catch (error) {
        console.error("[Issue] report error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while reporting issue",
            error: error.message,
        });
    }
};





