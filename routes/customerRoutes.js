const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const auth = require('../middlewares/authMiddleware');
const uploadUser = require("../middlewares/uploadUser");
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');

////////////////////////////====================  CUSTOMER  ===========================////////////////////////

router.get("/viewProfile", auth([ "customer"]), customerController.getMyProfile);
router.put("/updateProfile", auth(["customer"]), uploadUser.single('profileImage'), customerController.updateProfile);
router.post("/change-password", auth(["customer"]), customerController.changePassword);
router.post('/forgot-password', auth([ "customer"]),customerController.forgotPassword);
router.post("/reset-password", auth([ "customer"]), customerController.resetPassword);


// guesthouse near by me
router.get("/guesthouses/nearby",auth(["customer"]),customerController.searchNearbyRooms);

// Search by city/date/amenities
router.get("/guesthouses/search", auth(["customer"]), customerController.searchGuestHouses);

// get room by Id
router.get("/room/:id",auth(["customer"]), customerController.getRoomDetails);

// search room by city, minPrice, maxPrice, cap, inDate, outDate
router.get("/rooms/search",auth(["customer"]),customerController.searchRooms);

// Book room
router.post("/book-room",auth(["customer"]), customerController.bookroom);

// payment and confirm Booking
router.post("/payment/:bookingId",auth(["customer"]),customerController.makePayment)

// GET customer get all booking 
router.get("/allBooking",auth(["customer"]),customerController.getAllBooking)


// get booking by Id
router.get("/booking/:bookingId",auth(["customer"]),customerController.getBookingById);
// router.post("/review-rating", auth(["admin"]),customerController.addReviewRating)


module.exports = router;