const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const { checkout } = require("../routes/userRoutes");
const Booking = require("../models/Booking")
const sendEmail = require("../utils/sendEmail");
const Review = require("../models/review")
const Notification = require("../models/notification")
const Promo = require("../models/Promo")
const Favorites = require("../models/Favorite")



exports.getAllGuestHouses = async (req, res) => {
    try {
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;


        const guesthouses = await Guesthouse.find({ status: "active" });

        if (guesthouses.length === 0) {
            return res.status(200).json({
                success: true,
                NoOfGuestHouse: 0,
                message: "No active guestHouse found.",
                data: []
            })
        }

        // सिर्फ images को update करना
        guesthouses.forEach(gh => {
            if (gh.guestHouseImage && gh.guestHouseImage.length > 0) {
                gh.guestHouseImage = gh.guestHouseImage.map(img => `${BASE_URL}/uploads/guesthouseImage/${img}`);
            } else {
                gh.guestHouseImage = [];
            }
        });

        res.status(200).json({
            success: true,
            NoOfGuestHouse: guesthouses.length,
            message: "Successfully fetched all guesthouses.",
            data: guesthouses
        });

    } catch (error) {
        console.error("Error fetching guesthouses:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching all guesthouses.",
            error: error.message
        });
    }
};

exports.getGuestHouseById = async (req, res) => {
    try {
        let { lng, lat, distance } = req.query;

        // Convert to numbers
        lng = parseFloat(lng);
        lat = parseFloat(lat);
        distance = Number(distance);

        // Validate inputs
        if (isNaN(lng) || isNaN(lat) || isNaN(distance)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid or missing query parameters. Please provide valid lng, lat, and distance."
            });
        }

        // Find guesthouses near the provided location
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
                success: true,
                statusCode: 404,
                NoOfGuestHouse: 0,
                message: "No guesthouses found nearby.",
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            NoOfGuestHouse: guestHouses.length,
            message: "Guesthouses fetched successfully.",
            data: guestHouses
        });

    } catch (err) {
        console.error("[ERROR][Nearby Guesthouses]:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error while searching guesthouses.",
            error: err.message
        });
    }
};

exports.searchGuestHouseNearBy = async (req, res) => {
    try {
        const { lng, lat, distance } = req.query;

        // Validate query parameters
        if (isNaN(lng) || isNaN(lat) || isNaN(distance)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid or missing query parameters. Please provide valid lng, lat, and distance."
            });
        }

        // Find guesthouses near the provided location
        const guestHouses = await Guesthouse.find({
            status: "active",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(distance)
                }
            }
        });

        if (guestHouses === 0) {
            return res.status(404).json({
                success: true,
                NoOfGuestHouse: guestHouses.length,
                message: "NO guesthouses found near by you.",
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            NoOfGuestHouse: guestHouses.length,
            message: "Successfully fetch guesthouses near by you.",
            data: guestHouses
        });
    } catch (err) {
        console.error("Error searching nearby rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error while searching guesthouses.",
            error: err.message
        });
    }
};


exports.getRoomById = async (req, res) => {
    try {
        const { id } = req.params;


        const room = await Room.findById(id).populate("guesthouse", "name address");

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

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
        const { city, startDate, endDate, guests } = req.query;

        let filter = {};

        if (guests) {
            filter.capacity = { $gte: Number(guests) };
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            filter.availability = {
                $elemMatch: {
                    startDate: { $lte: start },
                    endDate: { $gte: end },
                    isAvailable: true
                }
            };
        }

        if (city) {
            const guesthouses = await Guesthouse.find({
                city: { $regex: city, $options: 'i' }
            }).select('_id');

            filter.guesthouse = { $in: guesthouses.map(g => g._id) };
        }

        const BASE_URL = process.env.BASE_URL || `http://192.168.1.33:${process.env.PORT || 5000}`;

        // Populate guesthouse and get plain objects
        let rooms = await Room.find(filter)
            .populate('guesthouse', 'name city address') // select fields you want
            .lean();

        // Update photos with full URLs
        rooms = rooms.map(room => {
            const photos = (room.photos || []).map(photo => `${BASE_URL}/uploads/rooms/${photo}`);
            return { ...room, photos };
        });

        res.status(200).json({
            success: true,
            GuestHouseName: rooms[0]?.guesthouse?.name || "",
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
                success: true,
                message: "No room found in given guesthouse."
            })
        }

        //  User info from JWT
        const user = req.user; // middleware se aata h
        const customerId = user.id;

        const alreadyReview = await Review.findOne({ guesthouse: guestHouseId, room: roomId, customer: user.id })
        if (alreadyReview) {
            return res.status(404).json({
                success: false,
                message: "You already add rating."
            });
        }
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

        return res.status(201).json({
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

exports.getAllNotification = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch notifications, latest first
        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .lean();

        if (!notifications || notifications.length === 0) {
            return res.status(200).json({
                success: true,
                statusCode: 200,
                message: "No notifications found.",
                count: 0,
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Notifications fetched successfully.",
            count: notifications.length,
            data: notifications
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

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "No Notification found."
            });
        }

        //  Mark as read
        notification.isRead = true;
        await notification.save();

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: notification
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

exports.getfavorites = async (req, res) => {
    try {
        const customerId = req.user.id;
        const favorites = await Favorites.find({ customer: customerId }).populate("guesthouse", "name");;
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
        const guesthouseId = req.params.id; // get from URL params
        const userId = req.user.id;

        if (!guesthouseId) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
            });
        }

        // Optional: check if guesthouse exists
        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found.",
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
            message: "Guesthouse added to favorites successfully.",
            data: favorite,
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
        const guesthouseId = req.params.id;   // Guesthouse ID from URL
        const customerId = req.user.id;       // Logged-in customer

        if (!guesthouseId) {
            return res.status(400).json({
                success: false,
                message: "Guesthouse ID is required.",
            });
        }

        // Check if this favorite exists
        const favorite = await Favorites.findOne({ customer: customerId, guesthouse: guesthouseId });
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse is not in your favorites.",
            });
        }

        // Remove it
        await Favorites.deleteOne({ _id: favorite._id });

        return res.status(200).json({
            success: true,
            message: "Guesthouse removed from favorites successfully.",
        });

    } catch (error) {
        console.error("Error removing guesthouse from favorites:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove guesthouse from favorites.",
            error: error.message,
        });
    }
};





















// //  Get details of a specific room
// exports.getRoomDetails = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const room = await Room.findById(id).populate("guesthouse", "name location");

//         if (!room) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Room not found"
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Room details fetched successfully",
//             data: room
//         });
//     } catch (err) {
//         console.error("Error getting room details:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: err.message
//         });
//     }
// };

// //  Search guesthouses by city or name
// exports.searchGuestHouses = async (req, res) => {
//     try {
//         const { name, address, city, state } = req.query;

//         let filter = { status: "approved" };

//         if (name) filter.name = new RegExp(name, "i"); // Case-insensitive search
//         if (address) filter.address = new RegExp(address, "i");
//         if (city) filter.city = new RegExp(city, "i"); // Case-insensitive search
//         if (state) filter.state = new RegExp(state, "i");

//         const guestHouses = await Guesthouse.find(filter);

//         return res.status(200).json({
//             success: true,
//             totalGuestHouses: guestHouses.length,
//             message: "Guest Houses fetched successfully",
//             data: guestHouses
//         });
//     } catch (err) {
//         console.error("Error searching rooms:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: err.message
//         });
//     }
// };

// // search room by city, minPrice, maxPrice, cap, inDate, outDate
// exports.searchRooms = async (req, res) => {
//     try {
//         const { city, minPrice, maxPrice, amenities, capacity, checkIn, checkOut } = req.query;

//         // Guesthouse filter (only approved)
//         let guesthouseFilter = { status: "approved" };
//         if (city) {
//             guesthouseFilter.city = { $regex: new RegExp(city, "i") };
//         }

//         const guesthouses = await Guesthouse.find(guesthouseFilter);
//         if (guesthouses.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: "No guesthouses found for given filters.",
//                 NoOfRooms: 0,
//                 data: []
//             });
//         }

//         // Room filter
//         let roomFilter = {
//             guesthouse: { $in: guesthouses.map(g => g._id) },
//             pricePerNight: { $gte: Number(minPrice) || 0, $lte: Number(maxPrice) || 100000 }
//         };

//         if (capacity) roomFilter.capacity = { $gte: Number(capacity) };

//         if (amenities) {
//             roomFilter.amenities = { $all: amenities.split(",") };
//         }

//         // Availability filter
//         if (checkIn) {
//             const checkInDate = new Date(checkIn);
//             const checkOutDate = checkOut ? new Date(checkOut) : new Date(checkIn);

//             roomFilter.availability = {
//                 $not: {
//                     $elemMatch: {
//                         startDate: { $lte: checkOutDate },
//                         endDate: { $gte: checkInDate },
//                         isAvailable: false
//                     }
//                 }
//             };
//         }

//         const rooms = await Room.find(roomFilter).populate("guesthouse");

//         return res.status(200).json({
//             success: true,
//             message: "Rooms fetched successfully.",
//             NoOfRooms: rooms.length,
//             data: rooms
//         });

//     } catch (err) {
//         console.error("Error in searchRooms:", err);
//         return res.status(500).json({
//             success: false,
//             error: "Search failed"
//         });
//     }
// };


// // POST book room
// exports.bookroom = async (req, res) => {
//     try {
//         const { roomId, checkIn, checkOut, promoCode } = req.body;

//         if (!roomId || !checkIn || !checkOut) {
//             return res.status(400).json({ success: false, message: "Invalid credentials" });
//         }

//         const user = req.user;
//         const room = await Room.findById(roomId);
//         if (!room) {
//             return res.status(404).json({ success: false, message: "Room not found" });
//         }

//         // Check overlapping confirmed bookings
//         const overlappingBooking = await Booking.findOne({
//             room: roomId,
//             status: "confirmed",
//             $or: [
//                 { checkIn: { $lt: new Date(checkOut), $gte: new Date(checkIn) } },
//                 { checkOut: { $lte: new Date(checkOut), $gt: new Date(checkIn) } },
//                 { checkIn: { $lte: new Date(checkIn) }, checkOut: { $gte: new Date(checkOut) } }
//             ]
//         });

//         if (overlappingBooking) {
//             return res.status(400).json({ success: false, message: "Room is already booked for these dates." });
//         }

//         const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
//         const amount = nights * room.pricePerNight;

//         const booking = await Booking.create({
//             customer: user.id,
//             guesthouse: room.guesthouse._id,
//             room: roomId,
//             checkIn,
//             checkOut,
//             nights,
//             amount,
//             status: "pending"
//         });

//         // ✅ Email को अलग try/catch में रखो
//         try {
//             await sendEmail(
//                 user.email,
//                 "Payment Pending",
//                 `Your amount is ${booking.amount}. Please complete your payment to confirm your booking.`
//             );
//         } catch (emailErr) {
//             console.error("Email sending failed:", emailErr.message);
//         }

//         // ✅ Response हमेशा success होना चाहिए
//         return res.status(201).json({
//             success: true,
//             message: "Booking created! Please complete payment to confirm your booking.",
//             booking
//         });

//     } catch (error) {
//         console.error("Booking error:", error);
//         return res.status(500).json({ success: false, message: "Error booking room" });
//     }
// };


// // payment done makePayment
// exports.makePayment = async (req, res) => {
//     try {
//         const { bookingId } = req.params;

//         // Booking + populate customer, guesthouse, room
//         const booking = await Booking.findById(bookingId)
//             .populate("customer", "name email")
//             .populate("guesthouse", "name location")
//             .populate("room", "roomNumber roomType");

//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No Booking found."
//             });
//         }

//         if (booking.status === "confirmed") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Your payment is already done."
//             });
//         }

//         //  Update status
//         booking.status = "confirmed";
//         await booking.save();

//         //  Update room availability
//         await Room.findByIdAndUpdate(booking.room._id, {
//             $push: {
//                 availability: {
//                     startDate: new Date(booking.checkIn),
//                     endDate: new Date(booking.checkOut),
//                     isAvailable: false
//                 }
//             }
//         });

//         //  Email content
//         const emailContent = `
// Hello ${booking.customer.name},

// ✅ Your booking is confirmed!

// 🏨 Guesthouse: ${booking.guesthouse.name}, ${booking.guesthouse.location}
// 🛏️ Room: ${booking.room.roomType || booking.room.roomNumber}
// 📅 Check-in: ${new Date(booking.checkIn).toDateString()}
// 📅 Check-out: ${new Date(booking.checkOut).toDateString()}
// 💰 Amount Paid: ₹${booking.amount}
// 📌 Status: ${booking.status}

// Thank you for booking with us!
//         `;

//         //  Send email
//         try {
//             await sendEmail(booking.customer.email, "Booking Confirmation", emailContent);
//             console.log("📧 Email sent to:", booking.customer.email);
//         } catch (mailErr) {
//             console.error("❌ Email sending failed:", mailErr.message);
//         }

//         return res.status(200).json({
//             success: true,
//             amount: booking.amount,
//             message: "Your payment is done and booking is confirmed."
//         });

//     } catch (err) {
//         console.error("Payment error:", err.message);
//         res.status(500).json({
//             success: false,
//             message: "Error processing payment."
//         });
//     }
// };

// // get Booking BY <ID>
// exports.getBookingById = async (req, res) => {
//     try {
//         const { bookingId } = req.params; // 👈 yahan destructure karo
//         const booking = await Booking.findById(bookingId);

//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Booking not found."
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Your booking details:",
//             booking
//         });
//     } catch (err) {
//         console.error("Error fetching booking:", err.message);
//         res.status(500).json({
//             success: false,
//             message: "Error fetching booking details."
//         });
//     }
// };

// // getAllBooking
// exports.getAllBooking = async (req, res) => {
//     try {
//         const user = req.user;
//         const customerId = user.id;
//         const booking = await Booking.find({ customer: customerId }).populate({ path: "guesthouse", select: "name location" });

//         res.status(200).json({
//             success: true,
//             NoOfBookings: booking.length,
//             message: "Your Bookings: ",
//             bookings: booking
//         })
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Error to get booking."
//         });
//     }
// }


// exports.addReviewRating = async (req, res) => {
//     try {
//         const { guestHouseId, bookingId, roomNoId, rating, comment } = req.body;

//         //  Guesthouse check
//         const guestHouse = await Guesthouse.findById(guestHouseId);
//         if (!guestHouse) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No GuestHouse found."
//             });
//         }

//         //  User info from JWT
//         const user = req.user; // middleware se aata h
//         const customerId = user.id;

//         const alreadyReview = await Review.findOne({guesthouse:guestHouseId, room:roomNoId, booking:bookingId, customer:user.id})
//         if(alreadyReview){
//             return res.status(404).json({
//                 success: false,
//                 message: "You already add rating."
//             });
//         }
//         // Review object create
//         const review = new Review({
//             guesthouse: guestHouseId,
//             room: roomNoId,
//             customer: customerId,
//             booking: bookingId,
//             rating,
//             comment
//         });

//         //  Save review
//         await review.save();

//         return res.status(201).json({
//             success: true,
//             message: "Review added successfully",
//             review
//         });

//     } catch (err) {
//         console.error("Add Review Error:", err);
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: err.message
//         });
//     }
// };

// // Get all reviews by Guesthouse ID
// exports.getAllReviews = async (req, res) => {
//     try {
//         const { id } = req.params; // guesthouseId from route

//         const reviews = await Review.find({ guesthouse: id })
//             .sort({ createdAt: -1 }); // latest first

//         return res.status(200).json({
//             success: true,
//             count: reviews.length,
//             data: reviews
//         });
//     } catch (err) {
//         console.error("Get All Reviews Error:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Error fetching reviews list.",
//             error: err.message
//         });
//     }
// };
