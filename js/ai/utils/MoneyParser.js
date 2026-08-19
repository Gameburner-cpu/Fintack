/* ==========================================================================
   MoneyParser.js
   Parses natural money values into numbers.

   Examples

   500        -> 500
   ₹500       -> 500
   Rs 500     -> 500
   1k         -> 1000
   1.5k       -> 1500
   25k        -> 25000
   5L         -> 500000
   2.5L       -> 250000
   1Cr        -> 10000000
   2 crore    -> 20000000
========================================================================== */

class MoneyParser {

    static parse(value) {

        if (value === null || value === undefined)
            return 0;

        if (typeof value === "number")
            return value;

        let text = String(value)
            .trim()
            .toLowerCase();

        if (!text)
            return 0;

        // Remove currency symbols

        text = text

            .replace(/₹/g, "")
            .replace(/rs\.?/g, "")
            .replace(/inr/g, "")
            .replace(/,/g, "")
            .trim();

        const match = text.match(

            /^(\d+(?:\.\d+)?)\s*(k|l|lac|lakh|lakhs|cr|crore|crores)?$/i

        );

        if (!match) {

            const number = Number(text);

            return isNaN(number)

                ? 0

                : number;

        }

        let amount = parseFloat(match[1]);

        const unit =

            (match[2] || "").toLowerCase();

        switch (unit) {

            case "k":

                amount *= 1000;
                break;

            case "l":

            case "lac":

            case "lakh":

            case "lakhs":

                amount *= 100000;
                break;

            case "cr":

            case "crore":

            case "crores":

                amount *= 10000000;
                break;

        }

        return Math.round(amount);

    }

    static isMoney(value) {

        return this.parse(value) > 0;

    }

}

export default MoneyParser;