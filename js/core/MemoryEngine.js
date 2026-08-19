/* ==========================================================================
   MemoryEngine.js
   Shared conversational memory for all AI modules.
========================================================================== */

class MemoryEngine {

    constructor() {

        this.reset();

    }

    /* ==========================================================
                        RESET
    ========================================================== */

    reset() {

        this.memory = {

            workspace: null,

            lastIntent: null,

            lastModule: null,

            lastAction: null,

            user: null,

            trip: {

                active: null,

                members: [],

                lastExpense: null

            },

            budget: {

                active: null

            },

            goals: {

                active: null

            },

            investments: {

                active: null

            },

            analytics: {},

            profile: {}

        };

    }

    /* ==========================================================
                        SET
    ========================================================== */

    set(path, value) {

        const keys = path.split(".");

        let current = this.memory;

        while (keys.length > 1) {

            const key = keys.shift();

            if (!(key in current)) {

                current[key] = {};

            }

            current = current[key];

        }

        current[keys[0]] = value;

    }

    /* ==========================================================
                        GET
    ========================================================== */

    get(path) {

        const keys = path.split(".");

        let current = this.memory;

        for (const key of keys) {

            if (current == null)

                return null;

            current = current[key];

        }

        return current;

    }

    /* ==========================================================
                        HAS
    ========================================================== */

    has(path) {

        return this.get(path) !== null;

    }

    /* ==========================================================
                        REMOVE
    ========================================================== */

    remove(path) {

        const keys = path.split(".");

        let current = this.memory;

        while (keys.length > 1) {

            current = current[keys.shift()];

            if (!current)

                return;

        }

        delete current[keys[0]];

    }

    /* ==========================================================
                        GET ALL
    ========================================================== */

    getAll() {

        return structuredClone(this.memory);

    }

}

export default MemoryEngine;