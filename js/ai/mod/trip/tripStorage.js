/* ==========================================================
                    TRIP STORAGE API
========================================================== */

const TRIP_API = "https://fintack.onrender.com/api/trips";

const ACTIVE_TRIP_KEY = "fintack_active_trip_id";

const TripStorage = {

    /* ==========================================================
                    ACTIVE TRIP STORAGE
    ========================================================== */

    setActiveTrip(tripId) {

        if (
            tripId === undefined ||
            tripId === null ||
            tripId === ""
        ) {
            return;
        }

        localStorage.setItem(
            ACTIVE_TRIP_KEY,
            String(tripId)
        );

        // Keep the existing runtime value in sync as well.
        window.activeTripId = String(tripId);

        console.log(
            "[TripStorage] Active trip saved:",
            tripId
        );

    },

    getActiveTrip() {

        const tripId =
            localStorage.getItem(
                ACTIVE_TRIP_KEY
            );

        return tripId || null;

    },

    clearActiveTrip() {

        localStorage.removeItem(
            ACTIVE_TRIP_KEY
        );

        window.activeTripId = null;

        console.log(
            "[TripStorage] Active trip cleared."
        );

    },

    /* ==========================================================
                        CREATE TRIP
    ========================================================== */

    async createTrip(userId, tripName) {

        const response = await fetch(TRIP_API, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                user_id: userId,

                trip_name: tripName

            })

        });

        const result =
            await response.json();

        /*
            Automatically remember a newly created trip.

            This makes the active trip survive browser refreshes.
        */

        if (
            result?.success &&
            result?.trip?.id
        ) {

            this.setActiveTrip(
                result.trip.id
            );

        }

        return result;

    },

    /* ==========================================================
                        GET ALL TRIPS
    ========================================================== */

    async getTrips(userId) {

        const response = await fetch(

            `${TRIP_API}?user_id=${encodeURIComponent(userId)}`

        );

        return await response.json();

    },

    /* ==========================================================
                        GET TRIP DETAILS
    ========================================================== */

    async getTripDetails(tripId) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/details`

        );

        return await response.json();

    },

    /* ==========================================================
                        ADD MEMBERS
    ========================================================== */

    async addMembers(tripId, members) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/members/bulk`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    members

                })

            }

        );

        return await response.json();

    },

    /* ==========================================================
                        ADD EXPENSE
    ========================================================== */

    async addExpense(

        tripId,

        {

            title,

            amount,

            paid_by,

            category = "General",

            notes = ""

        }

    ) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/expenses`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    title,

                    amount,

                    paid_by,

                    category,

                    notes

                })

            }

        );

        return await response.json();

    },

    /* ==========================================================
                        GET EXPENSES
    ========================================================== */

    async getExpenses(tripId) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/expenses`

        );

        return await response.json();

    },

    /* ==========================================================
                        UPDATE EXPENSE
    ========================================================== */

    async editExpense(

        tripId,

        expenseId,

        updates

    ) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,

            {

                method: "PATCH",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify(
                    updates
                )

            }

        );

        return await response.json();

    },

    /* ==========================================================
                        DELETE EXPENSE
    ========================================================== */

    async deleteExpense(

        tripId,

        expenseId

    ) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,

            {

                method: "DELETE"

            }

        );

        return await response.json();

    },

    /* ==========================================================
                        SETTLEMENTS
    ========================================================== */

    async getSettlements(tripId) {

        const response = await fetch(

            `${TRIP_API}/${encodeURIComponent(tripId)}/settlements`

        );

        return await response.json();

    }

};

export default TripStorage;
