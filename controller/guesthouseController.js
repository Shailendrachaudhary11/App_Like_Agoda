const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const fs = require("fs");
const path = require("path");
const Booking = require("../models/Booking")
const Review = require("../models/review")
const Notification = require("../models/notification");
const { createNotification } = require("../utils/notificationHelper");


exports.manageGuestHouse = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { name, address, city, state, location, contactNumber, description } = req.body;

    console.log(`[GUESTHOUSE] Managing guesthouse by user ${ownerId}`);

    // Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least 1 image is required",
      });
    }

    // Save only filenames
    const images = req.files.map((file) => file.filename);

    // BASE_URL for frontend
    const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imagesWithUrl = images.map((name) => `${BASE_URL}/uploads/guestHouseImage/${name}`);

    // Check if guesthouse already exists for this owner
    let guesthouse = await Guesthouse.findOne({ owner: ownerId });

    if (guesthouse) {
      // Update existing guesthouse
      guesthouse.name = name || guesthouse.name;
      guesthouse.address = address || guesthouse.address;
      guesthouse.city = city || guesthouse.city;
      guesthouse.state = state || guesthouse.state;
      guesthouse.location = location || guesthouse.location;
      guesthouse.contactNumber = contactNumber || guesthouse.contactNumber;
      guesthouse.description = description || guesthouse.description;
      
      // Merge old images with new uploads
      guesthouse.guestHouseImage = images.length > 0 ? images : guesthouse.guestHouseImage;

      await guesthouse.save();

      return res.status(200).json({
        success: true,
        message: "Guesthouse updated successfully.",
        data: {
          guesthouseId: guesthouse._id,
          status: guesthouse.status,
          guestHouseImage: imagesWithUrl, // frontend friendly URLs
        },
      });
    } else {
      // Check for duplicate name
      const duplicate = await Guesthouse.findOne({ name });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Guesthouse name must be unique",
        });
      }

      // Create new guesthouse
      guesthouse = new Guesthouse({
        owner: ownerId,
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
        message: "Guesthouse submitted successfully.",
        data: {
          guesthouseId: guesthouse._id,
          status: guesthouse.status,
          images: imagesWithUrl, // frontend friendly URLs
        },
      });
    }
  } catch (err) {
    console.error("[GUESTHOUSE] Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while managing guesthouse",
      error: err.message,
    });
  }
};

exports.getMyGuesthouse = async (req, res) => {
    try {
        const guesthouses = await Guesthouse.find({
            owner: req.user._id,
            status: "active"
        });

        if (!guesthouses.length) {
            return res.status(200).json({
                success: true,
                message: "No approved guesthouses found",
                data: [],
            });
        }

        const baseUrl = process.env.BASE_URL || `http://localhost:5000`;

        const data = guesthouses.map(gh => ({
            ...gh.toObject(),
            guestHouseImage: gh.guestHouseImage.map(img => `${baseUrl}/${img}`)
        }));

        return res.status(200).json({
            success: true,
            message: "Guesthouses fetched successfully",
            data
        });

    } catch (err) {
        console.error("Error fetching guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};


exports.addRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const {
            roomNumber,
            title,
            description,
            amenities,
            pricePerNight,
            priceWeekly,
            priceMonthly,
            capacity,
            availability,
        } = req.body;

        // Validate required fields
        if (
            !roomNumber ||
            !title ||
            !description ||
            !amenities ||
            !pricePerNight ||
            !priceWeekly ||
            !priceMonthly ||
            !capacity
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields.",
            });
        }

        // Check guesthouse ownership & approval
        const guesthouse = await Guesthouse.findOne({ owner: ownerId });

        if (!guesthouse) {
            return res.status(403).json({
                success: false,
                message:
                    "Guesthouse not found, not approved, or you are not authorized to add rooms.",
            });
        }

        const guesthouseId = guesthouse._id;

        // Check duplicate room number
        const existingRoom = await Room.findOne({ guesthouse: guesthouseId, roomNumber });
        if (existingRoom) {
            return res.status(400).json({
                success: false,
                message: `Room number ${roomNumber} already exists in this guesthouse.`,
            });
        }

        // Save only filenames in DB
        const photos = req.files ? req.files.map((f) => f.filename) : [];

        // Create new room
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
            photos,
        });

        await newRoom.save();

        // Generate full URLs for frontend
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        const photosWithUrl = photos.map((name) => `${BASE_URL}/uploads/rooms/${name}`);

        return res.status(201).json({
            success: true,
            message: "Room added successfully.",
            data: {
                ...newRoom.toObject(),
                photos: photosWithUrl, // frontend friendly
            },
        });
    } catch (err) {
        console.error("[ROOM] Add error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while adding room.",
            error: err.message,
        });
    }
};

exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "No Room found",
            });
        }

        return res.status(200).json({
            success: true,
            data: room,
        });
    } catch (err) {
        console.error("[ROOM] Get by ID error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching room.",
            error: err.message,
        });
    }
};

exports.getAllRooms = async (req, res) => {
    try {
        const userId = req.user.id;
        const guesthouse = await Guesthouse.findOne({ owner: userId });

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No Guesthouse details found",
            });
        }

        const rooms = await Room.find({ guesthouse: guesthouse._id }).sort({ createdAt: -1 }); // latest first;

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse",
            });
        }

        return res.status(200).json({
            success: true,
            GuestHouseName: guesthouse.name,
            NoOfRooms: rooms.length,
            message: "Rooms fetched successfully",
            data: rooms,
        });
    } catch (err) {
        console.error("[ROOM] Fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching rooms",
            error: err.message,
        });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const ownerId = req.user._id;

        const guesthouse = await Guesthouse.findOne({ owner: ownerId });
        if (!guesthouse) {
            return res.status(403).json({ success: false, message: "No guesthouse found." });
        }

        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouse._id });
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found." });
        }

        // अगर नई photos upload हुईं
        if (req.files && req.files.length > 0) {
            // पुरानी delete करो
            room.photos.forEach(img => {
                const oldPath = path.join(__dirname, "..", "uploads", "rooms", img);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            });

            // DB में सिर्फ filename save
            room.photos = req.files.map(f => f.filename);
        }

        // बाकी fields update
        Object.assign(room, req.body);

        await room.save();

        // अब response में full URL भेजो
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        const photos = room.photos.map(name => `${BASE_URL}/uploads/rooms/${name}`);

        return res.status(200).json({
            success: true,
            message: "Room updated successfully",
            data: { ...room.toObject(), photos }
        });
    } catch (err) {
        console.error("Update Room Error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { roomId } = req.params;

        const guesthouse = await Guesthouse.findOne({ owner: ownerId });
        if (!guesthouse) return res.status(403).json({ success: false, message: "No guest house found" });

        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouse._id });
        if (!room) return res.status(404).json({ success: false, message: "Room not found in this guesthouse" });

        await Room.findByIdAndDelete(roomId);

        return res.status(200).json({
            success: true,
            message: `Room ${room.roomNumber} deleted successfully from guesthouse ${guesthouse.name}`
        });
    } catch (err) {
        console.error("[ROOM] Delete error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

exports.getAllBookings = async (req, res) => {
    try {
        const user = req.user;
        const guesthouse = Guesthouse.findOne({ owner: user.id });
        const bookings = await Booking.find({ guesthouse: guesthouse._id }).sort({ createdAt: -1 }); // latest first;
        res.status(200).json({
            success: true,
            message: "Your all booking here.",
            data: bookings
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching all bookings"
        })
    }
}

exports.getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "No booking found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched your booking.",
            data: booking,
        });
    } catch (error) {
        console.error("[BOOKING] Get by ID error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching booking details.",
            error: error.message,
        });
    }
};

exports.acceptBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Please provide bookingId.",
            });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "No booking found.",
            });
        }

        booking.status = "confirmed";
        await booking.save();

        // create Notification
        await createNotification(
            booking.customer._id,
            "booking",
            `Your booking ID ${booking._id} has been confirmed.`,
            { bookingId: booking._id, status: "confirmed" }
        );

        return res.status(200).json({
            success: true,
            message: "Successfully confirmed booking.",
            bookingId: booking._id,
        });
    } catch (error) {
        console.error("[BOOKING] Accept error:", error);
        return res.status(500).json({
            success: false,
            message: "Error accepting booking.",
            error: error.message,
        });
    }
};

exports.rejectBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const reason = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Please provide bookingId.",
            });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "No booking found.",
            });
        }

        if (!reason) {
            return res.status(404).json({
                success: false,
                message: "plz provide valid reason for rejecting."
            })
        }


        booking.status = "rejected";
        await booking.save();

        //  Trigger Notification to Customer
        await createNotification(
            booking.customer._id,
            "booking",
            `Your booking ID ${booking._id} was rejected. Reason: ${reason}`,
            { bookingId: booking._id, status: "rejected", reason }
        );

        return res.status(200).json({
            success: true,
            message: "Successfully rejected booking.",
            bookingId: booking._id,
            reason: reason
        });
    } catch (error) {
        console.error("[BOOKING] rejecting error:", error);
        return res.status(500).json({
            success: false,
            message: "Error rejecting booking.",
            error: error.message,
        });
    }
};

exports.getUpcomingBookings = async (req, res) => {
    try {
        const userId = req.user.id; // assuming JWT middleware sets req.user

        const today = new Date();

        const upcomingBookings = await Booking.find({
            customer: userId,
            checkIn: { $gte: today }, // check-in date is today or in the future
            status: { $in: ["pending", "confirmed"] }
        })
            .populate("guesthouse", "name location")
            .populate("room", "roomNumber title pricePerNight")
            .sort({ checkIn: 1 });

        if (upcomingBookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No upcoming bookings found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Upcoming bookings fetched successfully.",
            count: upcomingBookings.length,
            data: upcomingBookings,
        });
    } catch (error) {
        console.error("[BOOKING] Upcoming error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching upcoming bookings.",
            error: error.message,
        });
    }
};

exports.getPastBookings = async (req, res) => {
    try {
        const userId = req.user.id;

        const today = new Date();

        const pastBookings = await Booking.find({
            customer: userId,
            checkOut: { $lt: today }, // booking already ended
            status: { $in: ["confirmed", "cancelled", "refunded", "rejected"] }
        })
            .populate("guesthouse", "name location")
            .populate("room", "roomNumber title pricePerNight")
            .sort({ checkOut: -1 });

        if (pastBookings.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No past bookings found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Past bookings fetched successfully.",
            count: pastBookings.length,
            data: pastBookings,
        });
    } catch (error) {
        console.error("[BOOKING] Past error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching past bookings.",
            error: error.message,
        });
    }
};

exports.getAllReviews = async (req, res) => {
    try {
        const userId = req.user._id; // assuming JWT middleware sets req.user
        const guestHouse = await Guesthouse.findOne({ owner: userId });

        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found for this user.",
            });
        }

        const reviews = await Review.find({ guesthouse: guestHouse._id })
            .populate("customer", "name email") // optional: show customer info
            .sort({ createdAt: -1 }); // latest first

        if (reviews.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No reviews found for your guesthouse.",
                data: [],
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully.",
            count: reviews.length,
            data: reviews,
        });
    } catch (err) {
        console.error("[REVIEWS] Fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching reviews.",
            error: err.message,
        });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const userId = req.user._id;
        const { reviewId } = req.params;

        // Check guesthouse
        const guestHouse = await Guesthouse.findOne({ owner: userId });
        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found for this user.",
            });
        }

        // Find review for this guesthouse
        const review = await Review.findOne({ _id: reviewId, guesthouse: guestHouse._id })
            .populate("customer", "name email");

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "No review found for your guesthouse.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Review fetched successfully.",
            data: review,
        });
    } catch (err) {
        console.error("[REVIEW] Fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching review.",
            error: err.message,
        });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: notifications
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to fetching notifications.",
            error: error.message
        })
    }
}

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


