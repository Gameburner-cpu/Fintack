/* ==========================================================================
   tripFormatter.js
========================================================================== */

import {

    formatTripCard,
    formatMembersCard,
    formatExpenseCard,
    formatTripSummary,
    formatSettlementCard

} from "./tripCards.js";

class TripFormatter {

    async format(result, action, aiRequest) {

        switch (action.action) {

            case "CREATE_TRIP":

                return {

                    message:
                        result.success
                            ? `✅ Trip "${aiRequest.entities.tripName}" created successfully.`
                            : (result.message || "Unable to create trip."),

                    html:
                        result.success
                            ? formatTripCard(result.trip)
                            : ""

                };

            case "ADD_MEMBERS":

    return {

        message:
            result.success
                ? "✅ Members added successfully."
                : (result.message || "Unable to add members."),

        html:
            result.success
                ? formatMembersCard({

                    members: result.members

                })
                : ""

    };

            case "ADD_EXPENSE":

                return {

                    message:
                        result.success
                            ? "✅ Expense added successfully."
                            : (result.message || "Unable to add expense."),

                    html:
                        result.success
                            ? formatExpenseCard(aiRequest.entities.expense)
                            : ""

                };

            case "SHOW_SUMMARY":

                return {

                    message: "",

                    html: formatTripSummary(result)

                };

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