/* ==========================================================================
   FinTackAI.js
========================================================================== */

import Brain from "../core/Brain.js";

class FinTackAI {

    constructor() {

        this.brain = new Brain();

    }

    async ask(message) {

        return await this.brain.process(message);

    }

}

export default new FinTackAI();