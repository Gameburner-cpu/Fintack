/* ==========================================================================
   EntityEngine.js
   Extracts useful information from the user's message.
========================================================================== */

class EntityEngine {

    constructor() {

        this.extractors = [];

    }

    register(extractor) {

        this.extractors.push(extractor);

    }

    async extract(aiRequest) {

        aiRequest.entities = {};

        for (const extractor of this.extractors) {

            const result =
                await extractor.extract(aiRequest);

            if (!result)
                continue;

            Object.assign(
                aiRequest.entities,
                result
            );

        }

        return aiRequest;

    }

}

export default EntityEngine;