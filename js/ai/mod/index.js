/* ==========================================================================
   Module registry.

   Order does not decide who answers - intent confidence does - but keeping
   the specific modules above the general ones makes the intent flow easier
   to follow when debugging.
========================================================================== */

import TransactionModule from "./transactions/index.js";
import FinanceModule from "./finance/index.js";
import GoalModule from "./goals/index.js";
import TripModule from "./trip/index.js";
import NewsModule from "./news/index.js";
import KnowledgeModule from "./knowledge/index.js";

const Modules = [

    /* Commands that write data */
    TransactionModule,

    /* Questions about the user's own data */
    FinanceModule,
    GoalModule,

    /* Feature modules */
    TripModule,
    NewsModule,

    /* General finance education + safety net (must stay last) */
    KnowledgeModule

];

export default Modules;
