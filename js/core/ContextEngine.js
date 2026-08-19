/* ==========================================================================
   ContextEngine.js
   Loads all relevant context before any decision is made.
========================================================================== */

class ContextEngine {

    constructor() {

        this.providers = [];

    }

    register(provider) {

        this.providers.push(provider);

    }

    async load(aiRequest) {

        aiRequest.context = {};

        for (const provider of this.providers) {

            const result =
                await provider.load(aiRequest);

            if (!result)
                continue;

            Object.assign(
                aiRequest.context,
                result
            );

        }

        return aiRequest;

    }

}

export default ContextEngine;