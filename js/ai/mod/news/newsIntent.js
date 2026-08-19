/* ==========================================================================
   newsIntent.js
   FinTack News Intent Detector
========================================================================== */

class NewsIntent {

    detect(aiRequest) {

        const text = String(aiRequest.message || "")
            .toLowerCase()
            .trim();

        /* =====================================================
                        LATEST NEWS
        ===================================================== */

        if (
            text.includes("latest news") ||
            text.includes("recent news") ||
            text.includes("today's news") ||
            text.includes("todays news") ||
            text.includes("market news") ||
            text.includes("stock news") ||
            text.includes("financial news") ||
            text.includes("business news")
        ) {

            return {
                module: "news",
                action: "GET_NEWS",
                confidence: 100
            };

        }

        /* =====================================================
                    NEWS ABOUT SOMETHING
        ===================================================== */

        if (
            text.includes("news about") ||
            text.includes("news on") ||
            text.includes("what happened with") ||
            text.includes("what happened to")
        ) {

            return {
                module: "news",
                action: "GET_NEWS",
                confidence: 95
            };

        }

        /* =====================================================
                    COMPANY / STOCK NEWS
        ===================================================== */

        if (
            text.includes("nvidia") ||
            text.includes("nvda") ||
            text.includes("apple") ||
            text.includes("aapl") ||
            text.includes("microsoft") ||
            text.includes("msft") ||
            text.includes("tesla") ||
            text.includes("tsla") ||
            text.includes("amazon") ||
            text.includes("amzn") ||
            text.includes("google") ||
            text.includes("googl") ||
            text.includes("meta")
        ) {

            if (
                text.includes("news") ||
                text.includes("latest") ||
                text.includes("recent") ||
                text.includes("happening")
            ) {

                return {
                    module: "news",
                    action: "GET_NEWS",
                    confidence: 95
                };

            }

        }

        return null;

    }

}

export default NewsIntent;