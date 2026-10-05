import FinanceQueryIntent from "./fqIntent.js";
import FinanceQueryDecision from "./fqDecision.js";
import FinanceQueryManager from "./fqManager.js";
import FinanceQueryFormatter from "./fqFormatter.js";

const FinanceModule = {

    name: "finance",

    detector: new FinanceQueryIntent(),

    extractor: null,

    provider: null,

    handler: new FinanceQueryDecision(),

    manager: new FinanceQueryManager(),

    formatter: new FinanceQueryFormatter()

};

export default FinanceModule;
