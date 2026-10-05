/* ==========================================================================
   FinanceNLU.js
   Natural language understanding for money commands and questions.

   Deliberately deterministic: parsing "Add ₹500 spent on food today" with a
   language model costs a network round trip, can hallucinate an amount and
   fails offline. Regex + a category lexicon is instant, testable and cannot
   invent a number that was not in the sentence.
========================================================================== */

import MoneyParser from "./MoneyParser.js";

/* ==========================================================
                        LEXICONS
========================================================== */

export const CATEGORY_KEYWORDS = {
    Food: [
        "food", "lunch", "dinner", "breakfast", "brunch", "snack", "snacks",
        "restaurant", "cafe", "coffee", "tea", "chai", "pizza", "burger",
        "swiggy", "zomato", "eating out", "takeaway", "meal", "biryani",
        "dining", "canteen", "hotel food"
    ],
    Groceries: [
        "groceries", "grocery", "vegetables", "veggies", "supermarket",
        "bigbasket", "blinkit", "zepto", "instamart", "provisions", "milk",
        "kirana"
    ],
    Fuel: [
        "fuel", "petrol", "diesel", "gas", "cng", "filling", "pump"
    ],
    Transport: [
        "transport", "uber", "ola", "rapido", "auto", "taxi", "cab", "metro",
        "bus", "train", "ticket", "toll", "parking", "commute"
    ],
    Shopping: [
        "shopping", "clothes", "clothing", "shoes", "amazon", "flipkart",
        "myntra", "electronics", "gadget", "phone", "laptop", "shirt",
        "jeans", "watch", "accessories"
    ],
    Bills: [
        "bill", "bills", "electricity", "water bill", "internet", "wifi",
        "broadband", "mobile recharge", "recharge", "postpaid", "prepaid",
        "gas bill", "maintenance", "dth"
    ],
    Rent: [
        "rent", "landlord", "house rent", "pg", "hostel", "accommodation"
    ],
    Travel: [
        "travel", "trip", "flight", "hotel", "vacation", "holiday", "tour",
        "airbnb", "booking", "irctc", "resort"
    ],
    Health: [
        "health", "medicine", "medicines", "doctor", "hospital", "clinic",
        "pharmacy", "medical", "dentist", "gym", "fitness", "checkup",
        "insurance premium", "therapy"
    ],
    Entertainment: [
        "entertainment", "movie", "movies", "cinema", "netflix", "prime",
        "spotify", "hotstar", "concert", "game", "gaming", "party", "club",
        "outing", "bowling"
    ],
    Education: [
        "education", "course", "tuition", "fees", "books", "college",
        "school", "udemy", "coursera", "exam", "coaching", "stationery"
    ],
    Subscriptions: [
        "subscription", "subscriptions", "membership", "renewal", "saas",
        "icloud", "google one", "youtube premium"
    ],
    Salary: [
        "salary", "paycheck", "pay check", "wages", "stipend", "payroll",
        "monthly pay", "income from job"
    ],
    Business: [
        "business", "client", "invoice", "consulting", "sales revenue",
        "profit"
    ],
    Freelance: [
        "freelance", "freelancing", "gig", "side project", "contract work",
        "commission"
    ],
    Investment: [
        "investment", "sip", "mutual fund", "stocks", "shares", "equity",
        "nps", "ppf", "elss", "gold bond", "etf", "index fund"
    ],
    Interest: [
        "interest", "dividend", "fd interest", "savings interest", "payout"
    ],
    Gift: [
        "gift", "gifted", "present", "shagun", "bonus from family"
    ],
    Refund: [
        "refund", "refunded", "cashback", "reimbursement", "returned money"
    ],
    Other: []
};

const INCOME_VERBS = [
    "received", "receive", "earned", "earn", "got paid", "got",
    "credited", "income", "salary", "deposited", "refunded", "refund",
    "cashback", "won", "gained", "profit", "sold"
];

const EXPENSE_VERBS = [
    "spent", "spend", "paid", "pay", "bought", "buy", "purchased",
    "purchase", "expense", "cost", "costs", "billed", "charged",
    "debited", "ordered", "booked", "gave"
];

const INCOME_CATEGORIES = new Set([
    "Salary", "Business", "Freelance", "Interest", "Gift", "Refund"
]);

/* ==========================================================
                        AMOUNT
========================================================== */

/*
    Pulls every money-looking token out of a sentence in order, so an edit
    command like "from 500 to 700" can address them positionally.
*/
export function extractAmounts(text) {
    const source = String(text || "");
    const results = [];

    const pattern = new RegExp(
        [
            // ₹500 / rs.500 / inr 500  (optionally with k/l/cr suffix)
            "(?:₹|rs\\.?|inr)\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(k|l|lac|lakhs?|cr|crores?)?",
            // 500 rupees / 5k / 2 lakh / bare 500
            "([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(k|l|lac|lakhs?|cr|crores?|rupees|rupee|rs)?"
        ].join("|"),
        "gi"
    );

    let match;

    while ((match = pattern.exec(source)) !== null) {
        const raw = match[1] ?? match[3];

        if (raw === undefined) continue;

        const unit = (match[2] ?? match[4] ?? "").toLowerCase();

        /* "rupees" is a currency word, not a multiplier. */
        const multiplierUnit =
            unit === "rupees" || unit === "rupee" || unit === "rs" ? "" : unit;

        const value = MoneyParser.parse(`${raw}${multiplierUnit}`);

        if (!Number.isFinite(value) || value <= 0) continue;

        results.push({
            value,
            index: match.index,
            text: match[0].trim(),
            hadCurrencyMarker:
                /₹|rs|inr|rupee/i.test(match[0]) || Boolean(multiplierUnit)
        });
    }

    return results;
}

export function extractAmount(text) {
    const amounts = extractAmounts(text);
    return amounts.length ? amounts[0].value : null;
}

/* ==========================================================
                        DATE
========================================================== */

const WEEKDAYS = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday"
];

const MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
];

function toKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

/**
 * Resolves a date reference inside free text.
 * @returns {{ date: string, label: string } | null}  date is YYYY-MM-DD
 */
export function extractDate(text, reference = new Date()) {
    const source = String(text || "").toLowerCase();
    const now = new Date(reference);

    const shift = days => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
    };

    if (/\btoday\b|\btonight\b|\bthis morning\b|\bjust now\b/.test(source)) {
        return { date: toKey(now), label: "today" };
    }

    if (/\byesterday\b/.test(source)) {
        return { date: toKey(shift(1)), label: "yesterday" };
    }

    if (/\bday before yesterday\b/.test(source)) {
        return { date: toKey(shift(2)), label: "the day before yesterday" };
    }

    if (/\btomorrow\b/.test(source)) {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        return { date: toKey(date), label: "tomorrow" };
    }

    /* "3 days ago", "2 weeks ago" */
    const agoMatch = source.match(
        /\b(\d{1,3})\s*(day|days|week|weeks|month|months)\s*ago\b/
    );

    if (agoMatch) {
        const count = Number(agoMatch[1]);
        const unit = agoMatch[2];
        const date = new Date(now);

        if (unit.startsWith("day")) date.setDate(date.getDate() - count);
        else if (unit.startsWith("week")) date.setDate(date.getDate() - count * 7);
        else date.setMonth(date.getMonth() - count);

        return { date: toKey(date), label: `${count} ${unit} ago` };
    }

    /* "last monday" / "on friday" */
    const weekdayMatch = source.match(
        new RegExp(`\\b(?:last|on|this)?\\s*(${WEEKDAYS.join("|")})\\b`)
    );

    if (weekdayMatch) {
        const target = WEEKDAYS.indexOf(weekdayMatch[1]);
        const date = new Date(now);
        let diff = (date.getDay() - target + 7) % 7;
        if (diff === 0) diff = 7;
        date.setDate(date.getDate() - diff);

        return { date: toKey(date), label: `last ${weekdayMatch[1]}` };
    }

    /* "12 jan", "12 january 2026", "jan 12" */
    const dayMonth = source.match(
        new RegExp(
            `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.map(m => m.slice(0, 3)).join("|")})[a-z]*\\.?\\s*(\\d{4})?\\b`
        )
    );

    if (dayMonth) {
        const day = Number(dayMonth[1]);
        const month = MONTHS.findIndex(m => m.startsWith(dayMonth[2]));
        const year = dayMonth[3] ? Number(dayMonth[3]) : now.getFullYear();
        const date = new Date(year, month, day);

        if (!Number.isNaN(date.getTime())) {
            /* A date later than today with no year almost certainly means last year. */
            if (!dayMonth[3] && date > now) {
                date.setFullYear(date.getFullYear() - 1);
            }
            return { date: toKey(date), label: `${day} ${MONTHS[month]}` };
        }
    }

    const monthDay = source.match(
        new RegExp(
            `\\b(${MONTHS.map(m => m.slice(0, 3)).join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(\\d{4})?\\b`
        )
    );

    if (monthDay) {
        const month = MONTHS.findIndex(m => m.startsWith(monthDay[1]));
        const day = Number(monthDay[2]);
        const year = monthDay[3] ? Number(monthDay[3]) : now.getFullYear();
        const date = new Date(year, month, day);

        if (!Number.isNaN(date.getTime())) {
            if (!monthDay[3] && date > now) {
                date.setFullYear(date.getFullYear() - 1);
            }
            return { date: toKey(date), label: `${MONTHS[month]} ${day}` };
        }
    }

    /* 12/01/2026 or 12-01-2026 (day first, Indian convention) */
    const numeric = source.match(
        /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/
    );

    if (numeric) {
        const day = Number(numeric[1]);
        const month = Number(numeric[2]) - 1;
        let year = Number(numeric[3]);
        if (year < 100) year += 2000;

        const date = new Date(year, month, day);

        if (!Number.isNaN(date.getTime())) {
            return { date: toKey(date), label: toKey(date) };
        }
    }

    /* ISO 2026-01-12 */
    const iso = source.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

    if (iso) {
        return { date: iso[0], label: iso[0] };
    }

    return null;
}

/* ==========================================================
                        PERIOD

   For questions rather than single transactions.
========================================================== */

export function extractPeriod(text) {
    const source = String(text || "").toLowerCase();

    const rules = [
        [/\btoday\b|\bso far today\b/, "today"],
        [/\byesterday\b/, "yesterday"],
        [/\blast week\b|\bprevious week\b|\bpast week\b/, "last_week"],
        [/\bthis week\b|\bcurrent week\b/, "this_week"],
        [/\blast 7 days\b|\bpast 7 days\b|\bseven days\b/, "last_7_days"],
        [/\blast month\b|\bprevious month\b|\bpast month\b/, "last_month"],
        [/\bthis month\b|\bcurrent month\b|\bmonthly\b/, "this_month"],
        [/\blast 30 days\b|\bpast 30 days\b|\bthirty days\b/, "last_30_days"],
        [/\blast year\b|\bprevious year\b/, "last_year"],
        [/\bthis year\b|\bcurrent year\b|\byearly\b|\bannual\b/, "this_year"],
        [/\ball time\b|\boverall\b|\bin total\b|\bever\b|\btotal\b/, "all_time"]
    ];

    for (const [pattern, period] of rules) {
        if (pattern.test(source)) return period;
    }

    return null;
}

/* ==========================================================
                        CATEGORY
========================================================== */

export function extractCategory(text) {
    const source = ` ${String(text || "").toLowerCase()} `;

    let best = null;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            const pattern = new RegExp(
                `(^|[^a-z])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
                "i"
            );

            if (pattern.test(source)) {
                /* Longer keyword match wins - "gas bill" beats "gas". */
                if (!best || keyword.length > best.keyword.length) {
                    best = { category, keyword };
                }
            }
        }
    }

    return best;
}

/* ==========================================================
                        TYPE
========================================================== */

export function extractType(text, category = null) {
    const source = ` ${String(text || "").toLowerCase()} `;

    const hasVerb = list =>
        list.some(verb =>
            new RegExp(`(^|[^a-z])${verb}([^a-z]|$)`, "i").test(source)
        );

    /* An explicit verb always wins over a category guess. */
    if (hasVerb(EXPENSE_VERBS)) return "expense";
    if (hasVerb(INCOME_VERBS)) return "income";

    if (category && INCOME_CATEGORIES.has(category)) return "income";

    return null;
}

/* ==========================================================
                        TITLE
========================================================== */

const NOISE_WORDS = new Set([
    "add", "log", "record", "note", "please", "kindly", "a", "an", "the",
    "i", "my", "me", "of", "in", "at", "to", "from", "and", "with", "new",
    "transaction", "entry", "expense", "income", "spent", "spend", "paid",
    "pay", "bought", "buy", "purchased", "received", "earned", "got",
    "today", "yesterday", "tomorrow", "rupees", "rs", "inr", "on", "for",
    "was", "is", "it", "that", "this", "some", "just", "worth", "about"
]);

/*
    Prefers the phrase after "on"/"for" ("spent 500 ON GROCERIES"), and falls
    back to whatever meaningful words remain.
*/
export function extractTitle(text, fallback = "Transaction") {
    const source = String(text || "");

    const phrase = source.match(
        /\b(?:on|for|towards|at)\s+([a-z0-9][a-z0-9\s'&-]{1,40})/i
    );

    let candidate = phrase ? phrase[1] : "";

    if (!candidate) {
        candidate = source
            .replace(/(?:₹|rs\.?|inr)\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|l|lakhs?|cr|crores?)?/gi, " ")
            .replace(/[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|l|lakhs?|cr|crores?|rupees?)?/gi, " ");
    }

    const words = candidate
        .toLowerCase()
        .replace(/[^a-z0-9\s'&-]/g, " ")
        .split(/\s+/)
        .filter(word => word && !NOISE_WORDS.has(word));

    if (!words.length) return fallback;

    const title = words.slice(0, 5).join(" ");

    return title.charAt(0).toUpperCase() + title.slice(1);
}

/* ==========================================================
                    FULL COMMAND PARSE
========================================================== */

/**
 * Parses an "add transaction" style command.
 * @returns {{ amount, type, category, date, title, confidence, missing[] }}
 */
export function parseTransactionCommand(text, reference = new Date()) {
    const amounts = extractAmounts(text);
    const amount = amounts.length ? amounts[0].value : null;

    const categoryMatch = extractCategory(text);
    const category = categoryMatch?.category || null;

    const type = extractType(text, category);

    const dateMatch = extractDate(text, reference);

    const missing = [];
    if (!amount) missing.push("amount");
    if (!type) missing.push("type");

    /* Confidence is used by the intent engine to break ties between modules. */
    let confidence = 40;
    if (amount) confidence += 25;
    if (type) confidence += 20;
    if (category) confidence += 10;
    if (dateMatch) confidence += 5;

    return {
        amount,
        type: type || "expense",
        typeExplicit: Boolean(type),
        category: category || (type === "income" ? "Other" : "Other"),
        categoryExplicit: Boolean(category),
        date: dateMatch?.date || null,
        dateLabel: dateMatch?.label || "today",
        title: extractTitle(text, category || "Transaction"),
        confidence: Math.min(100, confidence),
        missing
    };
}

/**
 * Parses an "edit transaction" command such as
 * "change yesterday's food expense from ₹500 to ₹700".
 */
export function parseEditCommand(text, reference = new Date()) {
    const source = String(text || "").toLowerCase();
    const amounts = extractAmounts(text);

    let fromAmount = null;
    let toAmount = null;

    /* "from X to Y" */
    const fromTo = source.match(
        /from\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|l|lakhs?|cr)?)\s*to\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|l|lakhs?|cr)?)/i
    );

    if (fromTo) {
        fromAmount = extractAmount(fromTo[1]);
        toAmount = extractAmount(fromTo[2]);
    } else {
        /* "make it 700", "change to 700", "update the amount to 700" */
        const toOnly = source.match(
            /(?:to|as|into|=)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:k|l|lakhs?|cr)?)/i
        );

        if (toOnly) toAmount = extractAmount(toOnly[1]);
        else if (amounts.length === 1) toAmount = amounts[0].value;
        else if (amounts.length >= 2) {
            fromAmount = amounts[0].value;
            toAmount = amounts[amounts.length - 1].value;
        }
    }

    const categoryMatch = extractCategory(text);
    const dateMatch = extractDate(text, reference);

    /*
        "change the category to Travel"

        Bounded to one or two words and stopped at a preposition. A greedy
        [a-z ]+ swallowed the rest of the sentence, so
        "category to Travel for yesterday's expense" produced the category
        "Travel For Yesterday".
    */
    const newCategory = source.match(
        /categor(?:y|ise|ize)\s*(?:to|as)\s+([a-z]+(?:\s+[a-z]+)?)(?=\s+(?:for|from|on|in|of|at|instead|please|and)\b|[,.!?]|$)/i
    ) || source.match(/categor(?:y|ise|ize)\s*(?:to|as)\s+([a-z]+)/i);

    /* "rename it to Coffee with Sam" / "change title to X" */
    const newTitle = source.match(
        /(?:title|name|rename(?:\s+it)?)\s*(?:to|as)\s*['"]?([a-z0-9][a-z0-9\s'&-]{1,40})['"]?/i
    );

    const targetsLast = /\b(last|latest|recent|most recent|previous)\b/.test(source);

    return {
        target: {
            amount: fromAmount,
            category: categoryMatch?.category || null,
            date: dateMatch?.date || null,
            dateLabel: dateMatch?.label || null,
            type: extractType(text, categoryMatch?.category),
            keyword: categoryMatch?.keyword || null,
            last: targetsLast
        },
        updates: {
            amount: toAmount,
            category: newCategory
                ? titleCase(newCategory[1].trim())
                : null,
            title: newTitle ? titleCase(newTitle[1].trim()) : null,
            date: /\b(?:date|move)\s*(?:to|as)\b/.test(source) && dateMatch
                ? dateMatch.date
                : null,
            type: /\b(?:mark|change|make)\s+(?:it\s+)?(?:as\s+)?(income|expense)\b/.test(source)
                ? source.match(/\b(income|expense)\b/)[1]
                : null
        }
    };
}

function titleCase(value) {
    return String(value)
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/* ==========================================================
                    CONFIRMATION
========================================================== */

const AFFIRMATIVE = [
    "yes", "y", "yeah", "yep", "yup", "sure", "ok", "okay", "confirm",
    "confirmed", "do it", "go ahead", "please do", "correct", "right",
    "save it", "add it", "proceed", "haan", "haa", "ha"
];

const NEGATIVE = [
    "no", "n", "nope", "nah", "cancel", "stop", "don't", "dont", "abort",
    "never mind", "nevermind", "discard", "forget it", "wrong", "nahi"
];

export function detectConfirmation(text) {
    const source = String(text || "").toLowerCase().trim().replace(/[.!]/g, "");

    if (!source) return null;
    if (source.length > 30) return null;

    if (AFFIRMATIVE.includes(source)) return "yes";
    if (NEGATIVE.includes(source)) return "no";

    if (AFFIRMATIVE.some(word => source.startsWith(`${word} `))) return "yes";
    if (NEGATIVE.some(word => source.startsWith(`${word} `))) return "no";

    return null;
}

export default {
    CATEGORY_KEYWORDS,
    extractAmount,
    extractAmounts,
    extractDate,
    extractPeriod,
    extractCategory,
    extractType,
    extractTitle,
    parseTransactionCommand,
    parseEditCommand,
    detectConfirmation
};
