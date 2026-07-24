/* ==========================================================================
   tripDecision.js
   Converts trip intents into executable actions.
========================================================================== */

class TripDecision {

    async decide(aiRequest) {

        const actions = [];

        const context = aiRequest.context;

        for (const intent of aiRequest.intents) {

            if (intent.module !== "trip")
                continue;

            switch (intent.action) {

                /* ======================================================
                                CREATE TRIP
                ====================================================== */

                case "CREATE_TRIP":

                    actions.push({

                        module: "trip",

                        action: "CREATE_TRIP",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                ADD MEMBERS
                ====================================================== */

                case "ADD_MEMBERS":

                    if (!context.hasActiveTrip)
                        break;

                    actions.push({

                        module: "trip",

                        action: "ADD_MEMBERS",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                ADD EXPENSE
                ====================================================== */

                case "ADD_EXPENSE":

                    if (!context.hasActiveTrip)
                        break;

                    actions.push({

                        module: "trip",

                        action: "ADD_EXPENSE",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                SHOW SUMMARY
                ====================================================== */

                case "SHOW_SUMMARY":

                    if (!context.hasActiveTrip)
                        break;

                    actions.push({

                        module: "trip",

                        action: "SHOW_SUMMARY",

                        priority: 2

                    });

                    break;

                /* ======================================================
                                SHOW SETTLEMENTS
                ====================================================== */

                case "SHOW_SETTLEMENTS":

                    if (!context.hasActiveTrip)
                        break;

                    actions.push({

                        module: "trip",

                        action: "SHOW_SETTLEMENTS",

                        priority: 2

                    });

                    break;

            }

        }

        return actions;

    }

}

export default TripDecision;