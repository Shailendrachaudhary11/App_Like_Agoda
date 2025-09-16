const createNotification = require("../utils/notificationHelper"); // helper path
const AdminUser = require("../models/adminUser");
const Guesthouse = require("../models/Guesthouse");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room")
const Promo = require("../models/Promo");
const User = require("../models/user")
const Booking = require("../models/Booking")


// ---------------- Admin Registration ----------------
exports.register = async (req, res) => {
    try {
        const data = req.body;

        console.log("Register request data:", data);

        // Check existing user by email
        const existingUser = await AdminUser.findOne({ email: data.email });
        if (existingUser) {
            console.log("Admin already exists:", data.email);
            return res.status(409).json({
                success: false,
                message: "Admin already registered with this email."
            });
        }

        // Hash password
        data.password = await bcrypt.hash(data.password, 10);

        // Create new admin
        const newUser = new AdminUser(data);

        // Save profile image filename (not full path)
        if (req.file) {
            newUser.profileImage = req.file.filename;
            console.log("Profile image set:", req.file.filename);
        }

        await newUser.save();

        console.log("Admin registered successfully:", newUser._id);

        // BASE_URL
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully.",
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                profileImage: newUser.profileImage
                    ? `${BASE_URL}/uploads/adminImage/${newUser.profileImage}`
                    : null,
                createdAt: newUser.createdAt
            }
        });
    } catch (err) {
        console.error("Error in admin registration:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};


// ---------------- Admin Login ----------------
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    console.log("Admin login attempt:", email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password."
      });
    }

    // Convert email to lowercase for case-insensitive check
    email = email.toLowerCase();

    // Find admin user by email (case-insensitive)
    const adminUser = await AdminUser.findOne({ email });
    if (!adminUser) {
      console.log("Admin not found:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email."
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      console.log("Invalid password attempt for:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid password."
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: adminUser._id, role: "admin", name: adminUser.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log("Admin logged in successfully:", adminUser._id);

    return res.status(200).json({
      success: true,
      message: "Login successfully.",
      token
    });
  } catch (error) {
    console.error("Error in admin login:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};


// ---------------- Approve registration Guesthouse ----------------
exports.approveGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Approving guesthouse registration:", id);

        const user = await User.findOne({ _id: id, role: "guesthouse" })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse registration not found."
            });
        }

        user.status = "approved";
        await user.save();

        console.log("Guesthouse registration approved:", id);

        await createNotification(
            user._id,
            "general",
            `Your guesthouse registration "${user.name}" has been approved by admin.`,
            { user: user._id }
        );
        console.log("Notification sent to owner:", user._id);

        return res.status(200).json({
            success: true,
            message: "Guesthouse registration approved successfully.",
            data: user
        });
    } catch (err) {
        console.error("Error approving guesthouse registration:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to approve guesthouse registration.",
            error: err.message
        });
    }
};


// ---------------- Reject registration Guesthouse ----------------
exports.rejectGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Rejecting guesthouse registration:", id);

        const user = await User.findOne({ _id: id, role: "guesthouse" });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse registration not found."
            });
        }

        await user.deleteOne();

        console.log("Guesthouse registration rejected:", id);
        await createNotification(
            user._id,
            "general",
            `Your guesthouse "${user.name}" has been reject by admin.`,
            { user: user._id }
        );
        console.log("Notification sent to owner:", user._id);
        return res.status(200).json({
            success: true,
            message: "Guesthouse registration rejected successfully.",
            data: user
        });
    } catch (err) {
        console.error("Error registration rejecting  guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to registration reject of guesthouse.",
            error: err.message
        });
    }
};


// ---------------- Get All Guesthouses ----------------
exports.getAllGuestHouses = async (req, res) => {
    try {
        console.log("Fetching all guesthouses");

        const guesthouses = await Guesthouse.find()
            .populate("owner", "name email phone role profileImage isVerified createdAt");

        return res.status(200).json({
            success: true,
            NoOfGuestHouses: guesthouses.length,
            data: guesthouses
        });
    } catch (err) {
        console.error("Error fetching guesthouses:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouses.",
            error: err.message
        });
    }
};

// ---------------- Get Guesthouse By ID ----------------
exports.getGuestHousesById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Fetching guesthouse by ID:", id);

        const guesthouse = await Guesthouse.findById(id)
            .populate("owner", "name email phone role profileImage isVerified createdAt");

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: guesthouse
        });
    } catch (err) {
        console.error("Error fetching guesthouse by ID:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouse.",
            error: err.message
        });
    }
};


// ------------- edit guesthouse details
exports.updateGuestHouse = async (req, res) => {
    try {
        const guesthouseId = req.params.id;
        if (!guesthouseId) {
            return res.status(400).json({
                success: false,
                message: "Please provide guesthouse Id."
            });
        }

        const guesthouse = await Guesthouse.findById(guesthouseId);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found."
            });
        }

        // Safe destructuring
        const {
            name,
            address,
            city,
            state,
            location,
            contactNumber,
            description
        } = req.body || {};

        console.log(`[GUESTHOUSE] Updating guesthouse ${guesthouseId}`);

        // Handle images
        if (req.files && req.files.length > 0) {
            guesthouse.images = req.files.map(file => file.filename); // only filename
        }

        // Duplicate name check (exclude current one)
        if (name) {
            const duplicate = await Guesthouse.findOne({ name, _id: { $ne: guesthouseId } });
            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: "Guesthouse name must be unique",
                });
            }
            guesthouse.name = name;
        }

        // Update other fields
        if (address) guesthouse.address = address;
        if (city) guesthouse.city = city;
        if (state) guesthouse.state = state;
        if (location) guesthouse.location = location;
        if (contactNumber) guesthouse.contactNumber = contactNumber;
        if (description) guesthouse.description = description;

        await guesthouse.save();

        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // Ensure images is array
        const imagesWithUrl = Array.isArray(guesthouse.images)
            ? guesthouse.images.map(img => `${BASE_URL}/uploads/guesthouses/${img}`)
            : [];

        // Notification
        await createNotification(
            guesthouse.owner?._id || guesthouse.owner, // safe check
            "general",
            `Your guesthouse "${guesthouse.name}" has been updated by admin.`,
            { guesthouseId: guesthouse._id }
        );

        return res.status(200).json({
            success: true,
            message: "Guesthouse updated successfully.",
            data: {
                guesthouseId: guesthouse._id,
                status: guesthouse.status,
                name: guesthouse.name,
                address: guesthouse.address,
                city: guesthouse.city,
                state: guesthouse.state,
                location: guesthouse.location,
                contactNumber: guesthouse.contactNumber,
                description: guesthouse.description,
                images: imagesWithUrl
            }
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating guesthouse",
            error: err.message,
        });
    }
};


// ----------------- Suspended GuestHouse ------------
exports.suspendedGuestHouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Suspended guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "suspended";

        await guesthouse.save();

        await createNotification(
            guesthouse.owner._id,
            "general",
            `Your guesthouse "${guesthouse.name}" has been suspended by admin.`,
            { guesthouseId: guesthouse._id }
        );
        console.log("Notification sent to owner:", guesthouse.owner._id);
        return res.status(200).json({
            success: true,
            message: "Guesthouse suspended successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error suspended guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to suspended guesthouse.",
            error: err.message
        });
    }
}


// ----------------- Activate GuestHouse --------------
exports.activateGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Activated guesthouse ID:", id);

        const guesthouse = await Guesthouse.findById(id);
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "active";

        await guesthouse.save();

        await createNotification(
            guesthouse.owner._id,
            "general",
            `Your guesthouse "${guesthouse.name}" has been Re-active by admin.`,
            { guesthouseId: guesthouse._id }
        );
        console.log("Notification sent to owner:", guesthouse.owner._id);

        return res.status(200).json({
            success: true,
            message: "Guesthouse Activated successfully.",
            data: guesthouse
        });
    } catch (err) {
        console.error("Error Activated guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to Activated guesthouse.",
            error: err.message
        });
    }

}

// GET ALL ROOMS
exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find().populate("guesthouse");

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all rooms.",
            NoOfRooms: rooms.length,
            data: rooms
        });
    } catch (err) {
        console.error("[ROOM] Error fetching rooms:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching rooms",
            error: err.message
        });
    }
};


// ---------------- GET rooms by id ----------------
exports.getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        // Use findById if roomid is MongoDB _id
        const room = await Room.findById(id); // optional populate

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetched room",
            room: room
        });
    } catch (err) {
        console.log("Error while fetching room:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching room"
        });
    }
};


// ---------------- PUT update rooms by id ----------------
exports.editRoom = async (req, res) => {
    try {
        const { id } = req.params;

        // Find room by ID
        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const {
            roomNumber,
            title,
            description,
            amenities,
            priceWeekly,
            pricePerNight,
            priceMonthly,
            capacity
        } = req.body;

        // Update fields if provided
        if (roomNumber) room.roomNumber = roomNumber;
        if (title) room.title = title;
        if (description) room.description = description;
        if (amenities) room.amenities = amenities;
        if (pricePerNight) room.pricePerNight = pricePerNight;
        if (priceWeekly) room.priceWeekly = priceWeekly;
        if (priceMonthly) room.priceMonthly = priceMonthly;
        if (capacity) room.capacity = capacity;

        // Handle new images (replace old completely)
        if (req.files && req.files.length > 0) {
            room.photos = req.files.map(file => file.filename); // ✅ only filename in DB
        }

        await room.save();

        // BASE_URL
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        res.status(200).json({
            success: true,
            message: "Room updated successfully",
            data: {
                _id: room._id,
                roomNumber: room.roomNumber,
                title: room.title,
                description: room.description,
                amenities: room.amenities,
                pricePerNight: room.pricePerNight,
                priceWeekly: room.priceWeekly,
                priceMonthly: room.priceMonthly,
                capacity: room.capacity,
                photos: room.photos.map(img => `${BASE_URL}/uploads/rooms/${img}`)
            }
        });
    } catch (err) {
        console.error("Error while updating room:", err);
        res.status(500).json({
            success: false,
            message: "Error updating room",
            error: err.message
        });
    }
};


// ------------- DELETE ROOMS --------------
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        // Use findById if roomid is MongoDB _id
        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        await room.deleteOne();

        res.status(200).json({
            success: true,
            message: "Successfully delete room",
            room: room
        });
    } catch (err) {
        console.log("Error while deleting room:", err);
        res.status(500).json({
            success: false,
            message: "Error deleting room"
        });
    }
};

// GET ALL CUSTOMERS
exports.getAllCustomer = async (req, res) => {
    try {
        const customers = await User.find({ role: "customer" });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all customers.",
            data: customers
        });
    } catch (err) {
        console.error("[CUSTOMER] Error fetching customers:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching customers",
            error: err.message
        });
    }
};

// GET CUSTOMER BY ID
exports.getCustomerById = async (req, res) => {
    try {
        const customerId = req.params.id; // URL से id लो

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer Id."
            });
        }

        const customer = await User.findOne({ _id: customerId, role: "customer" });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer fetched successfully.",
            data: customer
        });

    } catch (err) {
        console.error("[CUSTOMER] Error fetching customer by id:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching customer by id",
            error: err.message
        });
    }
};

// ------------ Approve Customer --------------
exports.approvalCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.status = "approved";
        await createNotification(
            user._id,
            "general",
            `Your customer registration "${user.name}" has been approved by admin.`,
            { user: user._id }
        );
        await user.save();

        return res.status(200).json({
            success: true,
            message: "customer approved successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to approve user.",
            error: err.message
        });
    }
};

// ---------------- Reject Customer ----------------
exports.rejectCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        await user.deleteOne();

        return res.status(200).json({
            success: true,
            message: "User rejected successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to reject user.",
            error: err.message
        });
    }
};

// ---------------- Suspend Customer ----------------
exports.suspendedCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.status = "suspended";

        await createNotification(
            user._id,
            "general",
            `Your account "${user.name}" has been suspended by admin.`,
            { user: user._id }
        );

        await user.save();

        return res.status(200).json({
            success: true,
            message: "User suspended successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to suspend user.",
            error: err.message
        });
    }
};

// ---------------- Activate Customer ----------------
exports.activateCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.status = "approved"; // or "active"

        await createNotification(
            user._id,
            "general",
            `Your account "${user.name}" has been re-active by admin.`,
            { user: user._id }
        );

        await user.save();

        return res.status(200).json({
            success: true,
            message: "User activated successfully.",
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to activate user.",
            error: err.message
        });
    }
};

// ---------------- Booking ------------------------
exports.getAllBooking = async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("guesthouse")   // guesthouse details
            .populate("customer")     // customer details
            .populate("room");        // room details (अगर schema में है)

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all bookings.",
            data: bookings
        });

    } catch (err) {
        console.error("[BOOKING] Error fetching bookings:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching bookings",
            error: err.message
        });
    }
};

// booking by Id
exports.getBookingById = async (req, res) => {
    try {
        const bookingId = req.params.id; // URL से bookingId लो

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Please provide booking Id."
            });
        }

        const booking = await Booking.findById(bookingId)
            .populate("guesthouse")   // guesthouse details
            .populate("customer")     // customer details
            .populate("room");        // room details (अगर schema में है)

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched booking.",
            data: booking
        });

    } catch (err) {
        console.error("[BOOKING] Error fetching booking by id:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching booking",
            error: err.message
        });
    }
};


// Get all promos
exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find();
        res.status(200).json({ success: true, data: promos });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching promos", error: err.message });
    }
};


// create Promo
exports.createPromo = async (req, res) => {
    try {
        const { code, discountType, discountValue, startDate, endDate, maxUsage } = req.body;

        // Required fields check
        if (!code || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: code, discountType, discountValue, startDate, endDate"
            });
        }

        // Extra validations
        if (!["flat", "percentage"].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'"
            });
        }

        if (discountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: "discountValue must be greater than 0"
            });
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: "endDate must be greater than startDate"
            });
        }

        // Create promo object
        const promo = new Promo({
            code,
            discountType,
            discountValue,
            startDate,
            endDate,
            maxUsage
        });

        await promo.save();

        res.status(201).json({
            success: true,
            message: "Promo created successfully",
            data: promo
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error creating promo",
            error: err.message
        });
    }
};

// Get promo by id
exports.getPromoById = async (req, res) => {
    try {
        const promo = await Promo.findById(req.params.id);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, data: promo });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching promo", error: err.message });
    }
};

// Update promo
exports.updatePromo = async (req, res) => {
    try {
        const promo = await Promo.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, message: "Promo updated successfully", data: promo });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error updating promo", error: err.message });
    }
};

// Delete promo
exports.deletePromo = async (req, res) => {
    try {
        const promo = await Promo.findByIdAndDelete(req.params.id);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, message: "Promo deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting promo", error: err.message });
    }
};
