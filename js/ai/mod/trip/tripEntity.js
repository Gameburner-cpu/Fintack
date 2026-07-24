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
                .replace(/trip\s+to/i, "")
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
                .replace(/^include/i, "")
                .replace(/^invite/i, "")

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

            /*
                Supported Examples

                Mohith paid 500 for fuel
                Mohith spent 500 for fuel
                Mohith spent ₹500 on fuel
                Mohith paid Rs 500 for hotel
                Mohith gave 500 for food
                Mohith invested 1500 for resort
                Mohith paid 1,250 for diesel
                I paid 500 for fuel
                Dimple spent 900 on snacks
            */

            const regex = new RegExp(
    "^(.+?)\\s+(paid|spent|gave|invested)\\s+(?:rs\\.?|₹)?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:for|on)?\\s*(.+)$",
    "i"
);

            const match = message.match(regex);

            if (match) {

                entities.expense = {

                    paid_by: match[1].trim(),

                    amount: Number(

                        match[3].replace(/,/g, "")

                    ),

                    title: match[4].trim(),

                    category: "General",

                    notes: ""

                };

            }

        }

        return Object.keys(entities).length

            ? entities

            : null;

    }

}

export default TripEntity;