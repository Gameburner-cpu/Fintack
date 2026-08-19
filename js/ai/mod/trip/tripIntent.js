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

        /*
            "add ..." on its own is far too broad: it swallowed
            "add ₹500 spent on food today" at confidence 95 and beat the
            transaction module, so every chatbot expense became a trip
            member. Adding members now requires an active trip AND no money
            amount in the sentence.
        */

        const hasActiveTrip = Boolean(
            (typeof window !== "undefined" && window.activeTripId) ||
            aiRequest?.context?.trip?.active ||
            aiRequest?.memory?.get?.("trip.active")
        );

        const mentionsMoney =
            /(?:₹|rs\.?|inr)\s*\d|\d+\s*(?:rupees?|k\b|lakhs?|cr\b)|\b\d{2,}\b/i
                .test(text);

        const memberPhrasing =
            text.includes(" is joining") ||
            text.includes(" joined") ||
            /\b(member|members|people|friends?|group)\b/i.test(text);

        const addPrefix =
            text.startsWith("add ") ||
            text.startsWith("include ") ||
            text.startsWith("invite ") ||
            text.startsWith("bring ");

        if (
            (memberPhrasing && (hasActiveTrip || /\btrip\b/i.test(text))) ||
            (addPrefix && hasActiveTrip && !mentionsMoney)
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

        /*
            Same problem as ADD_MEMBERS: a bare "change ..." outranked the
            transaction module, so "change yesterday's food expense from
            ₹500 to ₹700" tried to edit a trip expense. Editing a trip
            expense now requires an active trip or an explicit trip mention.
        */

        const editPhrasing =
            /^change\s+/i.test(text) ||
            /^update\s+/i.test(text) ||
            /^modify\s+/i.test(text) ||
            text.includes(" should be ") ||
            text.includes(" actually ");

        if (
            editPhrasing &&
            (hasActiveTrip || /\btrip\b/i.test(text))
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

        /*
            A trip expense is inherently "<person> paid <amount> for <thing>".
            The old rule fired on the bare word "spent" or "paid" anywhere in
            the message, so ordinary personal expenses - and even
            "can I afford a ₹60,000 laptop" - were routed to the trip
            module. It now requires the split-expense shape or an active trip.
        */

        const splitExpenseShape =
            /^[a-z][a-z\s]{1,30}\s+(?:paid|spent|gave)\s+(?:₹|rs\.?|inr)?\s*\d/i
                .test(text);

        const personalSpendVerb =
            /(paid|spent|gave|invested|bought)/i.test(text);

        if (
            splitExpenseShape ||
            (personalSpendVerb && hasActiveTrip) ||
            (personalSpendVerb && /\btrip\b/i.test(text))
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

            (hasActiveTrip &&
                (text.includes("how much spent") ||
                 text.includes("total expense")))

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