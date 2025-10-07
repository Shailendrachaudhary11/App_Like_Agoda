const AdminUser = require("../models/adminUser");
const Guesthouse = require("../models/Guesthouse");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room")
const Promo = require("../models/Promo");
const User = require("../models/user")
const Booking = require("../models/Booking")
const Notification = require("../models/notification")
const createNotification = require("../utils/notificationHelper");
const sendEmail = require("../utils/sendEmail");
const Atolls = require("../models/Atoll");
const Facility = require("../models/Facility");
const Island = require("../models/Island");
const Bedroom = require("../models/Bedroom")
const Review = require("../models/review")

const BASE_URL = process.env.BASE_URL;

// -------------------------------------------- Admin Registration ------------------------------
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
        const BASE_URL = process.env.BASE_URL;

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

        // Find admin user by email (case-insensitive)
        const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });
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

        adminUser.adminImage = adminUser.adminImage
            ? `${process.env.BASE_URL || ""}/uploads/adminImage/${adminUser.adminImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Login successfully.",
            token: token,
            data: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                adminImage: adminUser.adminImage
            }
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

exports.getProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;

        // check amdinId present or not
        if (!adminId) {
            return res.status(400).json({
                success: false,
                message: "Admin ID is missing in request.",
                data: null,
            });
        }

        const admin = await AdminUser.findById(adminId)
            .select("-password -__v -createdAt") // exclude sensitive/unnecessary fields
            .lean(); // return plain JS object (faster)

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found.",
                data: null,
            });
        }

        admin.adminImage = admin.adminImage
            ? `${process.env.BASE_URL || ""}/uploads/adminImage/${admin.adminImage}`
            : null;


        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully.",
            data: admin,
        });
    } catch (error) {
        console.error("Error in getProfile:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later.",
            data: null,
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        console.log("Updating profile:", req.user?._id);

        // Load fresh admin user
        let adminUser = await AdminUser.findById(req.user._id);
        if (!adminUser) {
            return res.status(404).json({
                success: false,
                message: "Admin user not found",
                data: null,
            });
        }

        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Request body is required",
                data: null,
            });
        }

        // Update name if provided
        if (req.body.name) {
            let name = req.body.name.toString().trim();
            if (name.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 4 characters long",
                    data: null,
                });
            }
            adminUser.name = name.charAt(0).toUpperCase() + name.slice(1); // capitalize
        }

        // update email if provided

        if (req.body.email) {
            let email = req.body.email.toString().trim(); // remove extra spaces

            // Check if email format is valid
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                    data: null,
                });
            }

            // If valid, assign email to user
            adminUser.email = email.toLowerCase(); // store in lowercase for consistency
        }


        if (req.body.phone) {
            let phone = req.body.phone.toString().trim();

            // Phone number regex (10 digits only, can adjust as needed)
            const phoneRegex = /^[0-9]{10}$/;

            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be a valid 10-digit number",
                    data: null,
                });
            }

            adminUser.phone = phone;
        }


        // Update profile image if uploaded
        if (req.file) {
            adminUser.adminImage = req.file.filename; // store only filename
        }

        await adminUser.save();

        console.log("Profile updated successfully:", adminUser._id);

        // Construct profile image URL
        const profileImageUrl = adminUser.adminImage
            ? `${process.env.BASE_URL || ""}/uploads/adminImage/${adminUser.adminImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                role: adminUser.role,
                adminImage: profileImageUrl,
                createdAt: adminUser.createdAt,
            },
        });
    } catch (err) {
        console.error("[PROFILE] Error updating profile:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: err.message,
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Request body is missing. Please provide oldPassword and newPassword."
            });
        }
        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Check all fields
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Please provide oldPassword, newPassword, and confirmPassword."
            });
        }

        // Prevent reusing old password
        if (oldPassword === newPassword) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: "Old password and new password must be different."
            });
        }

        // Check if newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "New password and confirm password do not match."
            });
        }

        // Always fetch user from DB to ensure password is available
        const adminUser = await AdminUser.findById(req.user.id);
        if (!adminUser) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "adminUser not found."
            });
        }

        // Check old password
        const isMatch = await bcrypt.compare(oldPassword, adminUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: "Old password is incorrect."
            });
        }

        // Hash new password and save
        adminUser.password = await bcrypt.hash(newPassword, 10);
        await adminUser.save();

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Password updated successfully.",
            data: {
                id: adminUser._id,
                email: adminUser.email
            }
        });

    } catch (err) {
        console.error("[PASSWORD] Error changing password:", err.message);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Server error. Please try again later.",
            error: err.message
        });
    }
};

// -------------------------------------------- GUEST HOUSE ---------------------------------------
exports.getAllGuestOwner = async (req, res) => {
    try {
        const guestOwners = await User.find({ role: "guesthouse" }, { password: 0, createdAt: 0, __v: 0, otp: 0 });

        const updatedGuestOwners = guestOwners.map(guestOwner => {
            const guestOwnerObj = guestOwner.toObject();
            if (guestOwnerObj.profileImage) {
                guestOwnerObj.profileImage = `${BASE_URL}/uploads/profileImage/${guestOwnerObj.profileImage}`;
            }
            return guestOwnerObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all guesthouse owners.",
            count: updatedGuestOwners.length,
            data: updatedGuestOwners
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

exports.getPendingRegistration = async (req, res) => {
    try {
        const guestOwners = await User.find({ role: "guesthouse", status: "pending" })
            .select("-password")
            .sort({ createdAt: -1 });

        const updatedGuestOwners = guestOwners.map(guestOwner => {
            const guestOwnerObj = guestOwner.toObject();
            if (guestOwnerObj.profileImage) {
                guestOwnerObj.profileImage = `${BASE_URL}/uploads/profileImage/${guestOwnerObj.profileImage}`;
            }
            return guestOwnerObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all pending guesthouse owners.",
            count: updatedGuestOwners.length,
            data: updatedGuestOwners
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

exports.getGuestOwnerById = async (req, res) => {
    try {
        const guestHouseOwnerId = req.params.id;

        // Validate ID format
        if (!guestHouseOwnerId) {
            return res.status(400).json({
                success: false,
                message: "Valid GuestHouse Owner ID is required.",
                data: null,
            });
        }

        const guestHouseOwner = await User.findById(guestHouseOwnerId)
            .select("-password -__v -role -otp")
            .lean();

        if (!guestHouseOwner) {
            return res.status(404).json({
                success: false,
                message: "GuestHouse Owner not found.",
                data: null,
            });
        }

        // Full profile image URL
        guestHouseOwner.profileImage = guestHouseOwner.profileImage
            ? `${process.env.BASE_URL || ""}/uploads/profileImage/${guestHouseOwner.profileImage}`
            : null;

        return res.status(200).json({
            success: true,
            message: "GuestHouse Owner fetched successfully.",
            data: guestHouseOwner,
        });

    } catch (error) {
        console.error("Error fetching GuestHouse Owner by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Could not fetch GuestHouse Owner.",
            error: error.message,
            data: null,
        });
    }
};

exports.getAllGuestHouses = async (req, res) => {
    try {
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        // Fetch guesthouses
        const guestHouses = await Guesthouse.find()
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

                // Images full URL
                if (gh.guestHouseImage && Array.isArray(gh.guestHouseImage)) {
                    gh.guestHouseImage = gh.guestHouseImage.map(
                        img => `${BASE_URL}/uploads/guestHouseImage/${img}`
                    );
                }

                // Count reviews correctly
                try {
                    const reviews = await Review.countDocuments({ guesthouse: gh._id });
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

exports.updateGuestHouse = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            address,
            location,
            contactNumber,
            description,
            price,
            facilities,
            stars,
            atolls,
            islands
        } = req.body;

        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found",
            });
        }

        console.log(`[GUESTHOUSE] Updating guesthouse ${id} by user ${req.user?.id || "unknown"}`);

        //  Handle images (optional)
        if (req.files && req.files.length > 0) {
            guesthouse.guestHouseImage = req.files.map(file => file.filename);
        }

        //  Dynamic fields update
        const fields = {
            name,
            address,
            contactNumber,
            description,
            price,
            stars,
            atolls,
            islands
        };

        for (const key in fields) {
            if (fields[key] !== undefined && fields[key] !== null) {
                guesthouse[key] = fields[key];
            }
        }

        //  Facilities update (must be array)
        if (facilities) {
            guesthouse.facilities = Array.isArray(facilities)
                ? facilities
                : facilities.split(",").map(f => f.trim()).filter(Boolean);
        }

        //  Location update (lng, lat)
        if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
            guesthouse.location = {
                type: "Point",
                coordinates: location.coordinates
            };
        }

        await guesthouse.save();

        //  Notification
        await createNotification(
            { userId: req.user.id, role: req.user.role },   // sender
            { userId: guesthouse.owner, role: "guesthouse" }, // receiver
            "Guesthouse Updated",
            `Your guesthouse "${guesthouse.name}" has been updated successfully by admin.`,
            "system",
            { guesthouseId: guesthouse._id }
        );

        return res.status(200).json({
            success: true,
            message: "Guesthouse updated successfully.",
            data: guesthouse
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

exports.getGuestHousesById = async (req, res) => {
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

// exports.suspendedGuestHouse = async (req, res) => {
//     try {
//         const { id: guesthouseId } = req.params;
//         if (!guesthouseId) {
//             return res.status(400).json({ success: false, message: "Guesthouse ID is required." });
//         }

//         console.log(`[GUESTHOUSE] Suspending guesthouse: ${guesthouseId}`);

//         // Populate owner to access email or _id
//         const guesthouse = await Guesthouse.findById(guesthouseId).populate("owner", "name email _id");
//         if (!guesthouse) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Guesthouse not found."
//             });
//         }

//         // Check if already suspended
//         if (guesthouse.status === "suspended") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Guesthouse is already suspended.",
//                 data: {
//                     id: guesthouse._id,
//                     name: guesthouse.name,
//                     ownerName: guesthouse.owner?.name,
//                     ownerEmail: guesthouse.owner?.email,
//                     status: guesthouse.status
//                 }
//             });
//         }

//         // Update status
//         guesthouse.status = "suspended";
//         await guesthouse.save();

//         // Send notification if owner exists
//         if (guesthouse.owner?._id) {
//             await createNotification(
//                 guesthouse.owner._id,
//                 "general",
//                 `Your guesthouse "${guesthouse.name}" has been suspended by admin.`,
//                 { guesthouseId: guesthouse._id }
//             );
//             console.log(`[GUESTHOUSE] Notification sent to owner: ${guesthouse.owner._id}`);
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Guesthouse suspended successfully.",
//             data: {
//                 id: guesthouse._id,
//                 name: guesthouse.name,
//                 ownerName: guesthouse.owner?.name,
//                 ownerEmail: guesthouse.owner?.email,
//                 status: guesthouse.status
//             }
//         });

//     } catch (err) {
//         console.error("[GUESTHOUSE] Error suspending guesthouse:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to suspend guesthouse.",
//             error: err.message
//         });
//     }
// };

exports.activeInactiveGuesthouse = async (req, res) => {
    try {
        const { id: guesthouseId } = req.params;
        if (!guesthouseId) {
            return res.status(400).json({ success: false, message: "Guesthouse ID is required." });
        }

        console.log(`[GUESTHOUSE] Activating and Inactivating guesthouse: ${guesthouseId}`);

        // Populate owner to safely access _id and email
        const guesthouse = await Guesthouse.findById(guesthouseId).populate("owner", "name email _id");
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        // Already active?
        if (guesthouse.status === "active") {
            guesthouse.status = "inactive"
        }

        else if (guesthouse.status === "inactive") {
            guesthouse.status = "active"
        }

        else {
            guesthouse.status = "active"
        }

        await guesthouse.save();

        // Send notification to owner if exists
        if (guesthouse.owner?._id) {
            await createNotification(
                guesthouse.owner._id,
                "general",
                `Your guesthouse "${guesthouse.name}" has been ${guesthouse.status} by admin.`,
                { guesthouseId: guesthouse._id }
            );
            console.log(`[GUESTHOUSE] Notification sent to owner: ${guesthouse.owner._id}`);
        }

        return res.status(200).json({
            success: true,
            message: `Guesthouse ${guesthouse.status} successfully.`,
            data: {
                id: guesthouse._id,
                name: guesthouse.name,
                ownerName: guesthouse.owner?.name,
                ownerEmail: guesthouse.owner?.email,
                status: guesthouse.status
            }
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error activating guesthouse:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to activate guesthouse.",
            error: err.message
        });
    }
};

exports.approveGuesthouseRegistration = async (req, res) => {
    try {
        const { id: guesthouseId } = req.params;
        if (!guesthouseId) {
            return res.status(400).json({ success: false, message: "Guesthouse ID is required." });
        }

        console.log(`[GUESTHOUSE] Approving registration: ${guesthouseId}`);

        // Find guesthouse user by ID and role
        const guesthouseUser = await User.findOne({ _id: guesthouseId, role: "guesthouse" });
        if (!guesthouseUser) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse registration not found."
            });
        }

        if (guesthouseUser.status === "approved") {
            return res.status(200).json({
                success: true,
                message: "Guesthouse registration is already approved.",
                data: {
                    id: guesthouseUser._id,
                    name: guesthouseUser.name,
                    email: guesthouseUser.email,
                    status: guesthouseUser.status
                }
            });
        }

        // Update status
        guesthouseUser.status = "approved";
        await guesthouseUser.save();

        console.log(`[GUESTHOUSE] Registration approved: ${guesthouseId}`);

        // email send for approval regiatration via email

        const emailSent = await sendEmail(
            guesthouseUser.email,
            ` Congratulations! Your Guesthouse Registration is Approved `,

            `Dear ${guesthouseUser.name},

                    We are pleased to inform you that your guesthouse registration has been successfully approved.  
                    You can now log in to your account and proceed with the next steps to manage your guesthouse.
                        
                    Here are your registered details:
                    - Owner Name: ${guesthouseUser.name}
                    - Email: ${guesthouseUser.email}
                    - Phone: ${guesthouseUser.phone}
                        
                      Next Steps:
                    1. Login to your account using your registered email.
                    2. Complete your guesthouse profile (add images, amenities, pricing, etc.).
                    3. Start managing your rooms, availability, and bookings.
                        
                    If you face any issues, feel free to reach out to our support team.
                        
                        
                    Best Regards,  
                    Team Guesthouse Management`
        );


        if (!emailSent) return res.status(500).json({ success: false, message: "registrtaion notification not send." });

        return res.status(200).json({
            success: true,
            message: "Guesthouse registration approved successfully.",
            data: {
                id: guesthouseUser._id,
                name: guesthouseUser.name,
                email: guesthouseUser.email,
                status: guesthouseUser.status,
                approvedAt: new Date()
            }
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error approving registration:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to approve guesthouse registration.",
            error: err.message
        });
    }
};

exports.rejectGuesthouseRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Rejecting guesthouse registration:", id);

        const guesthouseUser = await User.findOne({ _id: id, role: "guesthouse" });
        if (!guesthouseUser) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse registration not found."
            });
        }

        if (guesthouseUser.status === "reject") {
            return res.status(200).json({
                success: true,
                message: "Guesthouse registration is already reject.",
                data: {
                    id: guesthouseUser._id,
                    name: guesthouseUser.name,
                    email: guesthouseUser.email,
                    status: guesthouseUser.status
                }
            });
        }

        guesthouseUser.status = "reject";

        await guesthouseUser.save();

        // email send to registration email for reject registration
        await sendEmail(
            guesthouseUser.email,
            `Guesthouse Registration Update`,

            `Dear ${guesthouseUser.name},

                We regret to inform you that your guesthouse registration has been reject at this time.  
                This may be due to incomplete information, verification issues, or other reasons specified in your application.
                        
                Here are your submitted details:
                - Owner Name: ${guesthouseUser.name}
                - Email: ${guesthouseUser.email}
                - Phone: ${guesthouseUser.phone}
                        
                 Next Steps:
                1. Review the details you submitted and ensure all required information is complete and accurate.
                2. Correct any discrepancies and submit a new application if applicable.
                3. Contact our support team for further assistance or clarification regarding your application.
                        
                We appreciate your interest in joining our platform and encourage you to reapply after resolving the issues.
                        
                Best Regards,  
                Team Guesthouse Management`
        );


        console.log("Guesthouse registration rejected:", id);
        return res.status(200).json({
            success: true,
            message: "Guesthouse registration rejected successfully.",
            data: guesthouseUser
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

// -------------------------------------------- ROOM MANAGEMENT ---------------------------------------
exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find();
        const updatedRooms = rooms.map(room => {
            const roomObj = room.toObject();

            // Guesthouse images
            if (roomObj.guesthouse && roomObj.guesthouse.guestHouseImage) {
                roomObj.guesthouse.guestHouseImage = roomObj.guesthouse.guestHouseImage.map(img =>
                    `${BASE_URL}/uploads/guestHouseImage/${img.trim()}`
                );
            }

            // Room photos
            if (roomObj.photos) {
                roomObj.photos = roomObj.photos.map(photo =>
                    `${BASE_URL}/uploads/rooms/${photo.trim()}`
                );
            }

            return roomObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all rooms.",
            NoOfRooms: rooms.length,
            data: updatedRooms
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

exports.getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch room with guesthouse populated
        const room = await Room.findById(id).populate("guesthouse");

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // Convert Mongoose doc to plain object
        const roomObj = room.toObject();

        // Update guesthouse images with full URL
        if (roomObj.guesthouse && roomObj.guesthouse.guestHouseImage) {
            roomObj.guesthouse.guestHouseImage = roomObj.guesthouse.guestHouseImage.map(
                (img) => `${BASE_URL}/uploads/guestHouseImage/${img.trim()}`
            );
        }

        // Update room photos with full URL
        if (roomObj.photos) {
            roomObj.photos = roomObj.photos.map(
                (photo) => `${BASE_URL}/uploads/rooms/${photo.trim()}`
            );
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched room",
            room: roomObj,
        });
    } catch (err) {
        console.error("[ROOM] Error fetching room:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching room",
            error: err.message,
        });
    }
};

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
            roomCategory,
            bedType,
            capacity,
            amenities,
            pricePerNight,
            priceWeekly,
            priceMonthly,
            description
        } = req.body;

        // Update fields if provided
        if (roomCategory) room.roomCategory = roomCategory;
        if (bedType) room.bedType = bedType;
        if (capacity) room.capacity = capacity;
        if (amenities) room.amenities = amenities;
        if (pricePerNight) room.pricePerNight = pricePerNight;
        if (priceWeekly) room.priceWeekly = priceWeekly;
        if (priceMonthly) room.priceMonthly = priceMonthly;



        // Handle new images (replace old completely if new uploaded)
        if (req.files && req.files.length > 0) {
            room.photos = req.files.map(file => file.filename); // only filenames
        }

        await room.save();

        res.status(200).json({
            success: true,
            message: "Room updated successfully",
            data: room._id
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

// -------------------------------------------- CUSTOMER MANAGEMENT ---------------------------------------
exports.getAllCustomer = async (req, res) => {
    try {
        const customers = await User.find({ role: "customer" }, { createdAt: 0, __v: 0, otp: 0, role: 0 })

        const updatedCustomers = customers.map(customer => {
            const customerObj = customer.toObject();
            if (customerObj.profileImage) {
                customerObj.profileImage = `${BASE_URL}/uploads/profileImage/${customerObj.profileImage}`;
            }
            return customerObj;
        });

        return res.status(200).json({
            success: true,
            message: "Successfully fetched all customers.",
            count: updatedCustomers.length,
            data: updatedCustomers
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

exports.getCustomerById = async (req, res) => {
    try {
        const customerId = req.params.id; // get Id from url

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Please provide customer Id."
            });
        }

        const customer = await User.findOne({ _id: customerId, role: "customer" }).select("-password");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        const customerObj = customer.toObject();
        if (customerObj.profileImage) {
            customerObj.profileImage = `${BASE_URL}/uploads/profileImage/${customerObj.profileImage}`;
        }

        return res.status(200).json({
            success: true,
            message: "Customer fetched successfully.",
            data: customerObj
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

exports.suspendedApproveCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.status === "suspended") {
            user.status = "approved";
        }
        else {
            user.status = "suspended";
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: `User ${user.status} successfully.`,
            userId: user._id,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: `Failed to ${user.status} user.`,
            error: err.message
        });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const customerId = req.params.id; // safer

        let user = await User.findById(customerId);
        if (!user) return res.status(404).json({ success: false, message: "Customer not found", data: null });

        const { name, email, phone, address } = req.body;

        if (name) {
            const trimmedName = name.toString().trim();
            if (trimmedName.length < 4)
                return res.status(400).json({ success: false, message: "Name must be at least 4 characters long", data: null });
            user.name = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
        }

        if (email) {
            const emailLower = email.toString().trim().toLowerCase();
            const existingEmail = await User.findOne({ email: emailLower, _id: { $ne: customerId } });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower))
                return res.status(400).json({ success: false, message: "Invalid email format", data: null });
            if (existingEmail)
                return res.status(400).json({ success: false, message: "Email already in use", data: null });
            user.email = emailLower;
        }

        if (phone) {
            const phoneStr = phone.toString().trim();
            const existingPhone = await User.findOne({ phone: phoneStr, _id: { $ne: customerId } });
            if (!/^[0-9]{10}$/.test(phoneStr))
                return res.status(400).json({ success: false, message: "Phone must be 10 digits", data: null });
            if (existingPhone)
                return res.status(400).json({ success: false, message: "Phone already in use", data: null });
            user.phone = phoneStr;
        }

        if (address) user.address = address.toString().trim();
        if (req.file) user.profileImage = req.file.filename;

        await user.save();

        const profileImageUrl = user.profileImage ? `${process.env.BASE_URL}/uploads/profileImage/${user.profileImage}` : null;

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role: user.role,
                profileImage: profileImageUrl,
                createdAt: user.createdAt,
            },
        });

    } catch (err) {
        console.error("[PROFILE] Error updating profile:", err);
        return res.status(500).json({ success: false, message: "Failed to update profile.", error: err.message });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;

        const customer = await User.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        await customer.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Customer successfully deleted."
        });

    } catch (error) {
        console.error("[DELETE CUSTOMER] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete customer.",
            error: error.message
        });
    }
};

// -------------------------------------------- BOOKING ---------------------------------------
exports.getAllBooking = async (req, res) => {
    try {

        const bookings = await Booking.find()
            .sort({ createdAt: -1 })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
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

        res.status(200).json({
            success: true,
            message: "Successfully fetched your bookings.",
            count: formattedBookings.length,
            data: formattedBookings,
        });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching all bookings.",
            error: error.message,
        });
    }
};

exports.getBookingById = async (req, res) => {
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


        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const guesthouse = booking.guesthouse || {};
        const room = booking.room;

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


        const formattedBooking = {
            id: booking._id,
            guesthouse: guesthouse._id || null,
            guestHouseImg: guestHouseImg,
            guestHouseName: guesthouse.name || "",
            guestHouseAddress: guesthouse.address || "",
            checkIn: booking.checkIn ? new Date(booking.checkIn).toISOString().split("T")[0] : "",
            checkOut: booking.checkOut ? new Date(booking.checkOut).toISOString().split("T")[0] : "",
            room: roomCount,
            roomType: roomType || "",
            guest: booking.guest || {}, // guest info
            amount: booking.amount || 0,
            finalAmount: booking.finalAmount || 0,
            status: booking.status || "",
            paymentStatus: booking.paymentStatus || "",
            createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : "",
            updatedAt: booking.updatedAt ? new Date(booking.updatedAt).toISOString().split("T")[0] : "",
        };

        res.status(200).json({
            success: true,
            message: "Successfully fetched booking details.",
            data: formattedBooking
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

exports.pastBooking = async (req, res) => {
    try {
        const today = new Date();

        const pastBookings = await Booking.find({
            checkOut: { $lt: today }, // booking already ended
        })
            .select("_id customer  checkIn checkOut status finalAmount nights")
            .populate('customer', 'name')
            .sort({ checkOut: -1 });

        if (pastBookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No past booking found"
            })
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetch past Bookings",
            count: pastBookings.length,
            data: pastBookings
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to fetching past booking.",
            Error: error
        })
    }
}

exports.upcomingBookings = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // din ka start time fix

        const bookings = await Booking.find({
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
            return res.status(200).json({
                success: true,
                message: "No upcoming bookings found.",
                count: 0,
                data: []
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

        return res.status(200).json({
            success: true,
            message: "Upcoming bookings fetched successfully.",
            count: formattedBookings.length,
            data: formattedBookings
        });

    } catch (error) {
        console.error("Error fetching upcoming bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching upcoming trips.",
            error: error.message
        });
    }
}

exports.getCancelBookings = async (req, res) => {
    try {


        const bookings = await Booking.find({ status: "cancelled" })
            .populate({
                path: "guesthouse",
                select: "name address guestHouseImage",
            })
            .select("-__v -createdAt -updatedAt");

        if (!bookings || bookings.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                message: "No cancelled bookings found.",
                data: []
            });
        }

        const formattedBookings = bookings.map((booking) => {
            const guesthouse = booking.guesthouse || {};
            let guestHouseImg = "";

            if (guesthouse.guestHouseImage) {
                if (Array.isArray(guesthouse.guestHouseImage)) {
                    guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guesthouse.guestHouseImage[0].trim()}`;
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

        res.status(200).json({
            success: true,
            count: formattedBookings.length,
            message: "Cancelled bookings fetched successfully.",
            data: formattedBookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching cancelled bookings.",
            error: error.message
        });
    }
};

// -------------------------------------------- PROMOS ---------------------------------------
exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find();
        res.status(200).json({
            success: true,
            count: promos.length,
            message: "Successfully fetching all promo codes",
            data: promos
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error fetching promos",
            error: err.message
        });
    }
};

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

exports.getPromoById = async (req, res) => {
    try {
        const promo = await Promo.findById(req.params.id);
        if (!promo) return res.status(404).json({
            success: false,
            message: "Promo not found"
        });
        res.status(200).json({
            success: true,
            message: `Successfully fetch promo code.`,
            data: promo
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching promo", error: err.message });
    }
};

exports.updatePromo = async (req, res) => {
    try {
        const promoId = req.params.id;
        let promo = await Promo.findById(promoId);

        if (!promo) {
            return res.status(404).json({ success: false, message: "Promo not found" });
        }

        const { code, discountType, discountValue, startDate, endDate, maxUsage } = req.body;

        // 🔹 discountType validation
        if (discountType && !["flat", "percentage"].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "discountType must be either 'flat' or 'percentage'"
            });
        }

        // 🔹 discountValue validation
        if (discountValue && discountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: "discountValue must be greater than 0"
            });
        }

        // 🔹 date validation
        if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: "endDate must be greater than startDate"
            });
        }

        // 🔹 Allowed fields only
        const allowedUpdates = { code, discountType, discountValue, startDate, endDate, maxUsage };
        Object.keys(allowedUpdates).forEach((key) => {
            if (allowedUpdates[key] !== undefined) {
                promo[key] = allowedUpdates[key];
            }
        });

        await promo.save();

        res.status(200).json({
            success: true,
            message: "Promo updated successfully",
            data: promo
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error updating promo",
            error: err.message
        });
    }
};

exports.deletePromo = async (req, res) => {
    try {
        const promo = await Promo.findByIdAndDelete(req.params.id);
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, message: "Promo deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting promo", error: err.message });
    }
};

// -------------------------------------------- NOTIFICATION ---------------------------------------
exports.getAllNotification = async (req, res) => {
    try {
        const adminId = req.user.id;

        const notifications = await Notification.find({
            "receiver.userId": adminId,
            "receiver.role": "admin",
        })
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
        res.status(500).json({
            success: false,
            message: "Error to fetching notifications",
            error: error
        })
    }
}

exports.readNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const adminId = req.user.id;

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": adminId,
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

exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const adminId = req.user.id;

        //  Await जरूरी है
        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": adminId,
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


// ------------ 
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

        const atoll = await Atolls.findById(atollId);
        if (!atoll) {
            return res.status(404).json({
                success: false,
                message: "No atoll found"
            })
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
        const { name } = req.body; // Expecting a single bedroom type string

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide a bedroom name.'
            });
        }

        // Save to DB
        const bedroom = new Bedroom({ name: name.trim() });
        await bedroom.save();

        res.status(200).json({
            success: true,
            message: 'Bedroom type added successfully.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding bedroom name.',
            error: error.message
        });
    }
};
