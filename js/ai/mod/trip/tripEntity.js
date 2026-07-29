/* ==========================================================================
   tripEntity.js
   Smart Trip Entity Extractor
========================================================================== */

import MoneyParser from "../../utils/MoneyParser.js";

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

            let tripName = message

                .replace(/^create\s+(a\s+)?trip/i, "")
                .replace(/^start\s+(a\s+)?trip/i, "")
                .replace(/^new\s+trip/i, "")
                .replace(/^plan\s+(a\s+)?trip\s+to/i, "")
                .replace(/^planning\s+(a\s+)?trip\s+to/i, "")
                .replace(/^trip\s+called/i, "")
                .replace(/^trip\s+to/i, "")
                .replace(/^travel\s+to/i, "")
                .replace(/^vacation\s+to/i, "")
                .replace(/^holiday\s+to/i, "")
                .replace(/^let'?s\s+go\s+to/i, "")
                .trim();

            if (tripName.endsWith("trip")) {

                tripName = tripName
                    .replace(/trip$/i, "")
                    .trim();

            }

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

            let names = message

                .replace(/^add\s+members?/i, "")
                .replace(/^add/i, "")
                .replace(/^include/i, "")
                .replace(/^invite/i, "")
                .replace(/^bring/i, "")
                .replace(/\bis joining\b/i, "")
                .replace(/\bjoined\b/i, "")
                .trim();

            const members = names

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

            const patterns = [

                /^(.+?)\s+(paid|spent|gave|invested|bought)\s+(?:₹|rs\.?)?\s*([\w.,]+)\s*(?:for|on)?\s*(.+)$/i,

                /^spent\s+(?:₹|rs\.?)?\s*([\w.,]+)\s+on\s+(.+)$/i,

                /^paid\s+(?:₹|rs\.?)?\s*([\w.,]+)\s+for\s+(.+)$/i,

                /^(.+?)\s+for\s+(?:₹|rs\.?)?\s*([\w.,]+)$/i,

                /^(.+?)\s+(?:₹|rs\.?)?\s*([\w.,]+)$/i

            ];

            for (const regex of patterns) {

                const match = message.match(regex);

                if (!match)
                    continue;

                let expense = null;

                if (regex === patterns[0]) {

                    expense = {

                        paid_by: match[1].trim(),

                        amount: MoneyParser.parse(match[3]),

                        title: match[4].trim(),

                        category: "General",

                        notes: ""

                    };

                }

                else if (regex === patterns[1]) {

                    expense = {

                        paid_by: "You",

                        amount: MoneyParser.parse(match[1]),

                        title: match[2].trim(),

                        category: "General",

                        notes: ""

                    };

                }

                else if (regex === patterns[2]) {

                    expense = {

                        paid_by: "You",

                        amount: MoneyParser.parse(match[1]),

                        title: match[2].trim(),

                        category: "General",

                        notes: ""

                    };

                }

                else if (regex === patterns[3]) {

                    expense = {

                        paid_by: "You",

                        title: match[1].trim(),

                        amount: MoneyParser.parse(match[2]),

                        category: "General",

                        notes: ""

                    };

                }

                else {

                    expense = {

                        paid_by: "You",

                        title: match[1].trim(),

                        amount: MoneyParser.parse(match[2]),

                        category: "General",

                        notes: ""

                    };

                }

                if (

                    expense.title &&

                    expense.amount > 0

                ) {

                    entities.expense = expense;

                    break;

                }

            }

        }

        /* ==========================================================
                            EDIT EXPENSE
        ========================================================== */

        if (aiRequest.intents.some(

            intent => intent.action === "EDIT_EXPENSE"

        )) {

            const regex =

                /^(?:change|update|modify)\s+(.+?)\s+(?:to)?\s*(₹|rs\.?)?\s*([\w.,]+)$/i;

            const match = message.match(regex);

            if (match) {

                entities.editExpense = {

                    title: match[1].trim(),

                    amount: MoneyParser.parse(match[3])

                };

            }

            else {

                const second =

                    /^(.+?)\s+should\s+be\s+(?:₹|rs\.?)?\s*([\w.,]+)$/i;

                const secondMatch = message.match(second);

                if (secondMatch) {

                    entities.editExpense = {

                        title: secondMatch[1].trim(),

                        amount: MoneyParser.parse(secondMatch[2])

                    };

                }

            }

        }

        /* ==========================================================
                            DELETE EXPENSE
        ========================================================== */

        if (aiRequest.intents.some(

            intent => intent.action === "DELETE_EXPENSE"

        )) {

            const match = message.match(

                /^(?:delete|remove|erase)\s+(.+)$/i

            );

            if (match) {

                entities.deleteExpense = {

                    title: match[1].trim()

                };

            }

        }

        /* ==========================================================
                            SHOW SETTLEMENTS
        ========================================================== */

        if (aiRequest.intents.some(

            intent => intent.action === "SHOW_SETTLEMENTS"

        )) {

            entities.showSettlements = true;

        }

        /* ==========================================================
                            SHOW SUMMARY
        ========================================================== */

        if (aiRequest.intents.some(

            intent => intent.action === "SHOW_SUMMARY"

        )) {

            entities.showSummary = true;

        }

        return Object.keys(entities).length

            ? entities

            : null;

    }

}

export default TripEntity;