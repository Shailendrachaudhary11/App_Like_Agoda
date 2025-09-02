const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');

// Only "guesthouse_admin" can add guesthouses
router.post("/add", auth(["guesthouse_admin"]), guesthouseController.addGuesthouse);

// Guesthouse admin can see his own hotels
router.get("/my-guesthouses", auth(["guesthouse_admin"]), guesthouseController.getMyGuesthouses);

module.exports = router;
