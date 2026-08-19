/* ==========================================================================
   txStore.js
   Shared transaction cache for the AI modules.

   Without this, every chatbot question refetched the full transaction list.
   The store keeps one copy, invalidates it on any write, and broadcasts
   changes so the dashboard can re-render from the same data.
========================================================================== */

import {
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
} from "../../../core/api.js";

import { getCurrentUser } from "../../../core/config.js";
import { invalidateAnalyticsCache } from "../../../core/analytics.js";

const TTL_MS = 60 * 1000;

class TransactionStore {

    constructor() {
        this.cache = null;
        this.fetchedAt = 0;
        this.inFlight = null;
    }

    userId() {
        return getCurrentUser()?.id || null;
    }

    /* ==========================================================
                            READ
    ========================================================== */

    async all({ force = false } = {}) {
        const userId = this.userId();

        if (!userId) return [];

        const fresh =
            this.cache &&
            Date.now() - this.fetchedAt < TTL_MS &&
            !force;

        if (fresh) return this.cache;

        /* Collapse concurrent callers onto one request. */
        if (this.inFlight) return this.inFlight;

        this.inFlight = fetchTransactions(userId)
            .then(transactions => {
                this.cache = Array.isArray(transactions) ? transactions : [];
                this.fetchedAt = Date.now();
                return this.cache;
            })
            .catch(error => {
                console.error("[TransactionStore] Fetch failed:", error);
                return this.cache || [];
            })
            .finally(() => {
                this.inFlight = null;
            });

        return this.inFlight;
    }

    invalidate() {
        this.cache = null;
        this.fetchedAt = 0;
        invalidateAnalyticsCache();
    }

    /* Tells the rest of the app to re-read. */
    broadcast(detail) {
        this.invalidate();

        window.dispatchEvent(
            new CustomEvent("fintack:transactions-changed", { detail })
        );
    }

    /* ==========================================================
                            WRITE
    ========================================================== */

    async create(transaction) {
        const userId = this.userId();

        if (!userId) {
            return { success: false, message: "Please log in first." };
        }

        const result = await addTransaction({
            ...transaction,
            user_id: userId
        });

        if (result?.success) {
            this.broadcast({ action: "create", transaction: result.transaction });
        }

        return result;
    }

    async update(id, updates) {
        const result = await updateTransaction(id, updates);

        if (result?.success) {
            this.broadcast({ action: "update", transaction: result.transaction });
        }

        return result;
    }

    async remove(id) {
        const result = await deleteTransaction(id);

        if (result?.success) {
            this.broadcast({ action: "delete", transaction: result.transaction });
        }

        return result;
    }

    /* ==========================================================
                            SEARCH

       Finds the transaction a natural language edit refers to.
       Scores candidates rather than taking the first match, so
       "yesterday's food expense" beats a same-day food expense
       from three weeks ago.
    ========================================================== */

    async find(target = {}) {
        const transactions = await this.all();

        if (!transactions.length) return [];

        const scored = transactions
            .map(transaction => {
                let score = 0;
                let disqualified = false;

                const amount = Number(transaction.amount) || 0;
                const type = String(transaction.type || "").toLowerCase();
                const category = String(transaction.category || "");
                const title = String(transaction.title || "").toLowerCase();

                const dateKey = transaction.date
                    ? String(transaction.date).slice(0, 10)
                    : "";

                if (target.amount != null) {
                    if (Math.abs(amount - target.amount) < 0.01) score += 50;
                    else disqualified = true;
                }

                if (target.date) {
                    if (dateKey === target.date) score += 40;
                    else disqualified = true;
                }

                if (target.category) {
                    if (category.toLowerCase() === target.category.toLowerCase()) {
                        score += 25;
                    } else if (title.includes(target.category.toLowerCase())) {
                        score += 10;
                    } else if (target.strictCategory) {
                        disqualified = true;
                    }
                }

                if (target.type) {
                    if (type === target.type) score += 15;
                    else disqualified = true;
                }

                if (target.keyword && title.includes(target.keyword.toLowerCase())) {
                    score += 20;
                }

                if (target.title && title.includes(target.title.toLowerCase())) {
                    score += 30;
                }

                /* Recency tie-breaker, capped so it cannot outweigh a real match. */
                const ageDays = Math.max(
                    0,
                    (Date.now() - new Date(transaction.date).getTime()) / 86400000
                );

                score += Math.max(0, 10 - ageDays / 3);

                return { transaction, score, disqualified };
            })
            .filter(item => !item.disqualified && item.score > 0)
            .sort((a, b) => b.score - a.score);

        return scored.map(item => item.transaction);
    }

    async latest(filters = {}) {
        const matches = await this.find(filters);
        return matches[0] || null;
    }
}

export default new TransactionStore();
