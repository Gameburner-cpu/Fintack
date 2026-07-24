/* ==========================================================================
   tripDecision.js
   Converts trip intents into executable actions.
========================================================================== */

class TripDecision {

    async decide(aiRequest) {

        const actions = [];

        const context = aiRequest.context || {};

        console.log("========== TripDecision ==========");
        console.log("Received Intents:", aiRequest.intents);
        console.log("Context:", context);

        for (const intent of aiRequest.intents) {

            console.log("Processing Intent:", intent);

            if (intent.module !== "trip") {
                console.log("Skipped (Not Trip Module)");
                continue;
            }

            console.log("Intent Action:", intent.action);

            switch (intent.action) {

                /* ======================================================
                                CREATE TRIP
                ====================================================== */

                case "CREATE_TRIP":

                    console.log("Matched CREATE_TRIP");

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

                    if (!context.hasActiveTrip) {
                        console.log("Skipped ADD_MEMBERS (No Active Trip)");
                        break;
                    }

                    console.log("Matched ADD_MEMBERS");

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

                    if (!context.hasActiveTrip) {
                        console.log("Skipped ADD_EXPENSE (No Active Trip)");
                        break;
                    }

                    console.log("Matched ADD_EXPENSE");

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

                    if (!context.hasActiveTrip) {
                        console.log("Skipped SHOW_SUMMARY (No Active Trip)");
                        break;
                    }

                    console.log("Matched SHOW_SUMMARY");

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

                    if (!context.hasActiveTrip) {
                        console.log("Skipped SHOW_SETTLEMENTS (No Active Trip)");
                        break;
                    }

                    console.log("Matched SHOW_SETTLEMENTS");

                    actions.push({
                        module: "trip",
                        action: "SHOW_SETTLEMENTS",
                        priority: 2
                    });

                    break;

                default:

                    console.warn("Unknown Action:", intent.action);

            }

        }

        console.log("Generated Actions:", actions);
        console.log("=================================");

        return actions;

    }

}

export default TripDecision;