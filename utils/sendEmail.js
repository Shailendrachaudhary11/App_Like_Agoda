const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,   // ✅ from .env
        pass: process.env.EMAIL_PASS    // ✅ from .env
    }
});

exports.sendEmail = async (to, subject, text) => {
    try {
        await transporter.sendMail({
            from: `"Agoda App" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        console.log("📧 Email sent successfully");
    } catch (error) {
        console.error("❌ Email error:", error);
        throw new Error(error.message,"Email not sent");
    }
};

