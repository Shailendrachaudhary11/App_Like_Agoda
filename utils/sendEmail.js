const nodemailer = require("nodemailer");
 
 
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
 
const sendMail = async (to, subject, text) => {
  try {
    const info = await transporter.sendMail({
      from: `"AGODA APP" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
 
module.exports = sendMail;