import NewsIntent from "./newsIntent.js";
import NewsDecision from "./newsDecision.js";
import NewsManager from "./newsManager.js";
import NewsFormatter from "./newsFormatter.js";

const NewsModule = {

    name: "news",

    detector: new NewsIntent(),

    extractor: null,

    provider: null,

    handler: new NewsDecision(),

    manager: new NewsManager(),

    formatter: new NewsFormatter()

};

export default NewsModule;