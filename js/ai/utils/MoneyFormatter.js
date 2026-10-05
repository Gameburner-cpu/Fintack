/* ==========================================================================
   MoneyFormatter.js
   Formats money into readable Indian notation.

   Examples

   500         -> ₹500
   1500        -> ₹1.5k
   12500       -> ₹12.5k
   25000       -> ₹25k
   125000      -> ₹1.25L
   500000      -> ₹5L
   2500000     -> ₹25L
   10000000    -> ₹1Cr
   25000000    -> ₹2.5Cr
========================================================================== */

class MoneyFormatter {

    static format(amount) {

        amount = Number(amount);

        if (isNaN(amount))
            return "₹0";

        const abs = Math.abs(amount);

        let value = amount;
        let suffix = "";

        if (abs >= 10000000) {

            value = amount / 10000000;
            suffix = "Cr";

        }

        else if (abs >= 100000) {

            value = amount / 100000;
            suffix = "L";

        }

        else if (abs >= 1000) {

            value = amount / 1000;
            suffix = "k";

        }

        else {

            return `₹${amount}`;

        }

        let formatted = value.toFixed(2);

        formatted = formatted

            .replace(/\.00$/, "")
            .replace(/(\.\d)0$/, "$1");

        return `₹${formatted}${suffix}`;

    }

    static formatPlain(amount) {

        amount = Number(amount);

        if (isNaN(amount))
            return "0";

        const abs = Math.abs(amount);

        let value = amount;
        let suffix = "";

        if (abs >= 10000000) {

            value = amount / 10000000;
            suffix = "Cr";

        }

        else if (abs >= 100000) {

            value = amount / 100000;
            suffix = "L";

        }

        else if (abs >= 1000) {

            value = amount / 1000;
            suffix = "k";

        }

        else {

            return String(amount);

        }

        let formatted = value.toFixed(2);

        formatted = formatted

            .replace(/\.00$/, "")
            .replace(/(\.\d)0$/, "$1");

        return `${formatted}${suffix}`;

    }

    static formatExact(amount) {

        amount = Number(amount);

        if (isNaN(amount))
            return "₹0";

        return `₹${amount.toLocaleString("en-IN")}`;

    }

}

export default MoneyFormatter;