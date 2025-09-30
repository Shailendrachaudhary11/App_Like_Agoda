const { body } = require("express-validator");

exports.registerValidation = [
  body("name")
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ min: 4 }).withMessage("Name must be at least 4 characters").bail()
    .matches(/^[A-Za-z\s]+$/).withMessage("Name must contain only letters"),

  body("email")
    .notEmpty().withMessage("Email is required").bail()
    .isEmail().withMessage("Invalid email").bail()
    .normalizeEmail()
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage("Email does not match the required pattern"),

  body("phone")
    .notEmpty().withMessage("Phone number is required").bail()
    .matches(/^\d{10}$/).withMessage("Phone must be 10 digits"), // India standard format
  // Agar country code chahiye: /^\+?\d{10,15}$/ 


];
