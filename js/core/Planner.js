/* ==========================================================================
   Planner.js
   Builds the execution plan for the AI pipeline.
========================================================================== */

class Planner {

    async build(aiRequest) {

        const plan = [];

        const modules = new Set();

        for (const intent of aiRequest.intents) {

            modules.add(intent.module);

        }

        for (const module of modules) {

            plan.push({

                module,

                priority: 1

            });

        }

        aiRequest.plan = plan;

        return aiRequest;

    }

}

export default Planner;