import GoalIntent from "./goalIntent.js";
import GoalDecision from "./goalDecision.js";
import GoalManager from "./goalManager.js";
import GoalFormatter from "./goalFormatter.js";

const GoalModule = {

    name: "goals",

    detector: new GoalIntent(),

    extractor: null,

    provider: null,

    handler: new GoalDecision(),

    manager: new GoalManager(),

    formatter: new GoalFormatter()

};

export default GoalModule;
