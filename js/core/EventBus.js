/* ==========================================================================
   EventBus.js
   Lightweight publish/subscribe event system for AI modules.
========================================================================== */

class EventBus {

    constructor() {

        this.listeners = new Map();

    }

    /* ==========================================================
                        SUBSCRIBE
    ========================================================== */

    on(event, callback) {

        if (!this.listeners.has(event)) {

            this.listeners.set(event, []);

        }

        this.listeners.get(event).push(callback);

    }

    /* ==========================================================
                        EMIT
    ========================================================== */

    async emit(event, payload = {}) {

        const callbacks = this.listeners.get(event);

        if (!callbacks)
            return;

        for (const callback of callbacks) {

            await callback(payload);

        }

    }

    /* ==========================================================
                        REMOVE
    ========================================================== */

    off(event, callback) {

        const callbacks = this.listeners.get(event);

        if (!callbacks)
            return;

        this.listeners.set(

            event,

            callbacks.filter(fn => fn !== callback)

        );

    }

    /* ==========================================================
                        CLEAR
    ========================================================== */

    clear() {

        this.listeners.clear();

    }

}

export default EventBus;