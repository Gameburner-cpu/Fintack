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
           Keep the AI response compact and readable.
        ===================================================== */

        const topArticles =
            articles.slice(0, 3);


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
                    BUILD HTML CARDS
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
                        <article class="ai-news-card">

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

                            <h4 class="ai-news-headline">
                                ${headline}
                            </h4>

                            ${
                                summary
                                    ? `
                                    <p class="ai-news-summary">
                                        ${summary}
                                    </p>
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
                                        Read More ↗
                                    </a>
                                    `
                                    : ""
                            }

                        </article>
                    `;

                })
                .join("");


        const html = `

            <div class="ai-news-response">

                <div class="ai-news-response-header">

                    <div class="ai-news-title">
                        ${this.escapeHTML(heading)}
                    </div>

                    <div class="ai-news-count">
                        ${topArticles.length}
                        ${topArticles.length === 1 ? "story" : "stories"}
                    </div>

                </div>

                <div class="ai-news-list">
                    ${cards}
                </div>

            </div>

        `;


        /* =====================================================
                    IMPORTANT:
           Do not duplicate the headlines as plain text.

           ResponseEngine/UI can render the HTML cards while the
           message remains empty.
        ===================================================== */

        return {

            message: "",

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
