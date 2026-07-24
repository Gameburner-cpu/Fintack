/* ==========================================================================
   tripManager.js
   Executes trip actions using TripStorage.
========================================================================== */

import TripStorage from "./tripStorage.js";

class TripManager {

    async execute(action, aiRequest) {

        switch (action.action) {

            /* ==========================================================
                            CREATE TRIP
            ========================================================== */

            case "CREATE_TRIP":

                return await this.createTrip(aiRequest);

            /* ==========================================================
                            ADD MEMBERS
            ========================================================== */

            case "ADD_MEMBERS":

                return await this.addMembers(aiRequest);

            /* ==========================================================
                            ADD EXPENSE
            ========================================================== */

            case "ADD_EXPENSE":

                return await this.addExpense(aiRequest);

            /* ==========================================================
                            SHOW SUMMARY
            ========================================================== */

            case "SHOW_SUMMARY":

                return await this.showSummary(aiRequest);

            /* ==========================================================
                            SHOW SETTLEMENTS
            ========================================================== */

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

        if (result.success) {

            window.activeTripId =
                result.trip.id;

        }

        return result;

    }

    /* ==========================================================
                        ADD MEMBERS
    ========================================================== */

    async addMembers(aiRequest) {

        const members =
            aiRequest.entities.members;

        return await TripStorage.addMembers(

            aiRequest.context.activeTripId,

            members

        );

    }

    /* ==========================================================
                        ADD EXPENSE
    ========================================================== */

    async addExpense(aiRequest) {

        return await TripStorage.addExpense(

            aiRequest.context.activeTripId,

            aiRequest.entities.expense

        );

    }

    /* ==========================================================
                        SHOW SUMMARY
    ========================================================== */

    async showSummary(aiRequest) {

        return await TripStorage.getTripDetails(

            aiRequest.context.activeTripId

        );

    }

    /* ==========================================================
                        SHOW SETTLEMENTS
    ========================================================== */

    async showSettlements(aiRequest) {

        return await TripStorage.getSettlements(

            aiRequest.context.activeTripId

        );

    }

}

export default TripManager;