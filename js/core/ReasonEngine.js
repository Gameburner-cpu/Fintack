/* ==========================================================================
   ReasonEngine.js
   Infers secondary effects and enriches AI decisions.
========================================================================== */

class ReasonEngine {

    async reason(aiRequest) {

        aiRequest.reasoning = [];

        for (const action of aiRequest.actions) {

            switch (action.action) {

                case "ADD_EXPENSE":

                    aiRequest.reasoning.push({

                        event: "budget.update"

                    });

                    aiRequest.reasoning.push({

                        event: "analytics.refresh"

                    });

                    break;

                case "CREATE_TRIP":

                    aiRequest.reasoning.push({

                        event: "trip.created"

                    });

                    break;

                case "ADD_MEMBERS":

                    aiRequest.reasoning.push({

                        event: "trip.members.updated"

                    });

                    break;

            }

        }

        return aiRequest;

    }

}

export default ReasonEngine;