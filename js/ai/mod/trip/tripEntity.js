/* ==========================================================================
   tripEntity.js
   Extracts trip-related entities from the user's message.
========================================================================== */

class TripEntity {

    async extract(aiRequest) {

        const message = aiRequest.message.trim();

        const entities = {};

        /* ==========================================================
                            CREATE TRIP
        ========================================================== */

        if (aiRequest.intents.some(
            intent => intent.action === "CREATE_TRIP"
        )) {

            const tripName = message
                .replace(/create\s+(a\s+)?trip/i, "")
                .replace(/trip\s+called/i, "")
                .replace(/planning\s+(a\s+)?trip\s+to/i, "")
                .replace(/plan\s+(a\s+)?trip\s+to/i, "")
                .trim();

            if (tripName) {

                entities.tripName = tripName;

            }

        }

        /* ==========================================================
                            ADD MEMBERS
        ========================================================== */

        if (aiRequest.intents.some(
            intent => intent.action === "ADD_MEMBERS"
        )) {

            const members = message

                .replace(/^add\s+members?/i, "")
                .replace(/^add/i, "")
                .split(",")

                .map(name => name.trim())

                .filter(Boolean);

            if (members.length) {

                entities.members = members;

            }

        }

        /* ==========================================================
                            ADD EXPENSE
        ========================================================== */

        if (aiRequest.intents.some(
            intent => intent.action === "ADD_EXPENSE"
        )) {

            const regex =
                /(.+?)\s+paid\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:for)?\s*(.+)/i;

            const match = message.match(regex);

            if (match) {

                entities.expense = {

                    paid_by: match[1].trim(),

                    amount: Number(
                        match[2].replace(/,/g, "")
                    ),

                    title: match[3].trim(),

                    category: "General",

                    notes: ""

                };

            }

        }

        /* ==========================================================
                            RETURN
        ========================================================== */

        return Object.keys(entities).length
            ? entities
            : null;

    }

}

export default TripEntity;