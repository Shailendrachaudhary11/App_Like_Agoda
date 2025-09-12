const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');


//Guesthouse Profile Management
router.post("/manage-guesthouse", auth(["guesthouse"]),upload.array("images", 5), guesthouseController.manageGuestHouse);
router.get("/my-guesthouse", auth(["guesthouse"]), guesthouseController.getMyGuesthouse);

//  Room Management
router.post("/add/room", auth(["guesthouse"]), uploadRooms.array("photos", 5), guesthouseController.addRoom);
router.get("/rooms",auth(["guesthouse"]),guesthouseController.getAllRooms);
router.get("/room/:roomId", auth(["guesthouse"]),guesthouseController.getRoomById);
router.put("/update/room/:roomId", auth(["guesthouse"]), uploadRooms.array("photos", 5), guesthouseController.updateRoom);
router.delete("/delete/room/:roomId", auth(["guesthouse"]), guesthouseController.deleteRoom);


// Booking Management
router.get("/bookings", auth(["guesthouse"]), guesthouseController.getAllBookings);
router.get("/booking/upcoming", auth(["guesthouse"]), guesthouseController.getUpcomingBookings);
router.get("/booking/past", auth(["guesthouse"]), guesthouseController.getPastBookings);
router.get("/booking/:bookingId", auth(["guesthouse"]), guesthouseController.getBookingById);
router.put("/booking/:bookingId/accept", auth(["guesthouse"]), guesthouseController.acceptBooking);
router.put("/booking/:bookingId/reject", auth(["guesthouse"]), guesthouseController.rejectBooking);


// Reviews & Ratings
router.get("/reviews", auth(["guesthouse"]),guesthouseController.getAllReviews);
router.get("/review/:reviewId", auth(["guesthouse"]), guesthouseController.getReviewById);

// Notification
router.get("/notifications", auth(["guesthouse"]), guesthouseController.getNotifications);
router.put("/notification/:notificationId/read", auth(["guesthouse"]), guesthouseController.readNotification);

module.exports = router;
