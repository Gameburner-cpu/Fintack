/* ==========================================================================
   txDecision.js
   Turns a transaction intent into an executable action.
========================================================================== */

class TransactionDecision {

    async decide(aiRequest) {
        const intents = aiRequest.intents || [];

        const intent = intents.find(item => item?.module === "transactions");

        if (!intent) return null;

        /*
            The decision engine runs every handler, so without this check two
            modules could both answer the same message. Only the winning
            intent gets to act.
        */
        const top = intents[0];

        if (top && top.module !== "transactions") return null;

        return {
            module: "transactions",
            action: intent.action,
            priority: 5,
            data: {
                message: aiRequest.message,
                entities: aiRequest.entities?.transaction || {}
            }
        };
    }
}

export default TransactionDecision;
