/* ==========================================================================
   tripContext.js
   Loads trip-related context for the AI pipeline.
   Restores the active trip after browser refresh.
========================================================================== */

import TripStorage from "./tripStorage.js";

class TripContext {

    async load(aiRequest) {

        const context = {};

        /* ==========================================================
                        ACTIVE TRIP
        ========================================================== */

        /*
            First use the current runtime trip ID.

            If the page was refreshed, window.activeTripId will be
            empty, so restore the last active trip from localStorage.
        */

        let activeTripId =
            window.activeTripId ||
            TripStorage.getActiveTrip() ||
            null;

        /*
            Keep the runtime value synchronized so the rest of the
            existing FinTack trip code can continue using
            window.activeTripId.
        */

        if (activeTripId) {

            window.activeTripId =
                activeTripId;

        }

        context.activeTripId =
            activeTripId;

        /* ==========================================================
                        WORKSPACE
        ========================================================== */

        context.workspace =
            "trip";

        /* ==========================================================
                        USER
        ========================================================== */

        let user = null;

        try {

            const storedUser =
                localStorage.getItem("user");

            user =
                storedUser
                    ? JSON.parse(storedUser)
                    : null;

        }

        catch (error) {

            console.warn(
                "[TripContext] Unable to read stored user:",
                error
            );

            user = null;

        }

        context.user =
            user;

        /* ==========================================================
                        TRIP AVAILABLE
        ========================================================== */

        context.hasActiveTrip =
            !!activeTripId;

        /* ==========================================================
                        DEBUG
        ========================================================== */

        console.log(
            "[TripContext] Loaded:",
            {
                activeTripId:
                    context.activeTripId,

                hasActiveTrip:
                    context.hasActiveTrip,

                userId:
                    context.user?.id || null
            }
        );

        /* ==========================================================
                        RETURN
        ========================================================== */

        return context;

    }

}

export default TripContext;
