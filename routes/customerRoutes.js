const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.post("/customer/guesthouses/list", auth(["customer"]), customerController.getAllGuestHouses);
router.post("/customer/guesthouses/details", auth(["customer"]), customerController.getGuestHouseById);

router.post("/customer/guesthouses/rooms/list", auth(["customer"]), customerController.getAllRoomsByGuesthouseId);
router.post("/customer/rooms/details", auth(["customer"]), customerController.getRoomById)

router.post("/customer/paymentsMethod", auth(["customer"]), customerController.getAllPaymentTypes);
router.post("/customer/bookings/create", auth(["customer"]), customerController.createBooking);
router.post("/customer/bookings/proceedPayment", auth(["customer"]), customerController.proceedPayment);
router.post("/customer/bookings/pay", auth(["customer"]), customerController.payPayment)
router.post("/customer/bookings/list", auth(["customer"]), customerController.allBooking);
router.post("/customer/bookings/list/past", auth(["customer"]), customerController.pastBooking);
router.post("/customer/bookings/list/upcoming", auth(["customer"]), customerController.upcomingBooking);
router.post("/customer/bookings/list/cancel", auth(["customer"]), customerController.getCancelBookings);
router.post("/customer/bookings/details", auth(["customer"]), customerController.getBooking);
router.post("/customer/bookings/cancel", auth(["customer"]), customerController.cancelBooking);
// router.post("/customer/bookings/list/pending", auth(["customer"]), customerController.pendingBooking);


router.post("/customer/reviews/add", auth(["customer"]), customerController.addReviewAndRating);
router.post("/customer/reviews/list", auth(["customer"]), customerController.getReviewByGuestHouse);

router.post("/customer/promos/list", auth(["customer"]), customerController.getAllPromos);
router.post("/customer/promos/details", auth(["customer"]), customerController.getPromoById);


router.post("/customer/notifications/list", auth(["customer"]), customerController.getAllNotification);
router.post("/customer/notifications/read", auth(["customer"]), customerController.readNotification);
router.post("/customer/notifications/delete", auth(["customer"]), customerController.deleteNotification);


router.post("/customer/favorites/list", auth(["customer"]), customerController.getfavorites);
router.post("/customer/favorites/add", auth(["customer"]), customerController.addFavorites);

router.post("/customer/bedrooms/list", auth(["customer"]), customerController.getbedroom);
router.post("/customer/atolls/list", auth(["customer"]), customerController.getAllAtolls);
router.post("/customer/facilities/list", auth(["customer"]), customerController.getAllfacilities);
router.post("/customer/islands/list", auth(["customer"]), customerController.getAllIslands);

module.exports = router;