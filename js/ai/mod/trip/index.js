import TripIntent from "./tripIntent.js";
import TripEntity from "./tripEntity.js";
import TripContext from "./tripContext.js";
import TripDecision from "./tripDecision.js";
import TripManager from "./tripManager.js";
import TripFormatter from "./tripFormatter.js";

const TripModule = {

    name: "trip",

    detector: new TripIntent(),

    extractor: new TripEntity(),

    provider: new TripContext(),

    handler: new TripDecision(),

    manager: new TripManager(),

    formatter: new TripFormatter()

};

export default TripModule;