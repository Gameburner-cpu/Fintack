/* ==========================================================================
   newsFormatter.js
   Formats Finnhub news results for FinTack AI.
========================================================================== */

class NewsFormatter {

    async format(result, action, aiRequest) {

        console.log(
            "[NewsFormatter] Formatting:",
            result
        );

        /* =====================================================
                        ERROR RESPONSE
        ===================================================== */

        if (!result?.success) {

            return {
                message:
                    result?.message ||
                    "I couldn't load the latest news right now.",

                html: ""
            };

        }


        /* =====================================================
                        GET ARTICLES
        ===================================================== */

        const articles =
            Array.isArray(result.articles)
                ? result.articles
                : [];

        if (!articles.length) {

            return {
                message:
                    "I couldn't find any recent news for that.",
                html: ""
            };

        }


        /* =====================================================
                    LIMIT CHAT RESULTS
        ===================================================== */

        const topArticles =
            articles.slice(0, 5);


        /* =====================================================
                    DETERMINE HEADING
        ===================================================== */

        let heading =
            "Latest Market News";

        if (result.symbol) {

            heading =
                `Latest ${result.symbol} News`;

        }

        else if (
            action?.action ===
            "GET_DAILY_NEWS"
        ) {

            heading =
                "Today's Stock News";

        }


        /* =====================================================
                    BUILD TEXT MESSAGE
        ===================================================== */

        const messageParts = [
            heading
        ];

        topArticles.forEach(
            (article, index) => {

                messageParts.push(
                    `${index + 1}. ${article.headline}`
                );

            }
        );

        const message =
            messageParts.join("\n\n");


        /* =====================================================
                        BUILD HTML
        ===================================================== */

        const cards =
            topArticles
                .map(article => {

                    const headline =
                        this.escapeHTML(
                            article.headline ||
                            "Market Update"
                        );

                    const summary =
                        this.escapeHTML(
                            article.summary ||
                            ""
                        );

                    const source =
                        this.escapeHTML(
                            article.source ||
                            "News"
                        );

                    const url =
                        this.safeURL(
                            article.url
                        );

                    const date =
                        this.formatDate(
                            article.publishedAt
                        );

                    return `
                        <div class="ai-news-card">

                            <div class="ai-news-card-header">

                                <span class="ai-news-source">
                                    ${source}
                                </span>

                                ${
                                    date
                                        ? `
                                        <span class="ai-news-date">
                                            ${date}
                                        </span>
                                        `
                                        : ""
                                }

                            </div>

                            <div class="ai-news-headline">
                                ${headline}
                            </div>

                            ${
                                summary
                                    ? `
                                    <div class="ai-news-summary">
                                        ${summary}
                                    </div>
                                    `
                                    : ""
                            }

                            ${
                                url
                                    ? `
                                    <a
                                        class="ai-news-link"
                                        href="${url}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Read article ↗
                                    </a>
                                    `
                                    : ""
                            }

                        </div>
                    `;

                })
                .join("");


        const html = `

            <div class="ai-news-response">

                <div class="ai-news-title">
                    ${this.escapeHTML(heading)}
                </div>

                ${cards}

            </div>

        `;


        return {

            message,

            html

        };

    }


    /* =====================================================
                        SAFE URL
    ===================================================== */

    safeURL(value) {

        if (!value)
            return "";

        try {

            const url =
                new URL(value);

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {

                return "";

            }

            return this.escapeHTML(
                url.href
            );

        }

        catch {

            return "";

        }

    }


    /* =====================================================
                        FORMAT DATE
    ===================================================== */

    formatDate(value) {

        if (!value)
            return "";

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short"
            }
        );

    }


    /* =====================================================
                        ESCAPE HTML
    ===================================================== */

    escapeHTML(value) {

        return String(value ?? "")

            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }

}

export default NewsFormatter;