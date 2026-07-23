/* ==========================================================
                    TRIP AI INTENT
========================================================== */

let activeTripId = null;

async function handleTripIntent(message) {

    const text = message.toLowerCase().trim();

     console.log("MESSAGE:", message);
    console.log("TEXT:", text);

    /* =====================================================
                    CREATE TRIP
    ===================================================== */

    if (
        text.startsWith("create trip") ||
        text.startsWith("create a trip") ||
        text.includes("trip called")
    ) {

        const tripName = message
            .replace(/create\s+a?\s*trip/i, "")
            .replace(/called/i, "")
            .trim();

        if (!tripName) {
            return "Please provide a trip name.";
        }

        const user = JSON.parse(localStorage.getItem("user"));

        if (!user) {
            return "Please login first.";
        }

        const result = await TripStorage.createTrip(
            user.id,
            tripName
        );

        if (!result.success) {
            return "Couldn't create trip.";
        }

        activeTripId = result.trip.id;
        window.activeTripId = result.trip.id;

        const tripData = await TripStorage.getTripDetails(activeTripId);
        console.log("Trip Details:", tripData);
        if (tripData.success) {
            return formatTripCard(tripData.trip);
        }

        return formatTripCard(result.trip);
    }

    /* =====================================================
                    ADD MEMBERS
    ===================================================== */

    if (
        text.startsWith("add ") ||
        text.startsWith("add members")
    ) {

        if (!window.activeTripId) {
            return "Create a trip first.";
        }

        const members = message
            .replace(/^add members/i, "")
            .replace(/^add/i, "")
            .split(",")
            .map(name => name.trim())
            .filter(Boolean);

        if (members.length === 0) {
            return "Please enter member names.";
        }

        const result = await TripStorage.addMembers(
            window.activeTripId,
            members
        );

        if (!result.success) {
            return "Couldn't add members.";
        }

        const tripData = await TripStorage.getTripDetails(
            window.activeTripId
        );

        console.log("Trip Details:", tripData);

        if (!tripData.success) {
            return "Couldn't load updated trip.";
        }

        const trip = tripData.trip;

// Attach the members array from the API response
trip.members = tripData.members;

return formatMembersCard(trip);
    }

    /* =====================================================
                    ADD EXPENSE
    ===================================================== */

    if (text.includes("paid")) {

        if (!window.activeTripId) {
            return "Create a trip first.";
        }

        const regex =
            /(.+?) paid ?₹?(\d+)\s*(?:for)?\s*(.+)/i;

        const match = message.match(regex);

        if (!match) {
            return null;
        }

        const paid_by = match[1].trim();
        const amount = Number(match[2]);
        const title = match[3].trim();

        const result = await TripStorage.addExpense(
            window.activeTripId,
            {
                title,
                amount,
                paid_by,
                category: "General"
            }
        );

        if (!result.success) {
            return "Couldn't save expense.";
        }

        return formatExpenseCard({
            title,
            amount,
            paidBy: paid_by
        });
    }

    /* =====================================================
                    SHOW SUMMARY
    ===================================================== */

    if (
        text.includes("summary") ||
        text.includes("show trip")
    ) {

        if (!window.activeTripId) {
            return "Create a trip first.";
        }

        const tripData = await TripStorage.getTripDetails(
            window.activeTripId
        );

        if (!tripData.success) {
            return "Couldn't load trip.";
        }

        return formatTripSummary(tripData.trip);
    }

    /* =====================================================
                    SHOW SETTLEMENTS
    ===================================================== */

    if (
        text.includes("who owes") ||
        text.includes("settlement")
    ) {

        if (!window.activeTripId) {
            return "Create a trip first.";
        }

        const result = await TripStorage.getSettlements(
            window.activeTripId
        );

        if (!result.success) {
            return "Couldn't calculate settlements.";
        }

        return formatSettlementCard(
            result.settlements
        );
    }

    return null;

}