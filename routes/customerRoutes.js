const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.post("/customer/atolls/guesthouses", auth(["customer"]), customerController.getAllGuesthouseWithAllAtolls);
router.post("/customer/promoImages", auth(["customer"]), customerController.getPromoImage);

router.post("/customer/guesthouses/list", auth(["customer"]), customerController.getAllGuestHouses);
router.post("/customer/guesthouses/details", auth(["customer"]), customerController.getGuestHouseById);


router.post("/customer/guesthouses/rooms/list", auth(["customer"]), customerController.getAllRoomsByGuesthouseId);
router.post("/customer/rooms/details", auth(["customer"]), customerController.getRoomById)

router.post("/customer/paymentsMethod", auth(["customer"]), customerController.getAllPaymentTypes);
router.post("/customer/bookings/summary", auth(["customer"]), customerController.bookingSummary);
router.post("/customer/bookings/create", auth(["customer"]), customerController.createBooking);
router.post("/customer/bookings/list", auth(["customer"]), customerController.allBooking);
router.post("/customer/bookings/list/past", auth(["customer"]), customerController.pastBooking);
router.post("/customer/bookings/list/upcoming", auth(["customer"]), customerController.upcomingBooking);
router.post("/customer/bookings/list/cancel", auth(["customer"]), customerController.getCancelBookings);
router.post("/customer/bookings/details", auth(["customer"]), customerController.getBooking);
router.post("/customer/bookings/download-invoice", auth(["customer"]), customerController.downloadInvoice);
router.post("/customer/bookings/cancel", auth(["customer"]), customerController.cancelBooking);

router.post("/customer/reviews/add", auth(["customer"]), customerController.addReviewAndRating);
router.post("/customer/reviews/list", auth(["customer", "guesthouse"]), customerController.getReviewByGuestHouse);

router.post("/customer/promos/list", auth(["customer"]), customerController.getAllPromos);
router.post("/customer/promos/details", auth(["customer"]), customerController.getPromoById);


router.post("/customer/notifications/list", auth(["customer"]), customerController.getAllNotification);
router.post("/customer/notifications/read", auth(["customer"]), customerController.readNotification);
router.post("/customer/notifications/delete", auth(["customer"]), customerController.deleteNotification);
router.post("/customer/notifications/delete-all", auth(["customer"]), customerController.deleteAllNotifications);
router.post("/customer/notifications/new-count", auth(["customer"]), customerController.countNewNotifications);


router.post("/customer/favorites/list", auth(["customer"]), customerController.getfavorites);
router.post("/customer/favorites/add", auth(["customer"]), customerController.addFavorites);


router.post("/customer/atolls/list", auth(["customer","guesthouse"]), customerController.getAllAtolls);
router.post("/customer/facilities/list", auth(["customer","guesthouse"]), customerController.getAllfacilities);
router.post("/customer/islands/list", auth(["customer","guesthouse"]), customerController.getAllIslands);
router.post("/customer/bedTypes/list", auth(["customer"]), customerController.getAllBedTypes);


router.post("/customer/cards/add", auth(["customer"]), customerController.addCard);
router.post("/customer/cards/list", auth(["customer"]), customerController.getAllCards);

router.post("/customer/wallet/addAmount", auth(["customer"]), customerController.addWallet);
router.post("/customer/wallet", auth(["customer"]), customerController.getWallet);


module.exports = router;