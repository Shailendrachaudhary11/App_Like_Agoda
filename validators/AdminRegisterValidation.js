const { body } = require("express-validator");

const AdminRegisterValidation = [
  body("name")
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 4 }).withMessage("Name must be at least 4 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("Name must contain only letters"),

  body("email")
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email")
    .normalizeEmail(), // remove unnecessary characters

  body("phone")
    .notEmpty().withMessage("Phone number is required")
    .matches(/^\d{10}$/).withMessage("Phone must be 10 digits"), // India standard format
    // Agar country code chahiye: /^\+?\d{10,15}$/ 

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")

];

module.exports = AdminRegisterValidation;
