/* ==========================================================================
   Brain.js
   The central orchestrator for FinTack AI
   Every user message flows through this pipeline.
========================================================================== */

import Conversation from "./Conversation.js";
import IntentEngine from "./IntentEngine.js";
import EntityEngine from "./EntityEngine.js";
import ContextEngine from "./ContextEngine.js";
import Planner from "./Planner.js";
import ReasonEngine from "./ReasonEngine.js";
import DecisionEngine from "./DecisionEngine.js";
import ActionExecutor from "./ActionExecutor.js";
import ResponseEngine from "./ResponseEngine.js";
import MemoryEngine from "./MemoryEngine.js";
import EventBus from "./EventBus.js";

import ModuleRegistry from "../ai/ModuleRegistry.js";
import Modules from "../ai/mod/index.js";

class Brain {

    constructor() {

        /* ==========================================================
                            Core Engines
        ========================================================== */

        this.conversation = new Conversation();

        this.intentEngine = new IntentEngine();

        this.entityEngine = new EntityEngine();

        this.contextEngine = new ContextEngine();

        this.decisionEngine = new DecisionEngine();

        this.actionExecutor = new ActionExecutor();

        this.responseEngine = new ResponseEngine();

        /* ==========================================================
                            Memory Engine
        ========================================================== */

        this.memoryEngine = new MemoryEngine();

        /* ==========================================================
                            Event Bus
        ========================================================== */

        this.eventBus = new EventBus();

        /* ==========================================================
                            Module Registry
        ========================================================== */

        this.registry = new ModuleRegistry();

        /* ==========================================================
                            Register All Modules
        ========================================================== */

        Modules.forEach(module => {

            this.registry.register(module);

        });

        /* ==========================================================
                            Initialize Registry
        ========================================================== */

        this.registry.initialize(this);

    }

    async process(message) {

        try {

            /* ==========================================================
                            AI REQUEST OBJECT
            ========================================================== */

            const aiRequest = {

                message,

                conversation: {},

                intents: [],

                entities: {},

                context: {},

                actions: [],

                results: [],

                response: null,

                memory: this.memoryEngine,

                events: this.eventBus,

                brain: this

            };

            /* ==========================================================
                            AI PIPELINE
            ========================================================== */

            // Step 1 - Conversation
            await this.conversation.process(aiRequest);

            // Step 2 - Intent Detection
            await this.intentEngine.detect(aiRequest);
            const intent = aiRequest.intents;
            console.log("Intent:", intent);

            // Step 3 - Entity Extraction
            await this.entityEngine.extract(aiRequest);
            const entities = aiRequest.entities;
            console.log("Entities:", entities);

            // Step 4 - Context Loading
            await this.contextEngine.load(aiRequest);

            // Step 5 - Decision Making
            await this.decisionEngine.decide(aiRequest);
            const decision = aiRequest.actions;
            console.log("Decision:", decision);

            // Step 6 - Execute Actions
            await this.actionExecutor.execute(aiRequest);
            const actionResult = aiRequest.results;
            console.log("Action:", actionResult);

            // Step 7 - Generate Response
            await this.responseEngine.generate(aiRequest);
            const response = aiRequest.response;
            console.log("Response:", response);

            return aiRequest.response;

        }

        catch (error) {

            console.error("Brain Error:", error);

            return {

                success: false,

                message:
                    "Something went wrong while processing your request."

            };

        }

    }

}

export default Brain;