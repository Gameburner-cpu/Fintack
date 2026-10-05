/* ==========================================================================
   goalDecision.js
========================================================================== */

class GoalDecision {

    async decide(aiRequest) {
        const intents = aiRequest.intents || [];

        const intent = intents.find(item => item?.module === "goals");

        if (!intent) return null;

        if (intents[0] && intents[0].module !== "goals") return null;

        return {
            module: "goals",
            action: intent.action,
            priority: 15,
            data: {
                message: aiRequest.message
            }
        };
    }
}

export default GoalDecision;
