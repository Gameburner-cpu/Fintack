/* ==========================================================================
   fqDecision.js
========================================================================== */

class FinanceQueryDecision {

    async decide(aiRequest) {
        const intents = aiRequest.intents || [];

        const intent = intents.find(item => item?.module === "finance");

        if (!intent) return null;

        /* Only the top-scoring module answers. */
        if (intents[0] && intents[0].module !== "finance") return null;

        return {
            module: "finance",
            action: intent.action,
            priority: 10,
            data: {
                message: aiRequest.message,
                meta: intent.meta || {}
            }
        };
    }
}

export default FinanceQueryDecision;
