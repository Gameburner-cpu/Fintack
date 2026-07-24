/* ==========================================================================
   DecisionEngine.js
   Converts AI understanding into executable actions.
========================================================================== */

class DecisionEngine {

    constructor() {

        this.handlers = [];

    }

    register(handler) {

        this.handlers.push(handler);

    }

    async decide(aiRequest) {

        aiRequest.actions = [];

        for (const handler of this.handlers) {

            const result =
                await handler.decide(aiRequest);

            if (!result)
                continue;

            if (Array.isArray(result)) {

                aiRequest.actions.push(...result);

            }

            else {

                aiRequest.actions.push(result);

            }

        }

        aiRequest.actions.sort(

            (a, b) =>

                (a.priority ?? 999) -

                (b.priority ?? 999)

        );

        return aiRequest;

    }

}

export default DecisionEngine;