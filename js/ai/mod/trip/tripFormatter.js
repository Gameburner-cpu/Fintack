/* ==========================================================================
   tripFormatter.js
   Formats trip actions into clear, human-friendly FinTack AI responses.
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

            /* ======================================================
                            CREATE TRIP
            ====================================================== */

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

            /* ======================================================
                            ADD MEMBERS
            ====================================================== */

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

            /* ======================================================
                            ADD EXPENSE
            ====================================================== */

            case "ADD_EXPENSE":

                return {

                    message:
                        result.success
                            ? "✅ Expense added successfully."
                            : (result.message || "Unable to add expense."),

                    html:
                        result.success
                            ? formatExpenseCard(

                                aiRequest.entities.expense

                            )
                            : ""

                };

            /* ======================================================
                            EDIT EXPENSE
            ====================================================== */

            case "EDIT_EXPENSE":

                return {

                    message:
                        result.success
                            ? "✅ Expense updated successfully."
                            : (result.message || "Unable to update expense."),

                    html: ""

                };

            /* ======================================================
                            DELETE EXPENSE
            ====================================================== */

            case "DELETE_EXPENSE":

                return {

                    message:
                        result.success
                            ? "🗑️ Expense deleted successfully."
                            : (result.message || "Unable to delete expense."),

                    html: ""

                };

            /* ======================================================
                            SHOW SUMMARY
            ====================================================== */

            case "SHOW_SUMMARY":

                if (!result.success) {

                    return {

                        message:
                            result.message ||
                            "Unable to load the trip summary.",

                        html: ""

                    };

                }

                return {

                    message: "",

                    html:
                        formatTripSummary(result)

                };

            /* ======================================================
                            SHOW SETTLEMENTS
            ====================================================== */

            case "SHOW_SETTLEMENTS":

                if (!result.success) {

                    return {

                        message:
                            result.message ||
                            "Unable to calculate trip settlements.",

                        html: ""

                    };

                }

                return {

                    /*
                     * Keep the text message empty because the settlement
                     * card is the primary response. The card formatter
                     * should present balances as clear actions such as:
                     *
                     * "Mohith pays Dimple ₹500"
                     *
                     * rather than requiring the user to interpret
                     * positive/negative balances.
                     */

                    message: "",

                    html:
                        formatSettlementCard(result)

                };

            /* ======================================================
                            NO ACTIVE TRIP
            ====================================================== */

            case "NO_ACTIVE_TRIP":

                return {

                    message:
                        "🚗 You don't have an active trip.\n\nCreate one by saying:\n\n• Create Goa Trip\n• Start Coorg Trip",

                    html: ""

                };

            /* ======================================================
                            INVALID EXPENSE
            ====================================================== */

            case "INVALID_EXPENSE":

                return {

                    message:
                        "I couldn't understand the expense.\n\nTry:\n\n• Pizza 500\n• Mohith paid 1200 for Fuel",

                    html: ""

                };

            /* ======================================================
                            INVALID EDIT
            ====================================================== */

            case "INVALID_EDIT":

                return {

                    message:
                        "Please tell me what to update.\n\nExample:\n\n• Change Pizza to 700\n• Update Fuel to 1200",

                    html: ""

                };

            /* ======================================================
                            INVALID DELETE
            ====================================================== */

            case "INVALID_DELETE":

                return {

                    message:
                        "Please specify which expense to delete.\n\nExample:\n\n• Delete Pizza\n• Remove Fuel",

                    html: ""

                };

            /* ======================================================
                            DEFAULT
            ====================================================== */

            default:

                return {

                    message:
                        result?.message ||
                        "Something went wrong.",

                    html: ""

                };

        }

    }

}

export default TripFormatter;
