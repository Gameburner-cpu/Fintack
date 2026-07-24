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

            case "SHOW_SUMMARY":
                return await this.showSummary(aiRequest);

            case "SHOW_SETTLEMENTS":
                return await this.showSettlements(aiRequest);

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

        const result =
            await TripStorage.createTrip(

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

        const members = aiRequest.entities.members;

        const result =
            await TripStorage.addMembers(

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

        const result =
            await TripStorage.addExpense(

                aiRequest.context.activeTripId,

                aiRequest.entities.expense

            );

        console.log("ADD EXPENSE RESULT:", result);

        return result;

    }

    /* ==========================================================
                        SHOW SUMMARY
    ========================================================== */

    async showSummary(aiRequest) {

        const result =
            await TripStorage.getTripDetails(

                aiRequest.context.activeTripId

            );

        console.log("SHOW SUMMARY RESULT:", result);

        return result;

    }

    /* ==========================================================
                        SHOW SETTLEMENTS
    ========================================================== */

    async showSettlements(aiRequest) {

        const result =
            await TripStorage.getSettlements(

                aiRequest.context.activeTripId

            );

        console.log("SHOW SETTLEMENTS RESULT:", result);

        return result;

    }

}

export default TripManager;