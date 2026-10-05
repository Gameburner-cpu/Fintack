/* ==========================================================================
   newsDecision.js
   Converts detected news intents into executable actions.
========================================================================== */

class NewsDecision {

    async decide(aiRequest) {

        const intents = aiRequest.intents || [];

        /* =====================================================
                    FIND NEWS INTENT
        ===================================================== */

        const newsIntent = intents.find(
            intent => intent?.module === "news"
        );

        if (!newsIntent) {
            return null;
        }

        console.log(
            "[NewsDecision] News intent detected:",
            newsIntent
        );

        /* =====================================================
                    COMPANY / STOCK NEWS
        ===================================================== */

        if (
            newsIntent.action === "GET_COMPANY_NEWS" ||
            newsIntent.action === "GET_NEWS" ||
            newsIntent.action === "SEARCH_NEWS"
        ) {

            return {

                module: "news",

                action: "GET_COMPANY_NEWS",

                priority: 10,

                data: {
                    query: aiRequest.message
                }

            };

        }

        /* =====================================================
                    GENERAL MARKET NEWS
        ===================================================== */

        if (
            newsIntent.action === "GET_MARKET_NEWS" ||
            newsIntent.action === "MARKET_NEWS"
        ) {

            return {

                module: "news",

                action: "GET_MARKET_NEWS",

                priority: 10,

                data: {
                    query: aiRequest.message
                }

            };

        }

        /* =====================================================
                    DAILY NEWS
        ===================================================== */

        if (
            newsIntent.action === "GET_DAILY_NEWS" ||
            newsIntent.action === "DAILY_NEWS"
        ) {

            return {

                module: "news",

                action: "GET_DAILY_NEWS",

                priority: 10,

                data: {
                    query: aiRequest.message
                }

            };

        }

        console.warn(
            "[NewsDecision] Unsupported news action:",
            newsIntent.action
        );

        return null;

    }

}

export default NewsDecision;