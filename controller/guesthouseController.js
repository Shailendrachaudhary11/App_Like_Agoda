const Guesthouse = require("../models/Guesthouse");
const Room = require("../models/Room");
const Booking = require("../models/Booking")
const Review = require("../models/review")
const Notification = require("../models/notification");
const createNotification = require("../utils/notificationHelper");
const User = require("../models/user");
const Facility = require("../models/Facility");
const getRemainingTime = require("../utils/remainingTime");
const Payment = require("../models/Payment")
const RoomCategory = require("../models/RoomCategory");
const BedType = require("../models/BedType");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Atoll = require("../models/Atoll");
const Island = require("../models/Island");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const PayoutRequest = require("../models/PayoutRequest")


const BASE_URL = process.env.BASE_URL;

const calculateWalletBalance = async (guesthouseId) => {

    // 1. Total Earnings from Paid Payments
    const bookings = await Booking.find({ guesthouse: guesthouseId }).select("_id");
    if (!bookings.length) return 0;

    const bookingIds = bookings.map(b => b._id);

    const payments = await Payment.find({
        booking: { $in: bookingIds },
        paymentStatus: "paid"
    });

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);


    // 2. Total Approved Payout Requests
    const approvedPayouts = await PayoutRequest.find({
        guesthouse: guesthouseId,
        status: "Approved"
    });

    const totalApproved = approvedPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);


    // 3. Total Pending Payout Requests  (Yeh Pahle Minus Nahi Ho Raha Tha)
    const pendingPayouts = await PayoutRequest.find({
        guesthouse: guesthouseId,
        status: "Pending"
    });

    const totalPending = pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);


    // ⭐ Final Wallet = Paid - (Pending + Approved)
    return totalPaid - (totalPending + totalApproved);
};


// -------------------------------- GUESTHOUSE --------------------------------


// exports.manageGuestHouse = async (req, res) => {
//     try {
//         const ownerId = req.user._id;
//         const {
//             name,
//             address,
//             location,
//             contactNumber,
//             description,
//             price,
//             facilities,
//             atolls,
//             islands,
//             cleaningFee,
//             taxPercent,
//             latitude,
//             longitude
//         } = req.body;

//         console.log(`[GUESTHOUSE] Managing guesthouse by user ${ownerId}`);

//         //  Step 1: Check if guesthouse already exists
//         let guesthouse = await Guesthouse.findOne({ owner: ownerId });

//         //  Step 2: If guesthouse exists → skip validation, only update fields
//         if (guesthouse) {
//             console.log("[UPDATE] Existing guesthouse found, skipping validation...");


//             let locObj = guesthouse?.location || null;

//             if (req.body.latitude && req.body.longitude) {
//                 const lat = parseFloat(req.body.latitude);
//                 const lng = parseFloat(req.body.longitude);
//                 if (!isNaN(lat) && !isNaN(lng)) {
//                     locObj = {
//                         type: "Point",
//                         coordinates: [lng, lat]
//                     };
//                 }
//             } else if (req.body.location) {
//                 // If user sent a location object
//                 const loc = typeof req.body.location === "string" ? JSON.parse(req.body.location) : req.body.location;
//                 if (loc?.type === "Point" && Array.isArray(loc.coordinates)) {
//                     locObj = loc;
//                 }
//             }


//             // Update images (if new ones provided)
//             let images = guesthouse.guestHouseImage;
//             if (req.files && req.files.length > 0) {
//                 images = req.files.map(file => file.filename);
//             }

//             // Parse facilities (if provided)
//             let facilityIds = guesthouse.facilities;
//             if (facilities) {
//                 let facArr = Array.isArray(facilities)
//                     ? facilities
//                     : JSON.parse(facilities);

//                 const validFacilityIds = [];
//                 for (const id of facArr) {
//                     if (!id) continue;
//                     const exists = await Facility.findById(id);
//                     if (exists) validFacilityIds.push(exists._id);
//                 }

//                 //  Merge old + new facilities and remove duplicates
//                 const mergedFacilities = new Set([
//                     ...guesthouse.facilities.map(f => f.toString()),
//                     ...validFacilityIds.map(f => f.toString())
//                 ]);
//                 facilityIds = Array.from(mergedFacilities);
//             }

//             // Dynamic update object
//             const updateData = {};

//             if (name?.trim()) updateData.name = name;
//             if (address?.trim()) updateData.address = address;
//             if (description?.trim()) updateData.description = description;

//             if (contactNumber && /^\d{7,15}$/.test(contactNumber))
//                 updateData.contactNumber = contactNumber;

//             if (atolls && mongoose.Types.ObjectId.isValid(atolls))
//                 updateData.atolls = atolls;

//             if (islands && mongoose.Types.ObjectId.isValid(islands))
//                 updateData.islands = islands;

//             // Numeric fields — skip if empty or invalid
//             if (price !== "" && !isNaN(price) && Number(price) > 0)
//                 updateData.price = Number(price);

//             if (cleaningFee !== "" && !isNaN(cleaningFee) && Number(cleaningFee) >= 0)
//                 updateData.cleaningFee = Number(cleaningFee);

//             if (
//                 taxPercent !== "" &&
//                 !isNaN(taxPercent) &&
//                 Number(taxPercent) >= 0 &&
//                 Number(taxPercent) <= 100
//             )
//                 updateData.taxPercent = Number(taxPercent);

//             // Location, facilities, and images
//             if (locObj) updateData.location = locObj;

//             if (facilityIds && facilityIds.length > 0)
//                 updateData.facilities = facilityIds;

//             if (req.files && req.files.length > 0)
//                 updateData.guestHouseImage = req.files.map(f => f.filename);

//             // Apply updates safely
//             guesthouse.set(updateData);
//             await guesthouse.save();

//             return res.status(200).json({
//                 success: true,
//                 message: "Guesthouse updated successfully.",
//                 data: { guesthouseId: guesthouse._id }
//             });
//         }

//         //  Step 3: If guesthouse not found → perform full validation
//         console.log("[CREATE] No guesthouse found, performing full validation...");

//         // ---- Full Validation for New Creation ---- //
//         if (!name || name.trim() === "")
//             return res.status(400).json({ success: false, message: "Guesthouse name is required" });

//         if (!address || address.trim() === "")
//             return res.status(400).json({ success: false, message: "Address is required" });

//         if (!contactNumber || !/^\d{7,15}$/.test(contactNumber))
//             return res.status(400).json({ success: false, message: "Valid contact number (7-15 digits) is required" });

//         if (!islands)
//             return res.status(400).json({ success: false, message: "Island is required" });

//         if (!atolls)
//             return res.status(400).json({ success: false, message: "Atoll is required" });

//         if (!req.files || req.files.length === 0)
//             return res.status(400).json({ success: false, message: "At least 1 image is required" });

//         const atoll = await Atoll.findById(atolls);
//         if (!atoll)
//             return res.status(404).json({ success: false, message: "Atoll not found" });

//         const island = await Island.find({ atoll: atolls, _id: islands });
//         if (island.length === 0)
//             return res.status(404).json({ success: false, message: "No islands found for this atoll" });

//         if (!price || isNaN(price) || price <= 0)
//             return res.status(400).json({ success: false, message: "Valid price is required" });

//         if (taxPercent != null && (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100))
//             return res.status(400).json({ success: false, message: "Tax percent must be between 0 and 100" });

//         if (cleaningFee != null && (isNaN(cleaningFee) || cleaningFee < 0))
//             return res.status(400).json({ success: false, message: "Cleaning fee must be a positive number" });

//         const images = req.files.map(file => file.filename);

//         // Parse and validate location
//         let locObj = null;
//         if (location || req.body.latitude || req.body.longitude) {
//             let lat = parseFloat(req.body.latitude);
//             let lng = parseFloat(req.body.longitude);
//             if (!isNaN(lat) && !isNaN(lng)) {
//                 locObj = { type: "Point", coordinates: [lng, lat] };
//             }
//         }

//         // Validate facilities
//         let facilityIds = [];
//         if (facilities) {
//             let facArr = Array.isArray(facilities) ? facilities : JSON.parse(facilities);
//             for (const id of facArr) {
//                 const exists = await Facility.findById(id);
//                 if (exists) facilityIds.push(exists._id);
//             }
//         }

//         // Check duplicate name
//         const dup = await Guesthouse.findOne({ name });
//         if (dup)
//             return res.status(400).json({ success: false, message: "Guesthouse name must be unique" });

//         //  Step 4: Create new guesthouse
//         const gh = new Guesthouse({
//             owner: ownerId,
//             name,
//             address,
//             location: locObj,
//             contactNumber,
//             description,
//             price,
//             guestHouseImage: images,
//             facilities: facilityIds,
//             atolls,
//             islands,
//             taxPercent,
//             cleaningFee
//         });

//         await gh.save();

//         return res.status(201).json({
//             success: true,
//             message: "Guesthouse created successfully.",
//             data: { guesthouseId: gh._id }
//         });

//     } catch (err) {
//         console.error("[GUESTHOUSE] Error:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error while managing guesthouse",
//             error: err.message,
//         });
//     }
// };

exports.manageGuestHouse = async (req, res) => {
    try {
        const ownerId = req.user._id;
        let {
            name,
            address,
            location,
            contactNumber,
            description,
            price,
            facilities,
            atolls,
            islands,
            cleaningFee,
            taxPercent,
            latitude,
            longitude
        } = req.body;

        console.log(`[GUESTHOUSE] Managing guesthouse by user ${ownerId}`);

        name = (name || "").toString().trim();
        if (name.length > 0) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        address = (address || "").toString().trim();
        if (address.length > 0) {
            address = address.charAt(0).toUpperCase() + address.slice(1);
        }

        description = (description || "").toString().trim();
        if (description.length > 0) {
            description = description.charAt(0).toUpperCase() + description.slice(1);
        }

        contactNumber = contactNumber?.trim() || "";
        atolls = (atolls ?? "").toString().trim();
        islands = (islands ?? "").toString().trim();
        latitude = latitude ?? 0;
        longitude = longitude ?? 0;


        //  Step 1: Check if guesthouse already exists
        let guesthouse = await Guesthouse.findOne({ owner: ownerId });

        //  Step 2: If guesthouse exists → skip validation, only update fields
        if (guesthouse) {
            console.log("[UPDATE] Existing guesthouse found, skipping validation...");

            //  Fix location object handling
            let locObj = guesthouse.location || null;

            if (latitude && longitude) {
                const lat = parseFloat(latitude);
                const lng = parseFloat(longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    locObj = {
                        type: "Point",
                        coordinates: [lng, lat],
                    };
                }
            } else if (location) {
                try {
                    const loc = typeof location === "string" ? JSON.parse(location) : location;
                    if (loc?.type === "Point" && Array.isArray(loc.coordinates)) {
                        locObj = loc;
                    }
                } catch (err) {
                    console.warn("Invalid location format:", location);
                }
            }

            // Update images (if new ones provided)
            let images = guesthouse.guestHouseImage;
            if (req.files && req.files.length > 0) {
                images = req.files.map(file => file.filename);
            }

            // Parse facilities (if provided)
            // let facilityIds = guesthouse.facilities;
            // if (facilities) {
            //     let facArr = Array.isArray(facilities)
            //         ? facilities
            //         : JSON.parse(facilities);

            //     const validFacilityIds = [];
            //     for (const id of facArr) {
            //         if (!id) continue;
            //         const exists = await Facility.findById(id);
            //         if (exists) validFacilityIds.push(exists._id);
            //     }

            //     //  Merge old + new facilities and remove duplicates
            //     const mergedFacilities = new Set([
            //         ...guesthouse.facilities.map(f => f.toString()),
            //         ...validFacilityIds.map(f => f.toString())
            //     ]);
            //     facilityIds = Array.from(mergedFacilities);
            // }

            // let facilityIds = guesthouse.facilities;

            // //  Replace old facilities completely with new ones
            // if (facilities) {
            //     let facArr = Array.isArray(facilities)
            //         ? facilities
            //         : JSON.parse(facilities);

            //     const validFacilityIds = [];
            //     for (const id of facArr) {
            //         if (!id) continue;
            //         const exists = await Facility.findById(id);
            //         if (exists) validFacilityIds.push(exists._id);
            //     }

            //     // 🧹 Replace old facilities with new ones (no merge)
            //     facilityIds = validFacilityIds;
            // }

            let facilityIds = [];

            if (facilities) {
                let facArr;

                // Convert incoming to string and remove spaces
                let cleanString = facilities.toString().trim();

                // If it's empty, skip
                if (cleanString === "" || cleanString === "[]") {
                    facArr = [];
                } else {
                    // Try parsing JSON
                    try {
                        facArr = Array.isArray(facilities) ? facilities : JSON.parse(cleanString);
                    } catch (err) {
                        facArr = [];
                    }
                }

                // Validate ObjectIds
                const validFacilityIds = [];
                for (const id of facArr) {
                    if (!id || typeof id !== "string") continue;

                    if (mongoose.Types.ObjectId.isValid(id)) {
                        const exists = await Facility.findById(id);
                        if (exists) validFacilityIds.push(exists._id);
                    }
                }

                facilityIds = validFacilityIds;
            }



            // Dynamic update object
            const updateData = {};


            if (name) updateData.name = name;
            if (address) updateData.address = address;
            if (description) updateData.description = description;


            if (contactNumber && /^\d{7,15}$/.test(contactNumber))
                updateData.contactNumber = contactNumber;

            if (atolls && mongoose.Types.ObjectId.isValid(atolls))
                updateData.atolls = atolls;

            if (islands && mongoose.Types.ObjectId.isValid(islands))
                updateData.islands = islands;

            // Numeric fields — skip if empty or invalid
            if (price !== "" && !isNaN(price) && Number(price) > 0)
                updateData.price = Number(price);

            if (cleaningFee !== "" && !isNaN(cleaningFee) && Number(cleaningFee) >= 0)
                updateData.cleaningFee = Number(cleaningFee);

            if (
                taxPercent !== "" && !isNaN(taxPercent) && Number(taxPercent) >= 0 && Number(taxPercent) <= 100
            )
                updateData.taxPercent = Number(taxPercent);

            //  Location, facilities, and images
            // if (locObj && locObj.coordinates && locObj.coordinates.length === 2)
            //     updateData.location = locObj;

            if (locObj && locObj.coordinates?.length === 2)
                updateData.location = locObj;

            // if (facilityIds && facilityIds.length > 0)
            //     updateData.facilities = facilityIds;

            if (facilityIds?.length > 0)
                updateData.facilities = facilityIds;


            if (req.files && req.files.length > 0)
                updateData.guestHouseImage = req.files.map(f => f.filename);

            // Apply updates safely
            guesthouse.set(updateData);
            await guesthouse.save();

            console.log("[UPDATE SUCCESS] Guesthouse updated successfully with location:", locObj);

            return res.status(200).json({
                success: true,
                message: "Guesthouse updated successfully.",
                data: { guesthouseId: guesthouse._id }
            });
        }

        //   Step 3: If guesthouse not found → perform full validation
        // console.log("[CREATE] No guesthouse found, performing full validation...");

        // // ---- Full Validation for New Creation ---- //
        // if (!name || name.trim() === "")
        //     return res.status(400).json({ success: false, message: "Guesthouse name is required" });

        // if (!address || address.trim() === "")
        //     return res.status(400).json({ success: false, message: "Address is required" });

        // if (!contactNumber || !/^\d{7,15}$/.test(contactNumber))
        //     return res.status(400).json({ success: false, message: "Valid contact number (7-15 digits) is required" });

        // if (!islands)
        //     return res.status(400).json({ success: false, message: "Island is required" });

        // if (!atolls)
        //     return res.status(400).json({ success: false, message: "Atoll is required" });

        // if (!req.files || req.files.length === 0)
        //     return res.status(400).json({ success: false, message: "At least 1 image is required" });

        // const atoll = await Atoll.findById(atolls);
        // if (!atoll)
        //     return res.status(404).json({ success: false, message: "Atoll not found" });

        // const island = await Island.find({ atoll: atolls, _id: islands });
        // if (island.length === 0)
        //     return res.status(404).json({ success: false, message: "No islands found for this atoll" });

        // if (!price || isNaN(price) || price <= 0)
        //     return res.status(400).json({ success: false, message: "Valid price is required" });

        if (!name) return res.status(400).json({ success: false, message: "Guesthouse name is required" });
        if (!address) return res.status(400).json({ success: false, message: "Address is required" });
        if (!contactNumber || !/^\d{7,15}$/.test(contactNumber))
            return res.status(400).json({ success: false, message: "Valid contact number is required" });
        if (!islands) return res.status(400).json({ success: false, message: "Island is required" });
        if (!atolls) return res.status(400).json({ success: false, message: "Atoll is required" });
        if (!req.files?.length)
            return res.status(400).json({ success: false, message: "At least 1 image is required" });

        const atoll = await Atoll.findById(atolls);
        if (!atoll) return res.status(404).json({ success: false, message: "Atoll not found" });

        const island = await Island.find({ atoll: atolls, _id: islands });
        if (island.length === 0)
            return res.status(404).json({ success: false, message: "No islands found for this atoll" });

        if (!price || isNaN(price) || price <= 0)
            return res.status(400).json({ success: false, message: "Valid price is required" });

        if (taxPercent != null && (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100))
            return res.status(400).json({ success: false, message: "Tax percent must be between 0 and 100" });

        if (cleaningFee != null && (isNaN(cleaningFee) || cleaningFee < 0))
            return res.status(400).json({ success: false, message: "Cleaning fee must be a positive number" });

        const images = req.files.map(file => file.filename);

        //  Parse and validate location for new guesthouse
        let locObj = null;
        if (latitude && longitude) {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                locObj = { type: "Point", coordinates: [lng, lat] };
            }
        }

        // Validate facilities
        let facilityIds = [];
        if (facilities) {
            let facArr = Array.isArray(facilities) ? facilities : JSON.parse(facilities);
            for (const id of facArr) {
                const exists = await Facility.findById(id);
                if (exists) facilityIds.push(exists._id);
            }
        }

        // Check duplicate name
        const dup = await Guesthouse.findOne({ name });
        if (dup)
            return res.status(400).json({ success: false, message: "Guesthouse name must be unique" });

        //  Step 4: Create new guesthouse
        const gh = new Guesthouse({
            owner: ownerId,
            name,
            address,
            location: locObj,
            contactNumber,
            description,
            price,
            guestHouseImage: images,
            facilities: facilityIds,
            atolls,
            islands,
            taxPercent,
            cleaningFee
        });

        await gh.save();

        console.log("[CREATE SUCCESS] Guesthouse created successfully with location:", locObj);

        return res.status(201).json({
            success: true,
            message: "Guesthouse created successfully.",
            data: { guesthouseId: gh._id }
        });

    } catch (err) {
        console.error("[GUESTHOUSE] Error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error while managing guesthouse",
            error: err.message,
        });
    }
};


exports.getMyGuesthouse = async (req, res) => {
    try {
        const guesthouse = await Guesthouse.findOne({
            owner: req.user._id,
            status: "active",
        })
            .populate({
                path: "atolls",
                select: "name -_id",
            })
            .populate({
                path: "islands",
                select: "name -_id",
            })
            .populate({
                path: "facilities",
                select: "name -_id",
            })
            .select(
                "name address location  contactNumber description guestHouseImage status price cleaningFee taxPercent atolls islands facilities createdAt"
            )
            .lean();

        if (!guesthouse) {
            return res.status(200).json({
                success: true,
                message: "No approved guesthouse found",
                data: null,
            });
        }

        // 🔹 Convert facilities to simple array of names
        const facilitiesArray = guesthouse.facilities?.map((f) => f.name) || [];

        const formattedData = {
            ...guesthouse,
            atolls: guesthouse.atolls?.name || "",
            islands: guesthouse.islands?.name || "",
            facilities: facilitiesArray,
            guestHouseImage: guesthouse.guestHouseImage?.map(
                (img) => `${BASE_URL}/uploads/guestHouseImage/${img}`
            ),
        };

        return res.status(200).json({
            success: true,
            message: "Guesthouse fetched successfully",
            data: formattedData,
        });
    } catch (err) {
        console.error("Error fetching guesthouse:", err.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message,
        });
    }
};

// -------------------------------- ROOM --------------------------------

exports.getRoomOptions = async (req, res) => {
    try {
        const categories = await RoomCategory.find({ status: "active" }).select("name").sort("name");
        const bedTypes = await BedType.find({ status: "active" }).select("name").sort("name");
        const maxOccupancyOptions = [1, 2, 3, 4, 5];

        return res.status(200).json({
            success: true,
            message: "successfully fetch room options",
            data: {
                categories,
                bedTypes,
                maxOccupancyOptions
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.addRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;

        let {
            roomCategory,
            bedType,
            capacity,
            description,
            facilities,
            pricePerNight,
            priceWeekly,
            priceMonthly,
            availability
        } = req.body;

        // Required field validation
        if (
            !roomCategory || roomCategory.trim() === "" ||
            !bedType || bedType.trim() === "" ||
            !capacity || capacity === "" ||
            !description || description.trim() === "" ||
            !facilities || facilities.length === 0 ||
            !pricePerNight || pricePerNight === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields with valid values.",
            });
        }

        if (isNaN(capacity) || capacity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Capacity must be a valid positive number.",
            });
        }

        if (isNaN(pricePerNight) || pricePerNight <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price per night must be a valid positive number.",
            });
        }

        if (priceWeekly && (isNaN(priceWeekly) || priceWeekly < 0)) {
            return res.status(400).json({
                success: false,
                message: "Weekly price must be a valid number.",
            });
        }

        if (priceMonthly && (isNaN(priceMonthly) || priceMonthly < 0)) {
            return res.status(400).json({
                success: false,
                message: "Monthly price must be a valid number.",
            });
        }

        //  Find active guesthouse owned by user
        const guesthouse = await Guesthouse.findOne({
            owner: ownerId,
            status: "active",
        }).sort({ createdAt: -1 });

        if (!guesthouse) {
            return res.status(403).json({
                success: false,
                message: "Guesthouse not found, not approved, or unauthorized.",
            });
        }

        const guesthouseId = guesthouse._id;

        //  Parse facilities (should be ObjectIds array)
        let facilitiesArray = [];
        try {
            if (typeof facilities === "string") {
                const parsed = JSON.parse(facilities);
                facilitiesArray = Array.isArray(parsed)
                    ? parsed
                    : facilities.split(",").map(f => f.trim()).filter(f => f !== "");
            } else if (Array.isArray(facilities)) {
                facilitiesArray = facilities.filter(f => f !== "");
            }
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Invalid facilities format. Must be an array of ObjectIds or strings.",
            });
        }

        if (!Array.isArray(facilitiesArray) || facilitiesArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one facility is required.",
            });
        }


        //  Validate uploaded photos
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one room photo is required.",
            });
        }

        const photos = req.files.map((f) => f.filename);

        //  Handle and format availability dates
        let formattedAvailability = [];

        if (!availability || availability.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide availability dates for the room.",
            });
        }

        try {
            const parsedAvailability =
                typeof availability === "string" ? JSON.parse(availability) : availability;

            if (!Array.isArray(parsedAvailability) || parsedAvailability.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Availability must be a non-empty array of dates.",
                });
            }
            formattedAvailability = parsedAvailability.map((slot) => {
                const dateValue =
                    typeof slot === "string"
                        ? new Date(slot)
                        : new Date(slot.date || slot);
                if (isNaN(dateValue)) {
                    throw new Error("Invalid date format in availability array");
                }
                return { date: dateValue, isAvailable: true };
            });
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Invalid availability format. Must be an array of valid dates (YYYY-MM-DD).",
            });
        }

        //  Create new Room document
        const newRoom = new Room({
            guesthouse: guesthouseId,
            roomCategory: roomCategory.trim(),
            bedType: bedType.trim(),
            capacity,
            description: description.trim(),
            facilities: facilitiesArray,
            pricePerNight,
            priceWeekly: priceWeekly || null,
            priceMonthly: priceMonthly || null,
            photos,
            active: "active",
            availability: formattedAvailability,
        });
        await newRoom.save();

        // //  Construct photo URLs for frontend
        // const photosWithUrl = photos.map(
        //     (name) => `${BASE_URL}/uploads/rooms/${name}`
        // );

        // const masterAdmin = await Admin.findOne({ role: "admin" });
        // if (masterAdmin) {
        //     await createNotification(
        //         { userId: ownerId, role: "guesthouse" },
        //         { userId: masterAdmin._id, role: "admin" },
        //         "New room added",
        //         `Room added by "${guesthouse.name}".`,
        //         "system"
        //     );
        // }

        //  Success response
        return res.status(201).json({
            success: true,
            message: "Room added successfully with availability.",
            roomId: newRoom._id,
        });

    } catch (err) {
        console.error("[ROOM] Add error:", err);
        return res.status(500).json({
            success: false,
            message: "Error adding room.",
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

        const rooms = await Room.find({ guesthouse: guesthouse._id })
            .populate("roomCategory", "name description")
            .populate("bedType", "name")
            .populate("facilities", "name")
            .sort({ createdAt: 1 })
            .lean();

        if (!rooms.length) {
            return res.status(404).json({
                success: false,
                message: "No rooms found for this guesthouse",
            });
        }

        // Group by roomCategory
        const groupedRooms = {};

        rooms.forEach(room => {
            const categoryId = room.roomCategory?._id?.toString() || "uncategorized";
            const categoryName = room.roomCategory?.name || "Uncategorized";
            const categoryDescription = room.roomCategory?.description || "No description available";

            if (!groupedRooms[categoryId]) {
                groupedRooms[categoryId] = {
                    category_id: categoryId,
                    category_name: categoryName,
                    category_description: categoryDescription,
                    rooms: []
                };
            }

            const roomImage = room.photos?.length
                ? `${BASE_URL}/uploads/rooms/${room.photos[0]}`
                : null;


            groupedRooms[categoryId].rooms.push({
                room_id: room._id,
                room_description: room.description,
                price_per_night: room.pricePerNight,
                price_per_week: room.priceWeekly,
                price_per_month: room.priceMonthly,
                bed: room.bedType?.name || null,
                facilities: (room.facilities || []).map(f => f.name),
                image: roomImage //  single image only
            });
        });

        const groupedArray = Object.values(groupedRooms);

        return res.status(200).json({
            success: true,
            message: "Available rooms fetched successfully",
            NoOfRooms: rooms.length,
            data: groupedArray
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

exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.body; // or req.params.roomId

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "Room ID is required.",
            });
        }

        const room = await Room.findById(roomId)
            .populate("roomCategory", "name")
            .populate("bedType", "name")
            .populate("facilities", "name");

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "No Room found",
            });
        }

        //  Convert to plain object to safely modify fields
        const roomObj = room.toObject();

        //  Single image instead of array
        const roomUrl = roomObj.photos.map(photo => {
            return `${BASE_URL}/uploads/rooms/${photo}`;
        })


        //  Format availability (remove time)
        const formattedAvailability = (roomObj.availability || [])
            .map(item => ({
                _id: item._id,
                date: new Date(item.date).toISOString().split("T")[0], // only date (YYYY-MM-DD)
                isAvailable: item.isAvailable,
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        //  Replace references with readable names
        const facilityNames = roomObj.facilities.map(f => f.name);
        const bedTypeName = roomObj.bedType?.name || null;
        const roomCategoryName = roomObj.roomCategory?.name || null;

        //  Final formatted response
        const responseData = {
            ...roomObj,
            facilities: facilityNames,
            bedType: bedTypeName,
            roomCategory: roomCategoryName,
            availability: formattedAvailability,
            photos: roomUrl, // single image string
        };

        return res.status(200).json({
            success: true,
            message: "Room fetched successfully.",
            data: responseData,
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

exports.updateRoom = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(404).json({
                success: false,
                message: "roomId not found"
            });
        }

        // Find room by ID
        const room = await Room.findById(roomId);
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
            description,
            facilities,
            pricePerNight,
            priceWeekly,
            priceMonthly,
            availability,
        } = req.body;

        //  Simple validation: update only if not empty
        if (roomCategory && roomCategory.trim() !== "") room.roomCategory = roomCategory;
        if (bedType && bedType.trim() !== "") room.bedType = bedType;
        if (capacity && capacity !== "") room.capacity = capacity;
        if (description && description.trim() !== "") room.description = description;
        if (pricePerNight && pricePerNight !== "") room.pricePerNight = pricePerNight;
        if (priceWeekly && priceWeekly !== "") room.priceWeekly = priceWeekly;
        if (priceMonthly && priceMonthly !== "") room.priceMonthly = priceMonthly;


        //  Facilities (merge old + new, don't delete old)
        if (facilities && facilities.length > 0) {
            try {
                // Parse if it's a string
                const parsedFacilities =
                    typeof facilities === "string" ? JSON.parse(facilities) : facilities;

                if (Array.isArray(parsedFacilities) && parsedFacilities.length > 0) {
                    //  Merge old + new facilities and remove duplicates
                    const mergedFacilities = new Set([
                        ...(room.facilities || []).map(f => f.toString()),
                        ...parsedFacilities.map(f => f.toString())
                    ]);
                    room.facilities = Array.from(mergedFacilities);
                }
            } catch (err) {
                console.error("Invalid facilities format:", err.message);
            }
        }


        //  Availability (update only if not empty)
        if (availability && availability.length > 0) {
            try {
                const parsedAvailability =
                    typeof availability === "string"
                        ? JSON.parse(availability)
                        : availability;

                if (Array.isArray(parsedAvailability) && parsedAvailability.length > 0) {
                    // Format new dates
                    const formattedAvailability = parsedAvailability.map((slot) => {
                        const dateValue =
                            typeof slot === "string"
                                ? new Date(slot)
                                : new Date(slot.date || slot);
                        return { date: dateValue, isAvailable: true };
                    });

                    const existingDates = room.availability.map(a => new Date(a.date).toISOString().split("T")[0]);
                    const newEntries = [];

                    formattedAvailability.forEach(a => {
                        const dateStr = new Date(a.date).toISOString().split("T")[0];
                        if (!existingDates.includes(dateStr)) {
                            newEntries.push(a);
                        }
                    });

                    room.availability = [...room.availability, ...newEntries];
                }
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid availability format. Must be an array of valid dates (YYYY-MM-DD).",
                });
            }
        }


        //  Handle new images (replace only if uploaded)
        if (req.files && req.files.length > 0) {
            room.photos = req.files.map(file => file.filename);
        }

        await room.save();

        res.status(200).json({
            success: true,
            message: "Room updated successfully",
            roomId: room._id
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

exports.activeInActive = async (req, res) => {
    try {
        let roomId = req.body.roomId;
        if (!roomId) {
            res.status(400).json({
                success: false,
                message: "RoomId not found."
            })
        }
        const room = await Room.findById(roomId);

        if (!room) {
            res.status(404).json({
                sucess: false,
                message: "Room not found"
            })
        }
        if (room.active === "active") {
            room.active = "inactive";
        }
        else {
            room.active = "active"
        }

        await room.save();

        res.status(200).json({
            success: true,
            message: `Successfully room is: ${room.active}`
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error to active or inactive room.",
            error: error
        })
    }
}

exports.deleteRoom = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { roomId } = req.body;

        const guesthouse = await Guesthouse.findOne({ owner: ownerId });
        if (!guesthouse) return res.status(403).json({ success: false, message: "No guest house found" });

        const room = await Room.findOne({ _id: roomId, guesthouse: guesthouse._id });
        if (!room) return res.status(404).json({ success: false, message: "Room not found in this guesthouse" });

        await Room.findByIdAndDelete(roomId);

        return res.status(200).json({
            success: true,
            message: `Room deleted successfully`
        });
    } catch (err) {
        console.error("[ROOM] Delete error:", err);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

exports.getDisableRooms = async (req, res) => {
    try {
        const userId = req.user.id;
        const guesthouse = await Guesthouse.findOne({ owner: userId });

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No Guesthouse details found",
            });
        }

        const rooms = await Room.find({ guesthouse: guesthouse._id, active: "inactive" }).sort({ createdAt: -1 }); // latest first;

        const roomsWithFullUrl = rooms.map(room => {
            // room ke photos ko map karo aur full URL banao
            const photosWithFullUrl = room.photos.map(img => `${baseUrl}/uploads/rooms/${img}`);

            return {
                ...room.toObject(),
                photos: photosWithFullUrl // original photos array replace
            };
        });

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
            message: "Disable Rooms fetched successfully",
            data: roomsWithFullUrl,
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

// -------------------------------- BOOKING --------------------------------

exports.getAllBookings = async (req, res) => {
    try {
        const guestHouseOwnerId = req.user.id;

        const guestHouse = await Guesthouse.findOne({ owner: guestHouseOwnerId });
        const guestHouseId = guestHouse._id;

        const { status } = req.body || {}; // optional filter

        let query = { guesthouse: guestHouseId };

        if (status === "upcoming") {
            query.status = "confirmed"
        }

        else if (status === "past") {
            query.status = { $in: ["completed", "cancelled"] };
        }

        let bookings = await Booking.find(query)
            .populate({
                path: "customer",
                select: "name",
            })
            .populate({
                path: "room",
                populate: {
                    path: "roomCategory",
                    select: "name"
                }
            });


        // Auto-update confirmed bookings to 'completed' if checkOut < today
        const today = new Date();
        for (let booking of bookings) {
            if (booking.status === "confirmed" && new Date(booking.checkOut) < today) {
                booking.status = "completed";
                await booking.save();
            }
        }

        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const formattedBookings = await Promise.all(
            bookings.map(async (booking) => {

                const checkIn = new Date(booking.checkIn);
                const checkOut = new Date(booking.checkOut);
                const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

                let statusFormatted = booking.status
                    ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                    : "Pending";
                let roomCategories = [];

                // If multiple room IDs are present
                if (Array.isArray(booking.room)) {
                    const rooms = await Room.find({ _id: { $in: booking.room } })
                        .populate({ path: "roomCategory", select: "name" }); // populate name only
                    roomCategories = rooms.map(r => r.roomCategory?.name).filter(Boolean);
                }
                // If single room ID
                else if (booking.room) {
                    const room = await Room.findById(booking.room)
                        .populate({ path: "roomCategory", select: "name" });
                    if (room && room.roomCategory) roomCategories.push(room.roomCategory.name);
                }

                const room = await Room.findById(booking.room);


                return {
                    id: booking._id,
                    customerName: booking.customer?.name || "N/A",
                    status: statusFormatted,
                    checkIn: booking.checkIn
                        ? new Date(booking.checkIn).toISOString().split("T")[0]
                        : "",
                    checkOut: booking.checkOut
                        ? new Date(booking.checkOut).toISOString().split("T")[0]
                        : "",
                    nights,
                    roomCategory: roomCategories,
                    finalAmount: booking.finalAmount
                };
            })
        );


        res.status(200).json({
            success: true,
            message: "Successfully fetched your bookings.",
            count: formattedBookings.length,
            data: formattedBookings,
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Error fetching all bookings.",
            error: error.message,
        });
    }
};

exports.getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const guestHouseOwnerId = req.user.id;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID is required."
            });
        }

        const guestHouse = await Guesthouse.findOne({ owner: guestHouseOwnerId });
        if (!guestHouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found for this owner."
            });
        }

        const booking = await Booking.findOne({
            _id: bookingId,
            guesthouse: guestHouse._id,
        })
            .populate({
                path: "room",
                populate: { path: "roomCategory", select: "name" },
                select: "roomCategory price"
            })
            .populate({
                path: "customer",
                select: "name phone email profileImage",
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // Payment Details
        const payment = await Payment.findOne({ booking: booking._id });

        // Guesthouse Image
        let guestHouseImg = "";
        if (guestHouse.guestHouseImage?.length) {
            guestHouseImg = `${BASE_URL}/uploads/guestHouseImage/${guestHouse.guestHouseImage[0].trim()}`;
        }

        // Multiple Room Types
        const roomType = Array.isArray(booking.room)
            ? booking.room.map(r => r.roomCategory?.name || "N/A")
            : [booking.room?.roomCategory.name || "N/A"];

        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const totalNights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        const paymentDetails = payment
            ? {
                paymentMethod: payment.paymentMethod || "N/A",
                paymentStatus: payment.paymentStatus || "Unpaid",
                paymentDate: payment.paymentDate
                    ? new Date(payment.paymentDate).toLocaleString("en-GB", { hour12: true })
                    : "N/A",
            }
            : {
                paymentMethod: "N/A",
                paymentStatus: "Unpaid",
                paymentDate: "N/A",
            };

        const formattedBooking = {
            bookingId: booking._id,
            customer: {
                name: booking.customer?.name || "N/A",
                phone: booking.customer?.phone || "N/A",
                email: booking.customer?.email || "N/A",
                profileImage: booking.customer?.profileImage
                    ? `${BASE_URL}/uploads/profileImage/${booking.customer.profileImage}`
                    : null,
            },
            bookingSummary: {
                room: roomType,
                guests: booking.guest,
                checkIn: checkIn.toISOString().split("T")[0],
                checkOut: checkOut.toISOString().split("T")[0],
                totalNights,
                price: booking.finalAmount,
                paymentStatus: paymentDetails.paymentStatus,
                bookingStatus: booking.status.charAt(0).toUpperCase() + booking.status.slice(1),
            },
            paymentDetails: {
                method: paymentDetails.paymentMethod,
                status: paymentDetails.paymentStatus,
                date: paymentDetails.paymentDate,
            },
        };

        return res.status(200).json({
            success: true,
            message: "Booking details fetched successfully.",
            data: formattedBooking,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching booking details.",
            error: error.message,
        });
    }
};

exports.downloadInvoice = async (req, res) => {
    try {
        const { bookingId } = req.body;

        // Fetch booking with customer & room details
        const booking = await Booking.findById(bookingId)
            .populate({ path: "customer", select: "name phone email profileImage" })
            .populate({
                path: "room",
                populate: { path: "roomCategory", select: "name" },
                select: "roomCategory price"
            })
            .populate({ path: "guesthouse", select: "name address" });

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const payment = await Payment.findOne({ booking: bookingId }) || {};

        // Ensure invoice folder exists
        const invoiceDir = path.resolve(__dirname, "../public/invoices");
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        // PDF path
        const invoicePath = path.join(invoiceDir, `guesthouse-invoice-${bookingId}.pdf`);
        const doc = new PDFDocument({ margin: 50 });
        const writeStream = fs.createWriteStream(invoicePath);
        doc.pipe(writeStream);

        // Header
        doc.fontSize(22).text("Guesthouse Booking Invoice", { align: "center", underline: true });
        doc.moveDown(1);

        // Guesthouse Info
        const guesthouse = booking.guesthouse || {};
        doc.fontSize(14).text("Guesthouse Information", { underline: true });
        doc.fontSize(12)
            .text(`Name: ${guesthouse.name || "N/A"}`)
            .text(`Address: ${guesthouse.address || "N/A"}`);
        doc.moveDown(1);

        // Customer Info
        const customer = booking.customer || {};
        const customerImage = customer.profileImage
            ? `${BASE_URL}/uploads/profileImage/${path.basename(customer.profileImage)}`
            : "N/A";

        doc.fontSize(14).text("Customer Information", { underline: true });
        doc.fontSize(12)
            .text(`Name: ${customer.name || "N/A"}`)
            .text(`Phone: ${customer.phone || "N/A"}`)
            .text(`Email: ${customer.email || "N/A"}`)
        doc.moveDown(1);

        // Booking Summary
        const checkIn = booking.checkIn ? new Date(booking.checkIn).toISOString().split("T")[0] : "N/A";
        const checkOut = booking.checkOut ? new Date(booking.checkOut).toISOString().split("T")[0] : "N/A";

        const totalNights =
            booking.nights ||
            Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)) || 0;

        const roomNames = Array.isArray(booking.room)
            ? booking.room.map(r => r.roomCategory?.name || "N/A")
            : [booking.room?.roomCategory?.name || "N/A"];

        doc.fontSize(14).text("Booking Summary", { underline: true });
        doc.fontSize(12)
            .text(`Rooms: ${roomNames.join(", ")}`)
            .text(`Guests: ${booking.guest || 0}`)
            .text(`Check-In: ${checkIn}`)
            .text(`Check-Out: ${checkOut}`)
            .text(`Total Nights: ${totalNights}`)
            .text(`Price: Rs. ${booking.finalAmount || 0}`)
            .text(`Payment Status: ${payment.paymentStatus || "N/A"}`)
            .text(`Booking Status: ${booking.status || "N/A"}`);
        doc.moveDown(1);

        // Payment Info
        doc.fontSize(14).text("Payment Details", { underline: true });
        doc.fontSize(12)
            .text(`Method: ${payment.paymentMethod || "N/A"}`)
            .text(`Status: ${payment.paymentStatus || "N/A"}`)
            .text(`Date: ${payment.paymentDate
                ? new Date(payment.paymentDate).toLocaleString("en-IN")
                : "N/A"
                }`);

        // Finalize PDF
        doc.end();

        // Wait for file write
        writeStream.on("finish", () => {
            const fileUrl = `${BASE_URL}/invoices/guesthouse-invoice-${bookingId}.pdf`;
            res.json({
                success: true,
                message: "Guesthouse invoice generated successfully.",
                url: fileUrl,
            });
        });

        writeStream.on("error", (err) => {
            console.error("PDF write error:", err);
            res.status(500).json({ success: false, message: "Error saving invoice" });
        });

    } catch (err) {
        console.error("Invoice generation error:", err);
        res.status(500).json({ success: false, message: "Error generating invoice" });
    }
};

// -------------------------------- Review ----------------------------------

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


// -------------------------------- NOTIFICATION --------------------------------

exports.getAllNotification = async (req, res) => {
    try {
        const guesthouseOwnerId = req.user.id;
        const guesthouse = await Guesthouse.findOne({ owner: guesthouseOwnerId });

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "No guesthouse found for this owner.",
            });
        }

        const guesthousId = guesthouse._id;
        // Fetch notifications, latest first
        const notifications = await Notification.find({
            "receiver.userId": guesthousId,
            "receiver.role": "guesthouse",
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

                timeOnly = date.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Kolkata"
                });
            }

            return {
                id: n._id,
                title: n.title,
                message: n.message,
                isRead: n.isRead,
                createdAt: timeOnly
            };
        });



        // Update lastNotificationCheck for the logged-in owner
        await User.updateOne(
            { _id: guesthouseOwnerId },
            { $set: { lastNotificationCheck: new Date() } }
        );


        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: "Notifications fetched successfully.",
            count: mappedNotifications.length,
            data: mappedNotifications
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Error fetching notifications.",
            error: error.message
        });
    }
}

exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;
        const guesthouseOwnerId = req.user.id;

        if (!notificationId) {
            return res.status(400).json({
                success: false,
                message: "Notification ID is required.",
            });
        }

        const guesthouse = await Guesthouse.findOne({ owner: guesthouseOwnerId });
        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found for this owner.",
            });
        }

        const guesthouseId = guesthouse._id;

        const notification = await Notification.findOne({
            _id: notificationId,
            "receiver.userId": guesthouseId,
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "No notification found for this guesthouse.",
            });
        }

        await Notification.deleteOne({ _id: notificationId });

        return res.status(200).json({
            success: true,
            message: "Notification successfully deleted.",
            notificationId,
        });
    } catch (err) {
        console.error("Delete Notification Error:", err);
        return res.status(500).json({
            success: false,
            message: "Error deleting notification.",
            error: err.message,
        });
    }
};

exports.deleteAllNotifications = async (req, res) => {
    try {
        const guesthouseOwnerId = req.user.id;

        const guesthouse = await Guesthouse.findOne({ owner: guesthouseOwnerId });

        const guesthouseId = guesthouse._id;

        const result = await Notification.deleteMany({
            "receiver.userId": guesthouseId,
            "receiver.role": "guesthouse"
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
        if (!req.user || !req.user.id) {
            return res.status(400).json({ success: false, message: "User not authenticated." });
        }

        const guesthouseOwner = await User.findById(req.user.id);
        if (!guesthouseOwner) {
            return res.status(404).json({ success: false, message: "Guesthouse owner not found." });
        }

        const lastCheck = guesthouseOwner.lastNotificationCheck || new Date(0);

        const guesthouse = await Guesthouse.findOne({ owner: guesthouseOwner._id });
        if (!guesthouse) {
            return res.status(404).json({ success: false, message: "Guesthouse not found for this owner." });
        }

        const newCount = await Notification.countDocuments({
            "receiver.userId": guesthouse._id,
            "receiver.role": "guesthouse",
            createdAt: { $gt: lastCheck }
        });

        return res.status(200).json({
            success: true,
            message: "New notification count fetched.",
            newCount
        });

    } catch (error) {
        console.error("Notification Count Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching new notification count.",
            error: error.message
        });
    }
};

//__________________________________Payment history

// exports.payoutHistory = async (req, res) => {
//     try {
//         const ownerId = req.user.id;

//         //  Find the guesthouse for this owner
//         const guesthouse = await Guesthouse.findOne({ owner: ownerId });
//         if (!guesthouse) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No guesthouse found for logged-in user"
//             });
//         }

//         const guestHouseId = guesthouse._id;

//         //  Find all bookings for this guesthouse
//         const bookings = await Booking.find({ guesthouse: guestHouseId }).select("_id");

//         if (!bookings.length) {
//             return res.status(200).json({
//                 success: true,
//                 message: "No bookings found for this guesthouse",
//                 data: []
//             });
//         }

//         const bookingIds = bookings.map(b => b._id);

//         //  Find payments for those bookings
//         const payments = await Payment.find({ booking: { $in: bookingIds } })
//             .populate({
//                 path: "booking",
//                 select: "customer",
//                 populate: {
//                     path: "customer",
//                     select: "name"
//                 }
//             })
//             .sort({ createdAt: -1 })
//             .lean();

//         if (!payments.length) {
//             return res.status(200).json({
//                 success: true,
//                 message: "No payments found for this guesthouse",
//                 data: []
//             });
//         }

//         const formatted = payments.map(p => ({
//             _id: p._id,
//             requestId: p.requestId,
//             amount: p.amount,
//             status: p.paymentStatus
//                 ? p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1).toLowerCase()
//                 : null,
//             customerName: p.booking?.customer?.name || "N/A",
//             paymentDate: p.paymentDate
//                 ? moment(p.paymentDate).tz("Asia/Kolkata").format("DD-MM-YYYY")
//                 : moment(p.createdAt).tz("Asia/Kolkata").format("DD-MM-YYYY")
//         }));


//         //  Calculate total
//         const totalAmount = formatted
//             .filter(p => p.status === "Paid")
//             .reduce((sum, p) => sum + (p.amount || 0), 0);


//         //  Send response
//         return res.status(200).json({
//             success: true,
//             message: "Payout history fetched successfully",
//             totalPayments: formatted.length,
//             totalAmount,
//             data: formatted
//         });

//     } catch (error) {
//         console.error("Error fetching payout history:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error while fetching payout history",
//             error: error.message
//         });
//     }
// };

exports.payoutHistory = async (req, res) => {
    try {
        const ownerId = req.user.id;

        // find guesthouse
        const guesthouse = await Guesthouse.findOne({ owner: ownerId });
        if (!guesthouse) {
            return res.status(400).json({
                success: false,
                message: "No guesthouse found for logged-in user"
            });
        }

        const guestHouseId = guesthouse._id;

        // ---- TOTAL EARNINGS (Paid Payments Total) ----
        const bookings = await Booking.find({ guesthouse: guestHouseId }).select("_id");

        const bookingIds = bookings.map(b => b._id);

        const payments = await Payment.find({
            booking: { $in: bookingIds },
            paymentStatus: "paid"
        }).lean();

        const totalEarnings = payments.reduce((sum, p) => sum + (p.amount || 0), 0);


        // ---- PAYOUT REQUEST LIST ----
        const payoutRequests = await PayoutRequest.find({
            guesthouse: guestHouseId
        })
            .sort({ createdAt: -1 })
            .lean();

        // ---- TOTAL PAYMENT PAYOUTS (Approved total) ----
        const paymentPayouts = payoutRequests
            .filter(r => r.status === "Approved")
            .reduce((sum, r) => sum + (r.amount || 0), 0);


        // ---- FORMAT LIST FOR UI ----
        const payoutList = payoutRequests.map(r => ({
            payoutId: r.payoutId,
            amount: r.amount,
            status: r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase(),
            date: moment(r.createdAt).tz("Asia/Kolkata").format("DD-MM-YYYY")
        }));

        const availableBalance = await calculateWalletBalance(guestHouseId);

        return res.status(200).json({
            success: true,
            message: "Payout history fetched successfully",
            totalEarnings,
            availableBalance,
            paymentPayouts,
            totalPayoutRequests: payoutList.length,
            data: payoutList
        });

    } catch (error) {
        console.error("Error fetching payout history:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payout history",
            error: error.message
        });
    }
};

// exports.deletePayout = async (req, res) =>{
//     try{
//         const{ payoutId } = req.body;
        

//     } catch(error){

//     }
// }

// send Payouts PayoutRequest

exports.requestPayout = async (req, res) => {
    try {
        const ownerId = req.user.id;

        const guesthouse = await Guesthouse.findOne({ owner: ownerId });
        if (!guesthouse) {
            return res.status(400).json({
                success: false,
                message: "No guesthouse found for this user"
            });
        }

        const guestHouseId = guesthouse._id;

        // Step 1 → Calculate dynamic wallet
        const availableBalance = await calculateWalletBalance(guestHouseId);
        console.log(availableBalance)

        let {
            amount,
            bankName,
            accountNumber,
            branchCode,
            swiftCode
        } = req.body || {};

        bankName = bankName?.trim();
        accountNumber = accountNumber?.trim();
        branchCode = branchCode?.trim();
        swiftCode = swiftCode?.trim().toUpperCase();


        if (!guesthouse) {
            return res.status(400).json({ success: false, message: 'Guesthouse ID is required' });
        }
        if (!amount || isNaN(amount)) {
            return res.status(200).json({ success: false, message: 'Valid payout amount is required' });
        }

        if (amount < 1000) {
            return res.status(200).json({ success: false, message: 'amount should be more then and equal to 1000' });

        }

        if (!bankName || bankName.length < 3) {
            return res.status(200).json({ success: false, message: 'Bank name must be at least 3 characters' });
        }

        if (!accountNumber || !/^[0-9]{6,25}$/.test(accountNumber)) {
            return res.status(200).json({ success: false, message: 'Account number must be 6-25 digits' });
        }

        if (!branchCode || branchCode.length < 2 || branchCode.length > 20) {
            return res.status(200).json({ success: false, message: 'Branch code must be 2-20 characters' });
        }

        if (!swiftCode || !/^[A-Z0-9]{8,11}$/.test(swiftCode)) {
            return res.status(200).json({ success: false, message: 'SWIFT code must be 8-11 alphanumeric characters' });
        }

        if (amount > availableBalance) {
            return res.status(200).json({ success: false, message: 'amount should be less than or equal than availableBalance' });
        }

        //  Step 3 → Generate payoutId (P + 5 digits)
        let payoutId;

        while (true) {
            const digits = Math.floor(10000 + Math.random() * 90000);
            payoutId = `P${digits}`;  // Example: P12345

            const exists = await PayoutRequest.findOne({ payoutId });
            if (!exists) break;
        }

        // Step 3 → Create payout request
        const payout = await PayoutRequest.create({
            payoutId,
            guesthouse: guestHouseId,
            amount,
            bankName,
            accountNumber,
            branchCode,
            swiftCode
        });

        return res.status(201).json({
            success: true,
            message: "Payout request submitted",
            availableBalanceAfterRequest: availableBalance - amount,
            data: payout
        });

    } catch (error) {
        console.log("Payout request error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while sending request for payout",
            error: error.message
        });
    }
};
