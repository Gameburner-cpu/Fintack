import KnowledgeIntent from "./kbIntent.js";
import KnowledgeDecision from "./kbDecision.js";
import KnowledgeManager from "./kbManager.js";
import KnowledgeFormatter from "./kbFormatter.js";

const KnowledgeModule = {

    name: "knowledge",

    detector: new KnowledgeIntent(),

    extractor: null,

    provider: null,

    handler: new KnowledgeDecision(),

    manager: new KnowledgeManager(),

    formatter: new KnowledgeFormatter()

};

export default KnowledgeModule;
