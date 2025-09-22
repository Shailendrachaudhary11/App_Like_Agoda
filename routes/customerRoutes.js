const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.get("/guesthouses", auth(["customer"]), customerController.getAllGuestHouses);
router.get("/guesthouses/nearby", auth(["customer"]), customerController.searchGuestHouseNearBy);
router.get("/guesthouses/:id", auth(["customer"]), customerController.getGuestHouseById);


router.get("/rooms", auth(["customer"]), customerController.searchRooms); // room filter
router.get("/rooms/:id", auth(["customer"]), customerController.getRoomById)

// router.get("/booking/checkRoom", auth(["customer"]), customerController.checkAvaibilityRoom);
router.post("/bookings", auth(["customer"]), customerController.createBooking);
router.put("/bookings/:id/pay", auth(["customer"]), customerController.payPayment)
router.get("/bookings", auth(["customer"]), customerController.allBooking);
router.get("/bookings/past", auth(["customer"]), customerController.pastBooking);
router.get("/bookings/upcoming", auth(["customer"]), customerController.upcomingBooking);
router.get("/bookings/cancel", auth(["customer"]), customerController.getCancelBookings);
router.get("/bookings/:id", auth(["customer"]), customerController.getBooking);
router.put("/bookings/:id/cancel", auth(["customer"]), customerController.cancelBooking);

router.post("/reviews", auth(["customer"]), customerController.addReviewAndRating);
router.get("/reviews", auth(["customer"]), customerController.getAllReviews)
router.get("/reviews/guesthouses/:id", auth(["customer"]), customerController.getReviewByGuestHouse);
router.get("/reviews/room/:id", auth(["customer"]), customerController.getReviewByRoom);

router.get("/promos", auth(["customer"]), customerController.getAllPromos);
router.get("/promos/:id", auth(["customer"]), customerController.getPromoById);

router.get("/notifications", auth(["customer"]), customerController.getAllNotification);
router.put("/notifications/:notificationId/read", auth(["customer"]), customerController.readNotification);
router.delete("/notifications/:notificationId/delete", auth(["customer"]), customerController.deleteNotification);

router.get("/favorites", auth(["customer"]), customerController.getfavorites);
router.post("/favorites/:id", auth(["customer"]), customerController.addFavorites);
router.delete("/favorites/:id", auth(["customer"]), customerController.removeFavorite);




module.exports = router;