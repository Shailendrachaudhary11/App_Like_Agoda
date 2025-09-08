const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');

////////////////////////////====================  CUSTOMER  ===========================////////////////////////

// guesthouse near by me
router.get("/guesthouses/nearby",auth(["customer"]),customerController.searchNearbyRooms);

// Search by city/date/amenities
router.get("/guesthouses/search", auth(["customer"]), customerController.searchGuestHouses);

// search room 
router.get("/rooms/search", auth(["customer"]), customerController.searchRooms);


// get room by Id
router.get("/room/:id",auth(["customer"]), customerController.getRoomDetails);

// Book room
router.post("/book-room",auth(["customer"]), customerController.bookRoom);

// payment and confirm Booking
router.post("/payment/:bookingId",auth(["customer"]),customerController.makePayment)

// GET customer get all booking 
router.get("/allBooking/:customerId",auth(["customer"]),customerController.getAllBooking)



module.exports = router;