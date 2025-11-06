
/**
 * Check if card is expired
 * expiry format: "MM/YY"
 * Returns true if expired, false if valid
 */
function isExpired(expiry) {
    const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
    if (!m) return true; // invalid format treated as expired

    const month = parseInt(m[1], 10);
    const year = parseInt(m[2], 10) + 2000; // convert YY to YYYY

    if (month < 1 || month > 12) return true;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;

    return false; // card is valid
}

module.exports = { isExpired };
