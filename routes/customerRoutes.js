const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.post("/customer/guesthouses", auth(["customer"]), customerController.getAllGuestHouses);
router.get("/customer/guesthouses/nearby", auth(["customer"]), customerController.searchGuestHouseNearBy);
router.get("/customer/guesthouses/:id", auth(["customer"]), customerController.getGuestHouseById);

router.get("/customer/guesthouses/:guesthouseId/rooms", auth(["customer"]), customerController.getAllRoomsByGuesthouseId);
router.get("/customer/rooms", auth(["customer"]), customerController.searchRooms); // room filter
router.get("/customer/rooms/:id", auth(["customer"]), customerController.getRoomById)


router.post("/customer/bookings", auth(["customer"]), customerController.createBooking);
router.put("/customer/bookings/:id/pay", auth(["customer"]), customerController.payPayment)
router.get("/customer/bookings", auth(["customer"]), customerController.allBooking);
router.get("/customer/bookings/past", auth(["customer"]), customerController.pastBooking);
router.get("/customer/bookings/upcoming", auth(["customer"]), customerController.upcomingBooking);
router.get("/customer/bookings/cancel", auth(["customer"]), customerController.getCancelBookings);
router.get("/customer/bookings/:id", auth(["customer"]), customerController.getBooking);
router.put("/customer/bookings/:id/cancel", auth(["customer"]), customerController.cancelBooking);

router.post("/customer/reviews", auth(["customer"]), customerController.addReviewAndRating);
router.get("/customer/reviews", auth(["customer"]), customerController.getAllReviews)
router.get("/customer/reviews/guesthouses/:id", auth(["customer"]), customerController.getReviewByGuestHouse);
router.get("/customer/reviews/room/:id", auth(["customer"]), customerController.getReviewByRoom);

router.get("/customer/promos", auth(["customer"]), customerController.getAllPromos);
router.get("/customer/promos/:id", auth(["customer"]), customerController.getPromoById);

router.get("/customer/notifications", auth(["customer"]), customerController.getAllNotification);
router.put("/customer/notifications/:notificationId/read", auth(["customer"]), customerController.readNotification);
router.delete("/customer/notifications/:notificationId/delete", auth(["customer"]), customerController.deleteNotification);

router.get("/customer/favorites", auth(["customer"]), customerController.getfavorites);
router.post("/customer/favorites/:id", auth(["customer"]), customerController.addFavorites);
router.delete("/customer/favorites/:id", auth(["customer"]), customerController.removeFavorite);

router.post("/customer/addBedroomNames", auth(["customer"]), customerController.addBedroomNames);
router.post("/customer/setMaxPrice", auth(["customer"]), customerController.setMaxPrice);
router.post("/customer/facilities/add", auth(["customer"]), customerController.createFacility);
router.post("/customer/atolls/add", auth(["customer"]), customerController.createAtoll);
router.post("/customer/islands/add", auth(["customer"]), customerController.createIslands);

router.post("/customer/bedrooms", auth(["customer"]), customerController.getbedroom);
router.post("/customer/atolls", auth(["customer"]), customerController.getAllAtolls);
router.post("/customer/facilities", auth(["customer"]), customerController.getAllfacilities);
router.post("/customer/islands", auth(["customer"]), customerController.getAllIslands);

module.exports = router;