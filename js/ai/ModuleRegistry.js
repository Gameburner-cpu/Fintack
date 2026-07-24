/* ==========================================================================
   ModuleRegistry.js
   Registers all AI modules and wires them into the core engines.
========================================================================== */

class ModuleRegistry {

    constructor() {

        this.modules = [];

    }

    register(module) {

        this.modules.push(module);

    }

    initialize(brain) {

        for (const module of this.modules) {

            if (module.detector) {

                brain.intentEngine.register(

                    module.detector

                );

            }

            if (module.extractor) {

                brain.entityEngine.register(

                    module.extractor

                );

            }

            if (module.provider) {

                brain.contextEngine.register(

                    module.provider

                );

            }

            if (module.handler) {

                brain.decisionEngine.register(

                    module.handler

                );

            }

            if (module.manager) {

                brain.actionExecutor.register(

                    module.name,

                    module.manager

                );

            }

            if (module.formatter) {

                brain.responseEngine.register(

                    module.name,

                    module.formatter

                );

            }

        }

    }

}

export default ModuleRegistry;