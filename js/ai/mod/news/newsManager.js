import { API_BASE_URL } from "../../../core/config.js";
/* ==========================================================================
   newsManager.js
   Executes FinTack news actions using the backend Finnhub routes.
========================================================================== */

class NewsManager {

    constructor() {

        this.baseURL =
            `${API_BASE_URL}/news`;

    }

    /* ==========================================================
                        EXECUTE ACTION
    ========================================================== */

    async execute(action, aiRequest) {

        console.log(
            "[NewsManager] Executing:",
            action
        );

        switch (action.action) {

            case "GET_COMPANY_NEWS":
                return await this.getCompanyNews(
                    action,
                    aiRequest
                );

            case "GET_MARKET_NEWS":
                return await this.getMarketNews(
                    action,
                    aiRequest
                );

            case "GET_DAILY_NEWS":
                return await this.getDailyNews(
                    action,
                    aiRequest
                );

            default:

                return {

                    success: false,

                    message:
                        `Unknown news action: ${action.action}`

                };

        }

    }


    /* ==========================================================
                    COMPANY / STOCK NEWS
    ========================================================== */

    async getCompanyNews(action, aiRequest) {

        try {

            const message =
                aiRequest.message || "";

            const symbol =
                this.extractSymbol(message);

            console.log(
                "[NewsManager] Detected symbol:",
                symbol
            );

            /*
                If we cannot identify a company,
                fall back to general market news.
            */

            if (!symbol) {

                return await this.getMarketNews(
                    action,
                    aiRequest
                );

            }

            const url =
                `${this.baseURL}/company/${encodeURIComponent(symbol)}` +
                `?days=7&limit=10`;

            console.log(
                "[NewsManager] Fetching:",
                url
            );

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Unable to fetch company news."
                );

            }

            return data;

        }

        catch (error) {

            console.error(
                "[NewsManager] Company news error:",
                error
            );

            return {

                success: false,

                message:
                    error.message ||
                    "Unable to load company news."

            };

        }

    }


    /* ==========================================================
                        MARKET NEWS
    ========================================================== */

    async getMarketNews(action, aiRequest) {

        try {

            const url =
                `${this.baseURL}/market?category=general&limit=10`;

            console.log(
                "[NewsManager] Fetching market news:",
                url
            );

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Unable to fetch market news."
                );

            }

            return data;

        }

        catch (error) {

            console.error(
                "[NewsManager] Market news error:",
                error
            );

            return {

                success: false,

                message:
                    error.message ||
                    "Unable to load market news."

            };

        }

    }


    /* ==========================================================
                        DAILY NEWS
    ========================================================== */

    async getDailyNews(action, aiRequest) {

        try {

            const url =
                `${this.baseURL}/daily?limit=10`;

            console.log(
                "[NewsManager] Fetching daily news:",
                url
            );

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Unable to fetch daily news."
                );

            }

            return data;

        }

        catch (error) {

            console.error(
                "[NewsManager] Daily news error:",
                error
            );

            return {

                success: false,

                message:
                    error.message ||
                    "Unable to load daily news."

            };

        }

    }


    /* ==========================================================
                    COMPANY → SYMBOL DETECTION
    ========================================================== */

    extractSymbol(message) {

        const text =
            String(message || "")
                .toLowerCase();

        /*
            For now we keep this small and reliable.

            Later we'll replace this with a proper
            company/symbol resolver.
        */

        const companies = {

            nvidia: "NVDA",
            nvda: "NVDA",

            apple: "AAPL",
            aapl: "AAPL",

            microsoft: "MSFT",
            msft: "MSFT",

            amazon: "AMZN",
            amzn: "AMZN",

            google: "GOOGL",
            alphabet: "GOOGL",
            googl: "GOOGL",

            meta: "META",
            facebook: "META",

            tesla: "TSLA",
            tsla: "TSLA",

            amd: "AMD",

            intel: "INTC",
            intc: "INTC"

        };

        for (
            const [name, symbol]
            of Object.entries(companies)
        ) {

            const pattern =
                new RegExp(
                    `\\b${name}\\b`,
                    "i"
                );

            if (pattern.test(text)) {

                return symbol;

            }

        }

        return null;

    }

}

export default NewsManager;