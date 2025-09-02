const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken")

exports.register = async (req, res) => {
    try {
        const data = req.body;

        // check if user already exists
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already registered with this email."
            });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);
        data.password = hashedPassword;

        // save user
        const newUser = new User(data);
        await newUser.save();

        res.status(201).json({
            success: true,
            message: "User created successfully.  Wait for approval.",
            data: newUser
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Something went wrong.",
            error: err.message
        });
    }
};

// login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Check approval for guesthouse_admin
        if (!user.isVerified) {
            return res.status(403).json({ message: "Your account is not approved by admin yet." });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, email:user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
