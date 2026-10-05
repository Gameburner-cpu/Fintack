/* ==========================================================================
   kbDecision.js
========================================================================== */

class KnowledgeDecision {

    async decide(aiRequest) {
        const intents = aiRequest.intents || [];

        const intent = intents.find(item => item?.module === "knowledge");

        if (!intent) return null;

        /*
            Knowledge is the lowest priority module by design: it only speaks
            when nothing more specific claimed the message.
        */
        if (intents[0] && intents[0].module !== "knowledge") return null;

        return {
            module: "knowledge",
            action: intent.action,
            priority: 90,
            data: {
                message: aiRequest.message,
                meta: intent.meta || {}
            }
        };
    }
}

export default KnowledgeDecision;
