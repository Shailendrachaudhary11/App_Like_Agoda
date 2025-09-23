const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// Guesthouse Profile Management
router.post("/guesthouses", auth(["guesthouse"]), upload.array("guestHouseImage", 5), guesthouseController.manageGuestHouse);
router.get("/guesthouses/my", auth(["guesthouse"]), guesthouseController.getMyGuesthouse);

// Room Management
router.post("/rooms", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.addRoom);
router.get("/rooms", auth(["guesthouse"]), guesthouseController.getAllRooms);
router.get("/rooms/disable", auth(["guesthouse"]), guesthouseController.getDisableRooms);
router.get("/rooms/getRoomById", auth(["guesthouse"]), guesthouseController.getRoomById);
router.put("/rooms/:roomId", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.updateRoom);
router.delete("/rooms/:roomId/delete", auth(["guesthouse"]), guesthouseController.deleteRoom);
router.post("/rooms/disable", auth(["guesthouse"]), guesthouseController.activeInActive);

// Booking Management
router.get("/bookings", auth(["guesthouse"]), guesthouseController.getAllBookings);
router.get("/bookings/upcoming", auth(["guesthouse"]), guesthouseController.getUpcomingBookings);
router.get("/bookings/past", auth(["guesthouse"]), guesthouseController.getPastBookings);
router.get("/bookings/:bookingId", auth(["guesthouse"]), guesthouseController.getBookingById);
router.put("/bookings/:bookingId/cancel", auth(["guesthouse"]), guesthouseController.cancelBooking);
router.get("/bookings/:bookingId/contact", auth(["guesthouse"]), guesthouseController.getContactDetails);

// Reviews & Notifications
router.get("/reviews", auth(["guesthouse"]), guesthouseController.getAllReviews);
router.get("/reviews/:reviewId", auth(["guesthouse"]), guesthouseController.getReviewById);
router.get("/reviews/room/:roomId", auth(["guesthouse"]), guesthouseController.getReviewByRoomId)

router.get("/notifications", auth(["guesthouse"]), guesthouseController.getAllNotification);
router.put("/notifications/:notificationId/read", auth(["guesthouse"]), guesthouseController.readNotification);
router.delete("/notifications/:notificationId/delete", auth(["guesthouse"]), guesthouseController.deleteNotification);
router.get("/notifications/unread", auth(["guesthouse"]), guesthouseController.unreadNotification);

router.get("/totalRevenue", auth(["guesthouse"]), guesthouseController.totalRevenue);

module.exports = router;
