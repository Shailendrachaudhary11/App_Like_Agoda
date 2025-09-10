const dotenv = require("dotenv");
const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const { checkout } = require("../routes/userRoutes");
const Booking = require("../models/Booking")
const { sendEmail } = require("../utils/sendEmail");
const User = require("../models/user")
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// ----------------- get own profile ---------------
exports.getMyProfile = async (req, res) => {
    try {
        // req.user is already set by verifyToken middleware
        res.status(200).json({
            success: true,
            data: req.user
        });
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
            error: err.message
        });
    }
};

// ---------------- update profile -----------------
exports.updateProfile = async (req, res) => {
    try {
        if (req.body.name) req.user.name = req.body.name;
        if (req.body.email) req.user.email = req.body.email;
        if (req.body.phone) req.user.phone = req.body.phone;


        if (req.file) {
            req.user.profileImage = req.file.path;
        }
        await req.user.save();
        res.status(200).json({
            success: true,
            data: req.user
        })


    } catch (err) {
        console.error("Error updated profile:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: err.message
        });
    }
}


// -------------- change password ---------------
exports.changePassword = async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        if (!email || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: "false",
                message: "Please provide Email, OldPassword, NewPassword"
            })
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Old password is incorrect" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        await user.save();
        res.status(200).json({ success: true, message: "Password updated successfully" });
    }
    catch (err) {
        console.error("Error changing password:", err.message);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
}

// ------------ OTP send for change Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "user not found" });
        }

        // Generate OTP (6 digit random)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP on email
        await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}. It will expire in 10 minutes.`);

        res.json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ------------------ reset Password -----------------------
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Validate OTP
        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


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

// search room by city, minPrice, maxPrice, cap, inDate, outDate
exports.searchRooms = async (req, res) => {
    try {
        const { city, minPrice, maxPrice, amenities, capacity, checkIn, checkOut } = req.query;

        // ✅ Guesthouse filter (only approved)
        let guesthouseFilter = { status: "approved" };
        if (city) {
            guesthouseFilter.city = { $regex: new RegExp(city, "i") };
        }

        const guesthouses = await Guesthouse.find(guesthouseFilter);

        if (guesthouses.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No guesthouses found for given filters.",
                NoOfRooms: 0,
                data: []
            });
        }

        // ✅ Room filter
        let roomFilter = {
            guesthouse: { $in: guesthouses.map(g => g._id) },
            pricePerNight: { $gte: Number(minPrice) || 0, $lte: Number(maxPrice) || 100000 }
        };

        if (capacity) roomFilter.capacity = { $gte: Number(capacity) };

        // ✅ Amenities filter
        if (amenities) {
            roomFilter.amenities = { $all: amenities.split(",") };
        }

        // ✅ Availability filter (optional)
        if (checkIn && checkOut) {
            roomFilter.availability = {
                $elemMatch: {
                    startDate: { $lte: new Date(checkIn) },
                    endDate: { $gte: new Date(checkOut) },
                    isAvailable: true
                }
            };
        }

        // ✅ Fetch rooms
        const rooms = await Room.find(roomFilter).populate("guesthouse");

        return res.status(200).json({
            success: true,
            message: "Rooms fetched successfully.",
            NoOfRooms: rooms.length,
            data: rooms
        });

    } catch (err) {
        console.error("❌ Error in searchRooms:", err);
        return res.status(500).json({
            success: false,
            error: "Search failed"
        });
    }
};



// POST d
exports.bookroom = async (req, res) => {
    try {
        const { roomId, checkIn, checkOut, promoCode } = req.body;

        if (!roomId || !checkIn || !checkOut) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const user = req.user;
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }

        // Check overlapping confirmed bookings
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
            return res.status(400).json({ success: false, message: "Room is already booked for these dates." });
        }

        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        const amount = nights * room.pricePerNight;

        const booking = await Booking.create({
            customer: user.id,
            guesthouse: room.guesthouse._id,
            room: roomId,
            checkIn,
            checkOut,
            nights,
            amount,
            status: "pending"
        });

        // ✅ Email को अलग try/catch में रखो
        try {
            await sendEmail(
                user.email,
                "Payment Pending",
                `Your amount is ${booking.amount}. Please complete your payment to confirm your booking.`
            );
        } catch (emailErr) {
            console.error("Email sending failed:", emailErr.message);
        }

        // ✅ Response हमेशा success होना चाहिए
        return res.status(201).json({
            success: true,
            message: "Booking created! Please complete payment to confirm your booking.",
            booking
        });

    } catch (error) {
        console.error("Booking error:", error);
        return res.status(500).json({ success: false, message: "Error booking room" });
    }
};



// payment done makePayment
exports.makePayment = async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Booking + populate customer, guesthouse, room
        const booking = await Booking.findById(bookingId)
            .populate("customer", "name email")
            .populate("guesthouse", "name location")
            .populate("room", "roomNumber roomType");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "No Booking found."
            });
        }

        if (booking.status === "confirmed") {
            return res.status(200).json({
                success: true,
                message: "Your payment is already done."
            });
        }

        //  Update status
        booking.status = "confirmed";
        await booking.save();

        //  Update room availability
        await Room.findByIdAndUpdate(booking.room._id, {
            $push: {
                availability: {
                    startDate: new Date(booking.checkIn),
                    endDate: new Date(booking.checkOut),
                    isAvailable: false
                }
            }
        });

        //  Email content
        const emailContent = `
Hello ${booking.customer.name},

✅ Your booking is confirmed!

🏨 Guesthouse: ${booking.guesthouse.name}, ${booking.guesthouse.location}
🛏️ Room: ${booking.room.roomType || booking.room.roomNumber}
📅 Check-in: ${new Date(booking.checkIn).toDateString()}
📅 Check-out: ${new Date(booking.checkOut).toDateString()}
💰 Amount Paid: ₹${booking.amount}
📌 Status: ${booking.status}

Thank you for booking with us!
        `;

        //  Send email
        try {
            await sendEmail(booking.customer.email, "Booking Confirmation", emailContent);
            console.log("📧 Email sent to:", booking.customer.email);
        } catch (mailErr) {
            console.error("❌ Email sending failed:", mailErr.message);
        }

        return res.status(200).json({
            success: true,
            amount: booking.amount,
            message: "Your payment is done and booking is confirmed."
        });

    } catch (err) {
        console.error("Payment error:", err.message);
        res.status(500).json({
            success: false,
            message: "Error processing payment."
        });
    }
};



// getAllBooking
exports.getAllBooking = async (req, res) => {
    try {
        const user = req.user;
        const customerId = user.id;
        const booking = await Booking.find({ customer: customerId }).populate({ path: "guesthouse", select: "name location" });

        res.status(200).json({
            success: true,
            NoOfBookings: booking.length,
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

// get Booking BY <ID>
exports.getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params; // 👈 yahan destructure karo
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Your booking details:",
            booking
        });
    } catch (err) {
        console.error("Error fetching booking:", err.message);
        res.status(500).json({
            success: false,
            message: "Error fetching booking details."
        });
    }
};