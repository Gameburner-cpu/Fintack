/* ==========================================================
                    TRIP MANAGER
========================================================== */

let activeTrip = null;
let trips = [];

/* ==========================================================
                    CREATE TRIP
========================================================== */

function createTrip(name) {
    const trip = {
        id: Date.now(),
        name: name.trim(),
        members: [],
        expenses: [],
        createdAt: new Date().toISOString()
    };
    trips.push(trip);
    activeTrip = trip;
    return trip;
}

/* ==========================================================
                    GET ACTIVE TRIP
========================================================== */

function getActiveTrip() {
    return activeTrip;
}

/* ==========================================================
                    SET ACTIVE TRIP
========================================================== */

function setActiveTrip(name) {
    const trip = trips.find(
        t => t.name.toLowerCase() === name.toLowerCase()
    );
    if (trip) {
        activeTrip = trip;
        return true;
    }
    return false;
}

/* ==========================================================
                    ADD MEMBER
========================================== */

function addMember(memberName) {
    if (!activeTrip) return false;
    const cleanName = memberName.trim();
    if (!cleanName || activeTrip.members.includes(cleanName)) {
        return false;
    }
    activeTrip.members.push(cleanName);
    return true;
}

/* ==========================================================
                    ADD MULTIPLE MEMBERS
========================================================== */

function addMembers(names) {
    names.forEach(name => {
        addMember(name);
    });
}

/* ==========================================================
                    ADD EXPENSE
========================================================== */

function addExpense(title, amount, paidBy) {
    if (!activeTrip) return false;

    const newExpense = {
        id: Date.now(),
        title: title.trim(),
        amount: Number(amount),
        paidBy: paidBy.trim(),
        date: new Date().toLocaleDateString()
    };

    activeTrip.expenses.push(newExpense);
    return true;
}

/* ==========================================================
                    GET TOTAL EXPENSE HELPER
========================================================== */

function getTotalExpense(trip) {
    if (!trip || !trip.expenses || !Array.isArray(trip.expenses)) return 0;
    return trip.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

/* ==========================================================
                    GET TRIP SUMMARY HELPER
========================================================== */

function getTripSummary(trip) {
    if (!trip) {
        return { totalExpense: 0, members: 0, perPerson: 0 };
    }
    const totalExpense = getTotalExpense(trip);
    const membersCount = Array.isArray(trip.members)
    ? trip.members.length
    : 0; // Avoid division by zero
    const perPerson = totalExpense / membersCount;

    return {
        totalExpense,
        members: trip.members.length,
        perPerson
    };
}

/* ==========================================================
                    GET ALL TRIPS
========================================================== */

function getTrips() {
    return trips;
}