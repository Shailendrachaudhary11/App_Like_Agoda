const AdminUser = require("../models/adminUser");
const User = require("../models/user");
const Guesthouse = require("../models/Guesthouse");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ---------------- Admin Registration ----------------
exports.register = async (req, res) => {
    try {
        const data = req.body;

        const existingUser = await AdminUser.findOne({ email: data.email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Admin already registered with this email."
            });
        }

        data.password = await bcrypt.hash(data.password, 10);

        const newUser = new AdminUser(data);
        await newUser.save();

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully.",
            data: newUser
        });
    } catch (err) {
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
        const { email, password } = req.body;

        const adminUser = await AdminUser.findOne({ email });
        if (!adminUser) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            { id: adminUser._id, role: "admin" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            data: adminUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });
    }
};

// ---------------- Get Profile ----------------
exports.getProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const user = await AdminUser.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Error retrieving admin profile.",
            error: err.message
        });
    }
};

// ---------------- Update Profile ----------------
exports.updateProfile = async (req, res) => {
    try {
        if (req.body.name) req.user.name = req.body.name;
        if (req.body.email) req.user.email = req.body.email;
        if (req.body.phone) req.user.phone = req.body.phone;

        if (req.file) req.user.profileImage = req.file.path;

        await req.user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: req.user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: err.message
        });
    }
};

// ---------------- Approve Guesthouse ----------------
exports.approveGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        guesthouse.status = "approved";
        await guesthouse.save();

        return res.status(200).json({
            success: true,
            message: "Guesthouse approved successfully.",
            data: guesthouse
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to approve guesthouse.",
            error: err.message
        });
    }
};

// ---------------- Reject Guesthouse ----------------
exports.rejectGuesthouse = async (req, res) => {
    try {
        const { id } = req.params;
        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        await guesthouse.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Guesthouse rejected successfully.",
            data: guesthouse
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to reject guesthouse.",
            error: err.message
        });
    }
};

// ---------------- Approve User ----------------
exports.approvalRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.isVerified = true;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "User approved successfully.",
            data: user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to approve user.",
            error: err.message
        });
    }
};

// ---------------- Reject User ----------------
exports.rejectRequestUser = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

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
            data: user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to reject user.",
            error: err.message
        });
    }
};

// ---------------- Get All Guesthouses ----------------
exports.getAllGuestHouses = async (req, res) => {
    try {
        const guesthouses = await Guesthouse.find()
            .populate("owner", "name email phone role profileImage isVerified createdAt");

        return res.status(200).json({
            success: true,
            count: guesthouses.length,
            data: guesthouses
        });
    } catch (err) {
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
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouse.",
            error: err.message
        });
    }
};

// ---------------- Get All Users ----------------
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        return res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users.",
            error: err.message
        });
    }
};

// ---------------- Get User By ID ----------------
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user.",
            error: err.message
        });
    }
};

// // ---------------- Get guest house owners ----------------
// exports.getAllGuestHousesOwner = async (req,res) =>{
//     try{
//         const guestHouseOwners = await User.find({role:"guesthouse_admin"});
//         res.status(200).json({
//             success: true,
//             NoOfGuestHouseOwner: guestHouseOwners.length,
//             data: guestHouseOwners
//         })
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: "Failed to fetch owners guest house.",
//             error: err.message
//         });
//     }
// }