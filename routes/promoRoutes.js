const express = require("express");
const router = express.Router();
const auth  = require("../middlewares/authMiddleware");
const promoController = require("../controller/promoController");

// Admin create promo
router.post("/add", auth(["admin"]), promoController.addPromoCode);

// Admin update promo code 
router.put("/update/:id", auth(["admin"]),promoController.updatePromo);

// Admin delete promo code 
router.delete("/delete/:id", auth(["admin"]),promoController.deletepromo);

// Admin Get all promos code
router.get("/allPromo", auth(['admin']), promoController.getAllPromo)

// Customer view active promos
router.get("/getActive", auth(["customer"]), promoController.getActivePromos);

module.exports = router;
