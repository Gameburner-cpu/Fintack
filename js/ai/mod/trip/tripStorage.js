/* ==========================================================
                    TRIP STORAGE API
========================================================== */

const TRIP_API = "https://fintack.onrender.com/api/trips";

const TripStorage = {

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

        return await response.json();

    },

    /* ==========================================================
                        GET ALL TRIPS
    ========================================================== */

    async getTrips(userId) {

        const response = await fetch(

            `${TRIP_API}?user_id=${userId}`

        );

        return await response.json();

    },

    /* ==========================================================
                        GET TRIP DETAILS
    ========================================================== */

    async getTripDetails(tripId) {

        const response = await fetch(

            `${TRIP_API}/${tripId}/details`

        );

        return await response.json();

    },

    /* ==========================================================
                        ADD MEMBERS
    ========================================================== */

    async addMembers(tripId, members) {

        const response = await fetch(

            `${TRIP_API}/${tripId}/members/bulk`,

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

            `${TRIP_API}/${tripId}/expenses`,

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

            `${TRIP_API}/${tripId}/expenses`

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

            `${TRIP_API}/${tripId}/expenses/${expenseId}`,

            {

                method: "PATCH",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify(updates)

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

            `${TRIP_API}/${tripId}/expenses/${expenseId}`,

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

            `${TRIP_API}/${tripId}/settlements`

        );

        return await response.json();

    }

};

export default TripStorage;