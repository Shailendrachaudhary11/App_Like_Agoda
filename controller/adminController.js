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
const sendEmail = require("../utils/sendEmail")

const BASE_URL = process.env.BASE_URL;

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
        const adminUser = await AdminUser.findOne({ email: email.toLowerCase() }).lean();
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

        if (!adminId) {
            return res.status(400).json({
                success: false,
                message: "Admin ID is missing in request.",
                data: null,
            });
        }

        const admin = await AdminUser.findById(adminId)
            .select("-password -__v") // exclude sensitive/unnecessary fields
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
        const guestOwners = await User.find({ role: "guesthouse" }).select("-password").select("-role").select("-otp").select("-otpExpiry");;

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
            .select("-password -__v -role")
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
        console.log("Fetching all guesthouses");

        const guesthouses = await Guesthouse.find()
            .sort({ createdAt: -1 });

        // Convert image into full URL
        const formattedGuestHouses = guesthouses.map(gh => {
            const ghObj = gh.toObject();

            // GuestHouse Images
            if (ghObj.guestHouseImage) {
                ghObj.guestHouseImage = ghObj.guestHouseImage.map(img =>
                    `${BASE_URL}/uploads/guestHouseImage/${img.trim()}`
                );
            }

            // Owner profile image
            if (ghObj.owner && ghObj.owner.profileImage) {
                ghObj.owner.profileImage = `${BASE_URL}/uploads/profileImage/${ghObj.owner.profileImage}`;
            }

            return ghObj; // Important! Return the transformed object
        });

        return res.status(200).json({
            success: true,
            message: "Guesthouses fetched successfully.",
            count: formattedGuestHouses.length,
            data: formattedGuestHouses
        });
    } catch (err) {
        console.error("Error fetching guesthouses:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch guesthouses."
        });
    }
};

exports.updateGuestHouse = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, city, state, location, contactNumber, description } = req.body;

        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found",
            });
        }

        console.log(`[GUESTHOUSE] Updating guesthouse ${id} by user ${req.user?.id || "unknown"}`);

        // Handle images (optional)

        if (req.files && req.files.length > 0) {
            guesthouse.guestHouseImage = req.files.map(file => file.filename);
        }

        // Update/add fields dynamically
        const fields = { name, address, city, state, location, contactNumber, description };
        for (const key in fields) {
            if (fields[key] !== undefined && fields[key] !== null) {
                guesthouse[key] = fields[key];
            }
        }
        await guesthouse.save();

        const guesthouseId = guesthouse._id;
        await createNotification(
            { userId: req.user.id, role: req.user.role },   // sender (jo update kar raha hai)
            { userId: guesthouseId, role: "guesthouse" }, // receiver (guesthouse ko)
            "Guesthouse Updated",
            `Your guesthouse "${guesthouse.name}" has been updated successfully by admin.`,
            "system",
            { guesthouseId: guesthouse._id }
        );

        return res.status(200).json({
            success: true,
            message: "Guesthouse updated successfully.",
            data: guesthouse._id,
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
        console.log("Fetching guesthouse by ID:", id);

        const guesthouse = await Guesthouse.findById(id);

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found."
            });
        }

        const ghObj = guesthouse.toObject();

        // Handle guestHouseImage (Array or String)
        if (ghObj.guestHouseImage) {
            if (Array.isArray(ghObj.guestHouseImage)) {
                // Already array
                ghObj.guestHouseImage = ghObj.guestHouseImage.map(img =>
                    `${BASE_URL}/uploads/guestHouseImage/${img}`
                );
            } else if (typeof ghObj.guestHouseImage === "string") {
                // Comma separated string
                ghObj.guestHouseImage = ghObj.guestHouseImage
                    .split(",")
                    .map(img => `${BASE_URL}/uploads/guestHouseImage/${img.trim()}`);
            }
        }

        //  Owner Profile Image
        if (ghObj.owner && ghObj.owner.profileImage) {
            ghObj.owner.profileImage = `${BASE_URL}/uploads/adminImage/${ghObj.owner.profileImage}`;
        }

        return res.status(200).json({
            success: true,
            message: "successfully fetch your guesthouse..",
            data: ghObj
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
        const rooms = await Room.find().populate("guesthouse");

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
            roomNumber,
            title,
            description,
            amenities,
            priceWeekly,
            pricePerNight,
            priceMonthly,
            capacity
        } = req.body;

        // Check if new roomNumber already exists in this guesthouse
        if (roomNumber && roomNumber !== room.roomNumber) {
            const duplicate = await Room.findOne({
                guesthouse: room.guesthouse._id,
                roomNumber: roomNumber
            });
            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: `Room number ${roomNumber} already exists in this guesthouse.`
                });
            }
            room.roomNumber = roomNumber;
        }

        // Update other fields if provided
        if (title) room.title = title;
        if (description) room.description = description;
        if (amenities) room.amenities = amenities;
        if (pricePerNight) room.pricePerNight = pricePerNight;
        if (priceWeekly) room.priceWeekly = priceWeekly;
        if (priceMonthly) room.priceMonthly = priceMonthly;
        if (capacity) room.capacity = capacity;

        // Handle new images (replace old completely)
        if (req.files && req.files.length > 0) {
            room.photos = req.files.map(file => file.filename); // only filenames in DB
        }

        await room.save();

        // Convert photos to full URLs for frontend
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        const photosWithUrl = room.photos.map(name => `${BASE_URL}/uploads/rooms/${name}`);

        res.status(200).json({
            success: true,
            message: "Room updated successfully",
            data: {
                ...room.toObject(),
                photos: photosWithUrl
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
        const customers = await User.find({ role: "customer" }).select("-password").select("-role").select("-otp").select("-otpExpiry");

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

// exports.approvalCustomer = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const user = await User.findById(id);
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found."
//             });
//         }

//         user.status = "approved";
//         await createNotification(
//             user._id,
//             "general",
//             `Your customer registration "${user.name}" has been approved by admin.`,
//             { user: user._id }
//         );
//         await user.save();

//         return res.status(200).json({
//             success: true,
//             message: "customer approved successfully.",
//             userId: user._id,
//             role: user.role
//         });
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: "Failed to approve user.",
//             error: err.message
//         });
//     }
// };

// exports.rejectCustomer = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const user = await User.findById(id);
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found."
//             });
//         }

//         if (user.status === "reject") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Customer is already reject.",
//                 data: {
//                     id: user._id,
//                     name: user.name,
//                     ownerName: user.owner?.name,
//                     ownerEmail: user.owner?.email,
//                     status: user.status
//                 }
//             });
//         }
//         user.status = "reject";

//         user.save();
//         return res.status(200).json({
//             success: true,
//             message: "User rejected successfully.",
//             userId: user._id,
//             role: user.role
//         });
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: "Failed to reject user.",
//             error: err.message
//         });
//     }
// };

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


// -------------------------------------------- BOOKING ---------------------------------------
exports.getAllBooking = async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });

        // const totalRevenue = bookings.reduce((sum, booking) => sum + booking.amount, 0);

        return res.status(200).json({
            success: true,
            count: bookings.length,
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

exports.pastBooking = async (req, res) => {
    try {
        const today = new Date();

        const pastBookings = await Booking.find({
            checkOut: { $lt: today }, // booking already ended
        })
            .populate("guesthouse", "name location")
            .populate("room", "roomNumber title pricePerNight")
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
            count: pastBooking.length,
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

        const upcomingBookings = await Booking.find({
            checkIn: { $gt: today }
        })
            .populate("guesthouse", "name location")
            .populate("room", "roomNumber title pricePerNight")
            .sort({ checkIn: 1 });

        if (upcomingBookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No upcoming booking found"
            })
        }

        res.status(200).json({
            success: true,
            message: "Successfully fetch upcoming Bookings",
            count: upcomingBookings.length,
            data: upcomingBookings
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to fetching upcoming booking.",
            Error: error
        })
    }
}

// -------------------------------------------- PROMOS ---------------------------------------
exports.getAllPromo = async (req, res) => {
    try {
        const promos = await Promo.find();
        res.status(200).json({
            success: true,
            count: promos.length,
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
        const promo = await Promo.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
        res.status(200).json({ success: true, message: "Promo updated successfully", data: promo });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error updating promo", error: err.message });
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
