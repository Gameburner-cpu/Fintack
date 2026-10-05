/* ==========================================================================
   ai.js  - REMOVED in FinTack 2.0

   This file held the original keyword-matching assistant. It was already
   dead code: index.html only loads js/core/app.js, which talks to
   js/ai/FinTackAI.js -> js/core/Brain.js. Nothing imported this module,
   and it referenced globals that no longer exist (TripStorage,
   formatTripCard, analyzePurchase), so calling it would have thrown.

   Its behaviour now lives in real modules:
     - trip handling      -> js/ai/mod/trip/
     - budget / savings   -> js/ai/mod/finance/
     - purchase analysis  -> js/ai/mod/finance/ (AFFORDABILITY)
     - generic fallback   -> js/ai/mod/knowledge/

   Safe to delete from the repository.
========================================================================== */

export default null;
