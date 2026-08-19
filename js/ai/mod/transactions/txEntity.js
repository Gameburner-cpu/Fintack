/* ==========================================================================
   txEntity.js
   Extracts transaction fields from the message so the decision and manager
   layers never have to re-parse the raw text.
========================================================================== */

import {
    parseTransactionCommand,
    parseEditCommand
} from "../../utils/FinanceNLU.js";

class TransactionEntity {

    async extract(aiRequest) {
        const message = String(aiRequest.message || "");

        if (!message.trim()) return null;

        const intent = (aiRequest.intents || []).find(
            item => item?.module === "transactions"
        );

        if (!intent) return null;

        if (
            intent.action === "EDIT_TRANSACTION" ||
            intent.action === "DELETE_TRANSACTION"
        ) {
            return {
                transaction: {
                    kind: "edit",
                    ...parseEditCommand(message)
                }
            };
        }

        if (intent.action === "ADD_TRANSACTION") {
            return {
                transaction: {
                    kind: "add",
                    ...parseTransactionCommand(message)
                }
            };
        }

        return null;
    }
}

export default TransactionEntity;
