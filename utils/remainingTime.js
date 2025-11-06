// Helper function to calculate remaining time
function getRemainingTime(checkInDate, checkOutDate, bookingStatus) {
    const now = new Date();
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    checkIn.setMinutes(checkIn.getMinutes() + checkIn.getTimezoneOffset()); // shift UTC → local
    checkIn.setHours(0, 0, 0, 0); // set local midnight

    if (bookingStatus && bookingStatus.toLowerCase() === "cancelled") {
        return "Expired"
    }

    if (now > checkOut) {
        return "Expired";
    }

    if (now >= checkIn && now <= checkOut) {
        return "Ongoing";
    }

    const diffMs = checkIn - now;

    if (diffMs <= 0) return "Expired";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 1) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
}

module.exports = getRemainingTime;

