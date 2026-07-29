/* ==========================================================================
   ResponseEngine.js
   Builds the final AI response from executed actions.
========================================================================== */

class ResponseEngine {

    constructor() {

        this.formatters = new Map();

    }

    /* ==========================================================
                        REGISTER FORMATTER
    ========================================================== */

    register(moduleName, formatter) {

        this.formatters.set(

            moduleName,

            formatter

        );

    }

    /* ==========================================================
                        GENERATE RESPONSE
    ========================================================== */

    async generate(aiRequest) {

        const responses = [];

        const results =

            aiRequest.results || [];

        for (const execution of results) {

            if (!execution)
                continue;

            const {

                action,

                result

            } = execution;

            if (!action)
                continue;

            const formatter =

                this.formatters.get(

                    action.module

                );

            /* ===============================================
                        NO FORMATTER
            =============================================== */

            if (!formatter) {

                console.warn(

                    `No formatter registered for module: ${action.module}`

                );

                responses.push({

                    module: action.module,

                    action: action.action,

                    success: false,

                    message:

                        result?.message ||

                        "No formatter available.",

                    html: ""

                });

                continue;

            }

            let formatted;

            try {

                formatted =

                    await formatter.format(

                        result,

                        action,

                        aiRequest

                    );

            }

            catch (error) {

                console.error(

                    "Formatter Error:",

                    error

                );

                responses.push({

                    module: action.module,

                    action: action.action,

                    success: false,

                    message:

                        "Unable to build response.",

                    html: ""

                });

                continue;

            }

            /* ===============================================
                        STRING RESPONSE
            =============================================== */

            if (

                typeof formatted ===

                "string"

            ) {

                responses.push({

                    module: action.module,

                    action: action.action,

                    success:

                        result?.success ??

                        true,

                    message: formatted,

                    html: ""

                });

                continue;

            }

            /* ===============================================
                        OBJECT RESPONSE
            =============================================== */

            responses.push({

                module: action.module,

                action: action.action,

                success:

                    result?.success ??

                    true,

                message:

                    formatted?.message ||

                    "",

                html:

                    formatted?.html ||

                    ""

            });

        }

        /* ===============================================
                    FALLBACK RESPONSE
        =============================================== */

        if (!responses.length) {

            responses.push({

                module: "system",

                action: "EMPTY",

                success: false,

                message:

                    "I couldn't understand that. Could you try rephrasing?",

                html: ""

            });

        }

        aiRequest.response = {

            success:

                responses.some(

                    r => r.success

                ),

            responses

        };

        return aiRequest;

    }

}

export default ResponseEngine;