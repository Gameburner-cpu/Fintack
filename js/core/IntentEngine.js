/* ==========================================================================
   IntentEngine.js
   Detects what the user wants.
========================================================================== */

class IntentEngine {

    constructor() {

        this.detectors = [];

    }

    register(detector) {

        this.detectors.push(detector);

    }

    async detect(aiRequest) {

        aiRequest.intents = [];

        for(const detector of this.detectors){

            const result =
                await detector.detect(aiRequest);

            if(result){

                aiRequest.intents.push(result);

            }

        }

        aiRequest.intents.sort(

            (a,b)=>b.confidence-a.confidence

        );

        return aiRequest;

    }

}

export default IntentEngine;