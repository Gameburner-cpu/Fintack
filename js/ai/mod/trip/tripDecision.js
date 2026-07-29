/* ==========================================================================
   tripDecision.js
   Smart Decision Engine for Trip Module
========================================================================== */

class TripDecision {

    async decide(aiRequest) {

        const actions = [];

        const context = aiRequest.context || {};

        const hasActiveTrip = !!context.hasActiveTrip;

        console.log("========== TripDecision ==========");
        console.log("Context:", context);
        console.log("Intents:", aiRequest.intents);

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

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

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

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

                    if (!aiRequest.entities.expense) {

                        actions.push({

                            module: "trip",

                            action: "INVALID_EXPENSE",

                            priority: 0

                        });

                        break;

                    }

                    actions.push({

                        module: "trip",

                        action: "ADD_EXPENSE",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                EDIT EXPENSE
                ====================================================== */

                case "EDIT_EXPENSE":

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

                    if (!aiRequest.entities.editExpense) {

                        actions.push({

                            module: "trip",

                            action: "INVALID_EDIT",

                            priority: 0

                        });

                        break;

                    }

                    actions.push({

                        module: "trip",

                        action: "EDIT_EXPENSE",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                DELETE EXPENSE
                ====================================================== */

                case "DELETE_EXPENSE":

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

                    if (!aiRequest.entities.deleteExpense) {

                        actions.push({

                            module: "trip",

                            action: "INVALID_DELETE",

                            priority: 0

                        });

                        break;

                    }

                    actions.push({

                        module: "trip",

                        action: "DELETE_EXPENSE",

                        priority: 1

                    });

                    break;

                /* ======================================================
                                SHOW SUMMARY
                ====================================================== */

                case "SHOW_SUMMARY":

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

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

                    if (!hasActiveTrip) {

                        actions.push({

                            module: "trip",

                            action: "NO_ACTIVE_TRIP",

                            priority: 0

                        });

                        break;

                    }

                    actions.push({

                        module: "trip",

                        action: "SHOW_SETTLEMENTS",

                        priority: 2

                    });

                    break;

                default:

                    console.warn(

                        "Unknown Trip Action:",

                        intent.action

                    );

            }

        }

        actions.sort(

            (a, b) => a.priority - b.priority

        );

        console.log("Generated Actions:", actions);
        console.log("=================================");

        return actions;

    }

}

export default TripDecision;