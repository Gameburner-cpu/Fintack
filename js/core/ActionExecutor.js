/* ==========================================================================
   ActionExecutor.js
   Executes actions produced by the Decision Engine.
========================================================================== */

class ActionExecutor {

    constructor() {

        this.modules = new Map();

    }

    register(name, manager) {

        this.modules.set(name, manager);

    }

    async execute(aiRequest) {

        aiRequest.results = [];

        for (const action of aiRequest.actions) {

            const manager =
                this.modules.get(action.module);

            if (!manager)
                continue;

            const result =
                await manager.execute(

                    action,

                    aiRequest

                );

            aiRequest.results.push({

            module: action.module,

            action,

            result

        });

        }

        return aiRequest;

    }

}

export default ActionExecutor;