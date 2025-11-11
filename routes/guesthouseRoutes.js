const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.post("/guesthouse/rooms/options", auth(["guesthouse"]), guesthouseController.getRoomOptions);

// Guesthouse Profile Management
router.post("/guesthouse/manage-guesthouses", auth(["guesthouse"]), upload.array("guestHouseImage", 10), guesthouseController.manageGuestHouse);
router.post("/guesthouse/view-guesthouses", auth(["guesthouse"]), guesthouseController.getMyGuesthouse);

// Room Management
router.post("/guesthouse/add-rooms", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.addRoom);
router.post("/guesthouse/rooms", auth(["guesthouse"]), guesthouseController.getAllRooms);
// router.get("/guesthouse/rooms/disable", auth(["guesthouse"]), guesthouseController.getDisableRooms);
router.post("/guesthouse/rooms/getRoomById", auth(["guesthouse"]), guesthouseController.getRoomById);
router.post("/guesthouse/rooms/update", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.updateRoom);
router.post("/guesthouse/rooms/delete", auth(["guesthouse"]), guesthouseController.deleteRoom);
// router.post("/guesthouse/rooms/disable", auth(["guesthouse"]), guesthouseController.activeInActive);

// Booking Management
router.post("/guesthouse/bookings/list", auth(["guesthouse"]), guesthouseController.getAllBookings);
router.post("/guesthouse/bookings/view", auth(["guesthouse"]), guesthouseController.getBookingById);
router.post("/guesthouse/bookings/download-invoice", auth(["guesthouse"]), guesthouseController.downloadInvoice);

//_______________Payout history


// notificaition
router.post("/guesthouse/notifications/list", auth(["guesthouse"]), guesthouseController.getAllNotification);
router.post("/guesthouse/notifications/delete-all", auth(["guesthouse"]), guesthouseController.deleteAllNotifications);
router.post("/guesthouse/notifications/new-count", auth(["guesthouse"]), guesthouseController.countNewNotifications);


module.exports = router;
