/* ==========================================================================
   tripFormatter.js
   Formats TripManager results into AI responses.
========================================================================== */

class TripFormatter {

    async format(result, action, aiRequest) {

        switch (action.action) {

            /* ==========================================================
                            CREATE TRIP
            ========================================================== */

            case "CREATE_TRIP":

                return {

                    message: result.success
                        ? `Trip "${aiRequest.entities.tripName}" created successfully.`
                        : (result.message || "Unable to create trip."),

                    html: result.success
                        ? formatTripCard(result.trip)
                        : ""

                };

            /* ==========================================================
                            ADD MEMBERS
            ========================================================== */

            case "ADD_MEMBERS":

                return {

                    message: result.success
                        ? "Members added successfully."
                        : (result.message || "Unable to add members."),

                    html: result.success
                        ? formatMembersCard(result.trip)
                        : ""

                };

            /* ==========================================================
                            ADD EXPENSE
            ========================================================== */

            case "ADD_EXPENSE":

                return {

                    message: result.success
                        ? "Expense added successfully."
                        : (result.message || "Unable to add expense."),

                    html: result.success
                        ? formatExpenseCard(aiRequest.entities.expense)
                        : ""

                };

            /* ==========================================================
                            SHOW SUMMARY
            ========================================================== */

            case "SHOW_SUMMARY":

                return {

                    message: "",

                    html: formatTripSummary(result)

                };

            /* ==========================================================
                            SHOW SETTLEMENTS
            ========================================================== */

            case "SHOW_SETTLEMENTS":

                return {

                    message: "",

                    html: formatSettlementCard(result)

                };

            default:

                return {

                    message: result.message || "",

                    html: ""

                };

        }

    }

}

export default TripFormatter;