const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.post("/customer/guesthouses", auth(["customer"]), customerController.getAllGuestHouses);
router.post("/customer/guesthouses/:id", auth(["customer"]), customerController.getGuestHouseById);

router.post("/customer/guesthouses/:guesthouseId/rooms", auth(["customer"]), customerController.getAllRoomsByGuesthouseId);
router.post("/customer/rooms", auth(["customer"]), customerController.searchRooms); // room filter // CROSS
router.post("/customer/rooms/:id", auth(["customer"]), customerController.getRoomById)


router.post("/customer/bookings", auth(["customer"]), customerController.createBooking);
router.put("/customer/bookings/:id/pay", auth(["customer"]), customerController.payPayment)
router.get("/customer/bookings", auth(["customer"]), customerController.allBooking);
router.post("/customer/bookings/past", auth(["customer"]), customerController.pastBooking);
router.post("/customer/bookings/upcoming", auth(["customer"]), customerController.upcomingBooking);
router.post("/customer/bookings/cancel", auth(["customer"]), customerController.getCancelBookings);
router.post("/customer/bookings/:id", auth(["customer"]), customerController.getBooking);
router.put("/customer/bookings/:id/cancel", auth(["customer"]), customerController.cancelBooking);


router.post("/customer/reviews", auth(["customer"]), customerController.addReviewAndRating);
router.get("/customer/reviews", auth(["customer"]), customerController.getAllReviews)
router.post("/customer/reviews/guesthouses/:id", auth(["customer"]), customerController.getReviewByGuestHouse);
// router.post("/customer/reviews/room/:id", auth(["customer"]), customerController.getReviewByRoom);


router.post("/customer/promos", auth(["customer"]), customerController.getAllPromos);
router.post("/customer/promos/:id", auth(["customer"]), customerController.getPromoById);


router.post("/customer/notifications", auth(["customer"]), customerController.getAllNotification);
router.put("/customer/notifications/:notificationId/read", auth(["customer"]), customerController.readNotification);
router.delete("/customer/notifications/:notificationId/delete", auth(["customer"]), customerController.deleteNotification);


router.post("/customer/favorites", auth(["customer"]), customerController.getfavorites);
router.post("/customer/favorites/:id", auth(["customer"]), customerController.addFavorites);
router.delete("/customer/favorites/:id", auth(["customer"]), customerController.removeFavorite);


router.post("/customer/bedrooms", auth(["customer"]), customerController.getbedroom);
router.post("/customer/atolls", auth(["customer"]), customerController.getAllAtolls);
router.post("/customer/facilities", auth(["customer"]), customerController.getAllfacilities);
router.post("/customer/islands/:id", auth(["customer"]), customerController.getAllIslands);

module.exports = router;