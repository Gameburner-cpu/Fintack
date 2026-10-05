import TransactionIntent from "./txIntent.js";
import TransactionEntity from "./txEntity.js";
import TransactionDecision from "./txDecision.js";
import TransactionManager from "./txManager.js";
import TransactionFormatter from "./txFormatter.js";

const TransactionModule = {

    name: "transactions",

    detector: new TransactionIntent(),

    extractor: new TransactionEntity(),

    provider: null,

    handler: new TransactionDecision(),

    manager: new TransactionManager(),

    formatter: new TransactionFormatter()

};

export default TransactionModule;
