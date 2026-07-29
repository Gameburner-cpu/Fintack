/* ==========================================================================
   tripIntent.js
   Smart Trip Intent Detector
========================================================================== */


class TripIntent {

    detect(aiRequest) {

        const text = aiRequest.message
            .toLowerCase()
            .trim();

        /* =====================================================
                CREATE TRIP
===================================================== */

if (

    /^create\s+/i.test(text) ||

    /^start\s+/i.test(text) ||

    /^new\s+trip/i.test(text) ||

    /^plan\s+/i.test(text) ||

    /^planning\s+/i.test(text) ||

    /^trip\s+to/i.test(text) ||

    /^go\s+to/i.test(text) ||

    /^let'?s\s+go\s+to/i.test(text) ||

    text.includes(" trip")

) {

    console.log("CREATE_TRIP matched:", text);

    return {

        module: "trip",

        action: "CREATE_TRIP",

        confidence: 100

    };

}

        /* =====================================================
                        ADD MEMBERS
        ===================================================== */

        if (

            text.startsWith("add ") ||

            text.startsWith("include ") ||

            text.startsWith("invite ") ||

            text.startsWith("bring ") ||

            text.includes(" is joining") ||

            text.includes(" joined")

        ) {

            return {

                module: "trip",

                action: "ADD_MEMBERS",

                confidence: 95

            };

        }

        /* =====================================================
                        EDIT EXPENSE
        ===================================================== */

        if (

            /^change\s+/i.test(text) ||

            /^update\s+/i.test(text) ||

            /^modify\s+/i.test(text) ||

            text.includes(" should be ") ||

            text.includes(" actually ")

        ) {

            return {

                module: "trip",

                action: "EDIT_EXPENSE",

                confidence: 95

            };

        }

        /* =====================================================
                        DELETE EXPENSE
        ===================================================== */

        if (

            /^delete\s+/i.test(text) ||

            /^remove\s+/i.test(text) ||

            /^erase\s+/i.test(text)

        ) {

            return {

                module: "trip",

                action: "DELETE_EXPENSE",

                confidence: 95

            };

        }

        /* =====================================================
                        ADD EXPENSE
        ===================================================== */

        if (

            /(paid|spent|gave|invested|bought)/i.test(text) ||

            /^[a-zA-Z ]+\s+(₹|rs\.?)?\s*\d/i.test(text) ||

            /^spent\s+(₹|rs\.?)?\s*\d/i.test(text) ||

            /^paid\s+(₹|rs\.?)?\s*\d/i.test(text)

        ) {

            return {

                module: "trip",

                action: "ADD_EXPENSE",

                confidence: 95

            };

        }

        /* =====================================================
                        SHOW SUMMARY
        ===================================================== */

        if (

            text.includes("summary") ||

            text.includes("show summary") ||

            text.includes("trip summary") ||

            text.includes("trip details") ||

            text.includes("show trip") ||

            text.includes("how much spent") ||

            text.includes("total expense")

        ) {

            return {

                module: "trip",

                action: "SHOW_SUMMARY",

                confidence: 90

            };

        }

        /* =====================================================
                        SHOW SETTLEMENTS
        ===================================================== */

        if (

            text.includes("who owes") ||

            text.includes("settlement") ||

            text.includes("settle") ||

            text.includes("split") ||

            text.includes("split bill") ||

            text.includes("split expenses") ||

            text.includes("split cost") ||

            text.includes("split costs") ||

            text.includes("balance trip") ||

            text.includes("balance expenses") ||

            text.includes("calculate split") ||

            text.includes("calculate settlement") ||

            text.includes("who should pay")

        ) {

            return {

                module: "trip",

                action: "SHOW_SETTLEMENTS",

                confidence: 95

            };

        }

        return null;

    }

}

export default TripIntent;