/* ==========================================================================
   validators.js
   Shared input validation + normalisation for the FinTack API.
========================================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const TRANSACTION_TYPES = ["income", "expense"];

const CATEGORIES = [
    "Food", "Fuel", "Shopping", "Bills", "Travel", "Health",
    "Entertainment", "Education", "Rent", "Groceries", "Transport",
    "Subscriptions", "Salary", "Business", "Freelance", "Investment",
    "Interest", "Gift", "Refund", "Other"
];

/* ==========================================================
                    PRIMITIVES
========================================================== */

function isEmail(value) {
    return EMAIL_RE.test(String(value || "").trim());
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

/*
    Password policy: min 8 chars, at least one letter and one digit.
    Deliberately not requiring symbols - it pushes users to reuse
    passwords without measurably improving entropy.
*/
function validatePassword(password) {
    const value = String(password || "");

    if (value.length < 8) {
        return "Password must be at least 8 characters long.";
    }

    if (value.length > 128) {
        return "Password must be under 128 characters.";
    }

    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
        return "Password must contain at least one letter and one number.";
    }

    return null;
}

/*
    Strips control characters and clamps length. Everything rendered in the
    UI is additionally HTML-escaped client side, this is defence in depth.
*/
function sanitizeText(value, maxLength = 120) {
    return String(value ?? "")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

function isValidDate(value) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
}

/* ==========================================================
                    TRANSACTION VALIDATION

   Returns { valid, errors[], value }. `partial` mode is used
   by PATCH/PUT where only supplied fields are validated.
========================================================== */

function validateTransaction(input = {}, { partial = false } = {}) {
    const errors = [];
    const value = {};

    const has = key =>
        Object.prototype.hasOwnProperty.call(input, key) &&
        input[key] !== undefined &&
        input[key] !== null &&
        input[key] !== "";

    /* ---------------- title ---------------- */
    if (has("title")) {
        const title = sanitizeText(input.title, 120);
        if (!title) {
            errors.push("Title cannot be empty.");
        } else {
            value.title = title;
        }
    } else if (!partial) {
        errors.push("Title is required.");
    }

    /* ---------------- amount ---------------- */
    if (has("amount")) {
        const amount = Number(input.amount);

        if (!Number.isFinite(amount)) {
            errors.push("Amount must be a number.");
        } else if (amount <= 0) {
            errors.push("Amount must be greater than zero.");
        } else if (amount > 1_000_000_000) {
            errors.push("Amount is unrealistically large.");
        } else {
            // Money is stored to 2 decimals - avoid float drift.
            value.amount = Math.round(amount * 100) / 100;
        }
    } else if (!partial) {
        errors.push("Amount is required.");
    }

    /* ---------------- type ---------------- */
    if (has("type")) {
        const type = String(input.type).toLowerCase().trim();

        if (!TRANSACTION_TYPES.includes(type)) {
            errors.push("Type must be either 'income' or 'expense'.");
        } else {
            value.type = type;
        }
    } else if (!partial) {
        errors.push("Type is required.");
    }

    /* ---------------- category ---------------- */
    if (has("category")) {
        const category = sanitizeText(input.category, 40);

        if (!category) {
            errors.push("Category cannot be empty.");
        } else {
            const match = CATEGORIES.find(
                item => item.toLowerCase() === category.toLowerCase()
            );
            value.category = match || category;
        }
    } else if (!partial) {
        errors.push("Category is required.");
    }

    /* ---------------- date ---------------- */
    if (has("date")) {
        if (!isValidDate(input.date)) {
            errors.push("Date is invalid.");
        } else {
            const date = new Date(input.date);
            const upperBound = new Date();
            upperBound.setFullYear(upperBound.getFullYear() + 1);

            const lowerBound = new Date("1970-01-01");

            if (date > upperBound) {
                errors.push("Date cannot be more than a year in the future.");
            } else if (date < lowerBound) {
                errors.push("Date is too far in the past.");
            } else {
                value.date = date.toISOString().slice(0, 10);
            }
        }
    } else if (!partial) {
        value.date = new Date().toISOString().slice(0, 10);
    }

    /* ---------------- description (optional) ---------------- */
    if (has("description")) {
        value.description = sanitizeText(input.description, 500);
    }

    if (partial && Object.keys(value).length === 0 && !errors.length) {
        errors.push("No valid fields supplied to update.");
    }

    return {
        valid: errors.length === 0,
        errors,
        value
    };
}

/* ==========================================================
                    GOAL VALIDATION
========================================================== */

function validateGoal(input = {}, { partial = false } = {}) {
    const errors = [];
    const value = {};

    const has = key =>
        Object.prototype.hasOwnProperty.call(input, key) &&
        input[key] !== undefined &&
        input[key] !== null &&
        input[key] !== "";

    if (has("title")) {
        const title = sanitizeText(input.title, 120);
        if (!title) errors.push("Goal title cannot be empty.");
        else value.title = title;
    } else if (!partial) {
        errors.push("Goal title is required.");
    }

    if (has("target_amount")) {
        const target = Number(input.target_amount);
        if (!Number.isFinite(target) || target <= 0) {
            errors.push("Target amount must be greater than zero.");
        } else {
            value.target_amount = Math.round(target * 100) / 100;
        }
    } else if (!partial) {
        errors.push("Target amount is required.");
    }

    if (has("saved_amount")) {
        const saved = Number(input.saved_amount);
        if (!Number.isFinite(saved) || saved < 0) {
            errors.push("Saved amount cannot be negative.");
        } else {
            value.saved_amount = Math.round(saved * 100) / 100;
        }
    }

    if (has("deadline")) {
        if (!isValidDate(input.deadline)) {
            errors.push("Deadline is invalid.");
        } else {
            value.deadline = new Date(input.deadline).toISOString().slice(0, 10);
        }
    } else if (!partial) {
        errors.push("Deadline is required.");
    }

    if (
        value.target_amount !== undefined &&
        value.saved_amount !== undefined &&
        value.saved_amount > value.target_amount
    ) {
        errors.push("Saved amount cannot exceed the target amount.");
    }

    return {
        valid: errors.length === 0,
        errors,
        value
    };
}

module.exports = {
    CATEGORIES,
    TRANSACTION_TYPES,
    isEmail,
    normalizeEmail,
    validatePassword,
    sanitizeText,
    isValidDate,
    validateTransaction,
    validateGoal
};
