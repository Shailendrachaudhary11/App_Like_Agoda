const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');

////////////////////////////====================  CUSTOMER  ===========================////////////////////////

// guesthouse near by me
router.get("/guesthouses/nearby",auth(["customer"]),customerController.searchNearbyRooms);

// get room by Id
router.get("/room/:id",auth(["customer"]), customerController.getRoomDetails);

// Search by city/date/amenities
router.get("/guesthouses/search", auth(["customer"]), customerController.searchGuestHouses);

// select guest house see all rooms
router.get("/guesthouse/:id",auth(["customer"]), customerController.getGuestHouseRooms)


module.exports = router;