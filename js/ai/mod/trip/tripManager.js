/* ==========================================================================
   tripManager.js
   Executes trip actions using TripStorage.
========================================================================== */

import TripStorage from "./tripStorage.js";

class TripManager {

    async execute(action, aiRequest) {

        switch (action.action) {

            case "CREATE_TRIP":
                return await this.createTrip(aiRequest);

            case "ADD_MEMBERS":
                return await this.addMembers(aiRequest);

            case "ADD_EXPENSE":
                return await this.addExpense(aiRequest);

            case "EDIT_EXPENSE":
                return await this.editExpense(aiRequest);

            case "DELETE_EXPENSE":
                return await this.deleteExpense(aiRequest);

            case "SHOW_SUMMARY":
                return await this.showSummary(aiRequest);

            case "SHOW_SETTLEMENTS":
                return await this.showSettlements(aiRequest);

            case "NO_ACTIVE_TRIP":

                return {

                    success: false,

                    code: "NO_ACTIVE_TRIP",

                    message: "No active trip found."

                };

            case "INVALID_EXPENSE":

                return {

                    success: false,

                    code: "INVALID_EXPENSE",

                    message: "Expense information is incomplete."

                };

            case "INVALID_EDIT":

                return {

                    success: false,

                    code: "INVALID_EDIT",

                    message: "Edit information is incomplete."

                };

            case "INVALID_DELETE":

                return {

                    success: false,

                    code: "INVALID_DELETE",

                    message: "Please specify which expense to delete."

                };

            default:

                return {

                    success: false,

                    message: "Unknown trip action."

                };

        }

    }

    /* ==========================================================
                        CREATE TRIP
    ========================================================== */

    async createTrip(aiRequest) {

        const { tripName } = aiRequest.entities;

        const user = aiRequest.context.user;

        if (!tripName) {

            return {

                success: false,

                message: "Trip name missing."

            };

        }

        if (!user) {

            return {

                success: false,

                message: "Please login first."

            };

        }

        const result = await TripStorage.createTrip(

            user.id,

            tripName

        );

        console.log("CREATE TRIP RESULT:", result);

        if (result.success && result.trip) {

            window.activeTripId = result.trip.id;

        }

        return result;

    }

    /* ==========================================================
                        ADD MEMBERS
    ========================================================== */

    async addMembers(aiRequest) {

        const members = aiRequest.entities.members || [];

        if (!members.length) {

            return {

                success: false,

                message: "No members provided."

            };

        }

        const result = await TripStorage.addMembers(

            aiRequest.context.activeTripId,

            members

        );

        console.log("ADD MEMBERS RESULT:", result);

        return result;

    }

    /* ==========================================================
                        ADD EXPENSE
    ========================================================== */

    async addExpense(aiRequest) {

        const expense = aiRequest.entities.expense;

        if (!expense) {

            return {

                success: false,

                message: "Expense data missing."

            };

        }

        const result = await TripStorage.addExpense(

            aiRequest.context.activeTripId,

            expense

        );

        console.log("ADD EXPENSE RESULT:", result);

        return result;

    }

    /* ==========================================================
                        EDIT EXPENSE
    ========================================================== */

    async editExpense(aiRequest) {

        const edit = aiRequest.entities.editExpense;

        if (!edit) {

            return {

                success: false,

                message: "Edit information missing."

            };

        }

        const expensesResult = await TripStorage.getExpenses(

            aiRequest.context.activeTripId

        );

        if (!expensesResult.success) {

            return expensesResult;

        }

        const expense = expensesResult.expenses.find(e =>

            e.title.toLowerCase() ===

            edit.title.toLowerCase()

        );

        if (!expense) {

            return {

                success: false,

                message: `"${edit.title}" expense not found.`

            };

        }

        const result = await TripStorage.editExpense(

            aiRequest.context.activeTripId,

            expense.id,

            {

                ...expense,

                amount: edit.amount

            }

        );

        console.log("EDIT EXPENSE RESULT:", result);

        return result;

    }

    /* ==========================================================
                        DELETE EXPENSE
    ========================================================== */

    async deleteExpense(aiRequest) {

        const del = aiRequest.entities.deleteExpense;

        if (!del) {

            return {

                success: false,

                message: "Delete information missing."

            };

        }

        const expensesResult = await TripStorage.getExpenses(

            aiRequest.context.activeTripId

        );

        if (!expensesResult.success) {

            return expensesResult;

        }

        const expense = expensesResult.expenses.find(e =>

            e.title.toLowerCase() ===

            del.title.toLowerCase()

        );

        if (!expense) {

            return {

                success: false,

                message: `"${del.title}" expense not found.`

            };

        }

        const result = await TripStorage.deleteExpense(

            aiRequest.context.activeTripId,

            expense.id

        );

        console.log("DELETE EXPENSE RESULT:", result);

        return result;

    }

    /* ==========================================================
                        SHOW SUMMARY
    ========================================================== */

    async showSummary(aiRequest) {

        const result = await TripStorage.getTripDetails(

            aiRequest.context.activeTripId

        );

        console.log("SHOW SUMMARY RESULT:", result);

        return result;

    }

    /* ==========================================================
                        SHOW SETTLEMENTS
    ========================================================== */

    async showSettlements(aiRequest) {

        const result = await TripStorage.getSettlements(

            aiRequest.context.activeTripId

        );

        console.log("SHOW SETTLEMENTS RESULT:", result);

        return result;

    }

}

export default TripManager;