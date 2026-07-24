/* ==========================================================================
   tripIntent.js
   Trip Intent Detector
========================================================================== */

class TripIntent {

    detect(aiRequest) {

        const text = aiRequest.message
            .toLowerCase()
            .trim();

        /* =====================================================
                        CREATE TRIP
        ===================================================== */

        const createTripPatterns = [

            /^create\s+(a\s+)?trip/,
            /^start\s+(a\s+)?trip/,
            /^new\s+trip/,
            /^plan\s+(a\s+)?trip/,
            /^planning\s+(a\s+)?trip/,
            /trip\s+called/,
            /trip\s+to/,
            /going\s+to/,
            /travel\s+to/,
            /vacation\s+to/,
            /holiday\s+to/

        ];

        if (

            createTripPatterns.some(

                pattern => pattern.test(text)

            )

        ) {

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

            text.startsWith("invite ")

        ) {

            return {

                module: "trip",

                action: "ADD_MEMBERS",

                confidence: 95

            };

        }

        /* =====================================================
                        ADD EXPENSE
        ===================================================== */

        if (

            /(paid|spent|gave)\b/.test(text)

        ) {

            return {

                module: "trip",

                action: "ADD_EXPENSE",

                confidence: 95

            };

        }

        /* =====================================================
                        SUMMARY
        ===================================================== */

        if (

            text.includes("summary") ||

            text.includes("show summary") ||

            text.includes("trip summary")

        ) {

            return {

                module: "trip",

                action: "SHOW_SUMMARY",

                confidence: 90

            };

        }

        /* =====================================================
                        SETTLEMENT
        ===================================================== */

        if (

            text.includes("who owes") ||

            text.includes("settlement") ||

            text.includes("settle")

        ) {

            return {

                module: "trip",

                action: "SHOW_SETTLEMENTS",

                confidence: 90

            };

        }

        return null;

    }

}

export default TripIntent;