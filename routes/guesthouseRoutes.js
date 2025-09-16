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
router.get("/rooms",auth(["guesthouse"]),guesthouseController.getAllRooms);
router.get("/rooms/:roomId", auth(["guesthouse"]),guesthouseController.getRoomById);
router.put("/rooms/:roomId", auth(["guesthouse"]), upload.array("photos", 5), guesthouseController.updateRoom);
router.delete("/rooms/:roomId", auth(["guesthouse"]), guesthouseController.deleteRoom);

// Booking Management
router.get("/bookings", auth(["guesthouse"]), guesthouseController.getAllBookings);
router.get("/bookings/upcoming", auth(["guesthouse"]), guesthouseController.getUpcomingBookings);
router.get("/bookings/past", auth(["guesthouse"]), guesthouseController.getPastBookings);
router.get("/bookings/:bookingId", auth(["guesthouse"]), guesthouseController.getBookingById);
router.put("/bookings/:bookingId/accept", auth(["guesthouse"]), guesthouseController.acceptBooking);
router.put("/bookings/:bookingId/reject", auth(["guesthouse"]), guesthouseController.rejectBooking);

// Reviews & Notifications
router.get("/reviews", auth(["guesthouse"]),guesthouseController.getAllReviews);
router.get("/review/:reviewId", auth(["guesthouse"]), guesthouseController.getReviewById);
router.get("/notifications", auth(["guesthouse"]), guesthouseController.getNotifications);
router.put("/notification/:notificationId/read", auth(["guesthouse"]), guesthouseController.readNotification);

module.exports = router;
