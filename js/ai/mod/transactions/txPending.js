/* ==========================================================================
   txPending.js
   Holds the action the chatbot has proposed but not yet executed.

   Nothing touches the database until the user confirms, so a misparsed
   "add 5000 rent" cannot silently corrupt their ledger.
========================================================================== */

const EXPIRY_MS = 5 * 60 * 1000;

class PendingAction {

    constructor() {
        this.action = null;
    }

    set(action) {
        this.action = {
            ...action,
            createdAt: Date.now()
        };

        return this.action;
    }

    get() {
        if (!this.action) return null;

        /* A stale proposal should not execute against a later "yes". */
        if (Date.now() - this.action.createdAt > EXPIRY_MS) {
            this.action = null;
            return null;
        }

        return this.action;
    }

    has() {
        return this.get() !== null;
    }

    clear() {
        const action = this.action;
        this.action = null;
        return action;
    }
}

export default new PendingAction();
