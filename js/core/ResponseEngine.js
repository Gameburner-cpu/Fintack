/* ==========================================================================
   ResponseEngine.js
   Builds the final AI response from executed actions.
========================================================================== */

class ResponseEngine {

    constructor() {

        this.formatters = new Map();

    }

    register(moduleName, formatter) {

        this.formatters.set(

            moduleName,

            formatter

        );

    }

    async generate(aiRequest) {

        const responses = [];

        for (const execution of aiRequest.results) {

            const {

                action,

                result

            } = execution;

            const formatter =
                this.formatters.get(action.module);

            if (!formatter)
                continue;

            const formatted =
                await formatter.format(

                    result,

                    action,

                    aiRequest

                );

            /* ==========================================================
                            NORMALIZE RESPONSE
            ========================================================== */

            if (typeof formatted === "string") {

                responses.push({

                    message: formatted,

                    html: ""

                });

            }

            else {

                responses.push({

                    message: formatted.message || "",

                    html: formatted.html || ""

                });

            }

        }

        aiRequest.response = {

            success: true,

            responses

        };

        return aiRequest;

    }

}

export default ResponseEngine;