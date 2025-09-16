const express = require('express');
const router = express.Router();
const customerController = require("../controller/customerController")
const auth = require("../middlewares/authMiddleware")

router.get("/guesthouses", auth(["customer"]), customerController.getAllGuestHouses);
router.get("/guesthouse/:id", auth(["customer"]), customerController.getGuestHouseById);
router.get("/guesthouses/nearby",auth(["customer"]),customerController.searchGuestHouseNearBy);


router.get("/rooms", auth(["customer"]), customerController.searchRooms); // room filter
router.get("/rooms/:id", auth(["customer"]), customerController.getRoomById)

router.post("/reviews", auth(["customer"]), customerController.addReviewAndRating);
router.get("/reviews", auth(["customer"]), customerController.getAllReviews)
router.get("/reviews/guesthouse/:id", auth(["customer"]), customerController.getReviewByGuestHouse);
router.get("/reviews/room/:id", auth(["customer"]), customerController.getReviewByRoom);

router.get("/promos", auth(["customer"]), customerController.getAllPromos);
router.get("/promos/:id", auth(["customer"]), customerController.getPromoById);

router.get("/notifications", auth(["customer"]), customerController.getAllNotification);
router.put("/notifications/:notificationId/read", auth(["customer"]), customerController.readNotification);

router.get("/favorites", auth(["customer"]), customerController.getfavorites);
router.post("/favorites/:id", auth(["customer"]), customerController.addFavorites);
router.delete("/favorites/:id", auth(["customer"]),customerController.removeFavorite);


module.exports = router;