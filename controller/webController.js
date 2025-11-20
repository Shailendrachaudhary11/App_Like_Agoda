const Review = require("../models/review");

const BASE_URL = process.env.BASE_URL;

const Guesthouse = require('../models/Guesthouse');

// exports.getGuestHouseByAtoll = async (req, res) => {
//     try {
//         const { atollId } = req.body;

//         if (!atollId) {
//             return res.status(400).json({ message: "atollId is required" });
//         }

//         // Fetch guesthouses for the given atoll
//         const guesthouses = await Guesthouse.find({ atolls: atollId, status: 'active' })
//             .populate('islands', 'name');         // Optional: island info

//         // For each guesthouse, calculate average rating and review count
//         const result = await Promise.all(guesthouses.map(async (gh) => {
//             const reviews = await Review.find({ guesthouse: gh._id });
//             const reviewCount = reviews.length;
//             const avgRating = reviewCount > 0
//                 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
//                 : 0;

//             return {
//                 _id: gh._id,
//                 name: gh.name,
//                 address: gh.address,
//                 description: gh.description,
//                 guestHouseImage: gh.guestHouseImage.length > 0
//                     ? `${BASE_URL}/uploads/guestHouseImage/${gh.guestHouseImage[0]}`
//                     : null,
//                 price: gh.price,
//                 reviewCount,
//                 avgRating
//             };
//         }));

//         return res.status(200).json({
//             success: true,
//             message: "Successfully fetch all guesthouse",
//             data: result
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             success: false,
//             message: "Server Error while fetch guesthouses",
//             error: error.message
//         });
//     }
// };
