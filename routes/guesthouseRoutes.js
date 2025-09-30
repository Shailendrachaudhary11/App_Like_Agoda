const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// Guesthouse Profile Management
router.post("/guesthouse/guesthouses", auth(["guesthouse"]), upload.array("guestHouseImage", 10), guesthouseController.manageGuestHouse);
router.get("/guesthouse/guesthouses/my", auth(["guesthouse"]), guesthouseController.getMyGuesthouse);

// Room Management
router.post("/guesthouse/rooms", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.addRoom);
router.get("/guesthouse/rooms", auth(["guesthouse"]), guesthouseController.getAllRooms);
router.get("/guesthouse/rooms/disable", auth(["guesthouse"]), guesthouseController.getDisableRooms);
router.get("/guesthouse/rooms/getRoomById", auth(["guesthouse"]), guesthouseController.getRoomById);
router.put("/guesthouse/rooms/:roomId", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.updateRoom);
router.delete("/guesthouse/rooms/:roomId/delete", auth(["guesthouse"]), guesthouseController.deleteRoom);
router.post("/guesthouse/rooms/disable", auth(["guesthouse"]), guesthouseController.activeInActive);

// Booking Management
router.get("/guesthouse/bookings", auth(["guesthouse"]), guesthouseController.getAllBookings);
router.get("/guesthouse/bookings/upcoming", auth(["guesthouse"]), guesthouseController.getUpcomingBookings);
router.get("/guesthouse/bookings/past", auth(["guesthouse"]), guesthouseController.getPastBookings);
router.get("/guesthouse/bookings/:bookingId", auth(["guesthouse"]), guesthouseController.getBookingById);
router.put("/guesthouse/bookings/:bookingId/cancel", auth(["guesthouse"]), guesthouseController.cancelBooking);
router.get("/guesthouse/bookings/:bookingId/contact", auth(["guesthouse"]), guesthouseController.getContactDetails);

// Reviews & Notifications
router.get("/guesthouse/reviews", auth(["guesthouse"]), guesthouseController.getAllReviews);
router.get("/guesthouse/reviews/:reviewId", auth(["guesthouse"]), guesthouseController.getReviewById);
router.get("/guesthouse/reviews/room/:roomId", auth(["guesthouse"]), guesthouseController.getReviewByRoomId)

router.get("/guesthouse/notifications", auth(["guesthouse"]), guesthouseController.getAllNotification);
router.put("/guesthouse/notifications/:notificationId/read", auth(["guesthouse"]), guesthouseController.readNotification);
router.delete("/guesthouse/notifications/:notificationId/delete", auth(["guesthouse"]), guesthouseController.deleteNotification);
router.get("/guesthouse/notifications/unread", auth(["guesthouse"]), guesthouseController.unreadNotification);

router.get("/guesthouse/totalRevenue", auth(["guesthouse"]), guesthouseController.totalRevenue);

module.exports = router;
