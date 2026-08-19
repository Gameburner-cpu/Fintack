/* ==========================================================================
   financeKB.js
   Curated personal finance knowledge base (India-focused).

   Answers here are instant, work offline and cannot hallucinate. Anything
   outside these topics - or anything time sensitive like current rates -
   is handed to the Gemini-backed /api/ai/ask endpoint instead.

   Every entry separates what something IS from what it MIGHT SUIT, and
   names the risk. None of it is personalised advice.
========================================================================== */

export const TOPICS = [
    {
        id: "budgeting",
        title: "Budgeting",
        keywords: [
            "budget", "budgeting", "50/30/20", "50 30 20", "zero based",
            "envelope", "spending plan", "how to budget", "track expenses"
        ],
        summary:
            "A budget is a plan for money you have not spent yet. The point is not restriction - it is deciding where money goes before it disappears.",
        points: [
            "50/30/20 is the usual starting frame: 50% needs, 30% wants, 20% savings and debt repayment. Treat it as a rough shape, not a rule.",
            "Zero-based budgeting assigns every rupee a job at the start of the month. It is more work but far more precise.",
            "Pay yourself first: automate the transfer to savings on payday, so saving is not what is left over.",
            "Track for one full month before you set targets. Most people are wrong about where their money actually goes."
        ],
        risk: "The main failure mode is a budget that is too tight to keep. A realistic 15% saved beats an aspirational 40% abandoned in week two.",
        appNote: "FinTack tracks this for you - set your income and savings target in the Expenses panel and the daily allowance updates automatically."
    },
    {
        id: "emergency_fund",
        title: "Emergency fund",
        keywords: [
            "emergency fund", "emergency savings", "rainy day", "contingency fund",
            "how much emergency", "safety net", "buffer"
        ],
        summary:
            "Cash set aside to cover essential expenses if income stops, so a bad month does not force you to sell investments or borrow at high interest.",
        points: [
            "The common target is 3 to 6 months of essential expenses - rent, food, EMIs, utilities, insurance. Not 6 months of your total spending.",
            "6 months or more if your income is variable (freelance, business, commission-heavy).",
            "Keep it boring and reachable: sweep-in FD, liquid fund, or a separate savings account. Returns are not the point; availability is.",
            "It is not an investment. If you are tempted to chase returns with it, it is not an emergency fund any more."
        ],
        risk: "Holding it in equity defeats the purpose - emergencies and market crashes correlate.",
        appNote: "FinTack estimates your target from your actual recorded expenses rather than a guess."
    },
    {
        id: "saving",
        title: "Saving strategies",
        keywords: [
            "how to save", "saving strategy", "save more", "savings rate",
            "cut expenses", "reduce spending", "save money"
        ],
        summary:
            "Savings rate - the share of income you keep - matters more than investment returns for most of the first decade of investing.",
        points: [
            "Automate first: a standing instruction on salary day removes the monthly decision.",
            "Attack recurring costs before one-off ones. A ₹500/month subscription is ₹6,000 a year; one ₹500 dinner is ₹500.",
            "Use a 24-hour rule for discretionary purchases above a threshold you set. Most impulse buys do not survive a day.",
            "Raise savings with income: when your pay rises, move at least half the increase straight into savings before lifestyle absorbs it."
        ],
        risk: "Cutting essentials like health cover or nutrition to hit a savings target usually costs more later.",
        appNote: "Ask me \"what is my savings rate\" or \"where did my money go last month\" to see where the leaks are."
    },
    {
        id: "sip",
        title: "SIP (Systematic Investment Plan)",
        keywords: [
            "sip", "systematic investment", "monthly investment", "rupee cost averaging",
            "what is sip", "sip vs lumpsum", "step up sip"
        ],
        summary:
            "A SIP is an instruction to invest a fixed amount in a mutual fund at a fixed interval. It is a method of investing, not an asset class.",
        points: [
            "It buys more units when prices fall and fewer when they rise - rupee cost averaging. This reduces timing risk, it does not eliminate loss.",
            "Discipline is the real benefit: it removes the monthly \"is now a good time\" question.",
            "A step-up SIP raises the amount annually (say 10%) to keep pace with income. Over long horizons the difference is large.",
            "SIP returns follow the underlying fund. A SIP in an equity fund is an equity investment with equity risk."
        ],
        risk: "SIPs do not guarantee profit. In a long falling market you accumulate units at lower prices but your portfolio is still down.",
        appNote: "The AI Goal Planner calculates the exact monthly SIP each of your goals needs, and what it projects to."
    },
    {
        id: "mutual_funds",
        title: "Mutual funds",
        keywords: [
            "mutual fund", "mutual funds", "equity fund", "debt fund", "hybrid fund",
            "nav", "expense ratio", "direct plan", "regular plan", "amc", "flexi cap",
            "large cap", "mid cap", "small cap", "elss"
        ],
        summary:
            "A pooled vehicle where a fund manager invests many investors' money in a portfolio of securities. You own units; their value is the NAV.",
        points: [
            "Equity funds invest in shares (higher risk, higher long-run return potential). Debt funds invest in bonds and similar (lower risk, lower return). Hybrid funds mix both.",
            "Direct plans cost less than regular plans because they cut the distributor commission. Over 15 years that gap compounds into a meaningful sum.",
            "Expense ratio is deducted daily from NAV. Index funds typically charge 0.1-0.3%; active funds often 0.5-2%.",
            "Large-cap funds are the least volatile equity category; small-cap the most. Category matters more than the specific fund name.",
            "ELSS funds qualify for Section 80C deduction with a 3-year lock-in - the shortest of the 80C options."
        ],
        risk: "Past performance is genuinely not predictive. Most active funds underperform their benchmark over 10-year periods after costs.",
        appNote: null
    },
    {
        id: "index_funds",
        title: "Index funds and ETFs",
        keywords: [
            "index fund", "index funds", "etf", "etfs", "nifty 50", "sensex fund",
            "passive investing", "tracking error", "nifty next 50"
        ],
        summary:
            "Funds that mechanically replicate an index rather than trying to beat it. An ETF is the same idea but trades on the exchange like a share.",
        points: [
            "Low cost is the structural advantage: you keep more of whatever the market returns.",
            "No manager risk - the fund cannot underperform through bad stock picks, only through tracking error and fees.",
            "Index funds are bought at end-of-day NAV; ETFs trade live and need a demat account. ETFs can trade slightly away from their true value when volumes are thin.",
            "A Nifty 50 fund is concentrated in large companies and a few sectors. Broader indices (Nifty 500) diversify further."
        ],
        risk: "You get the market return including the falls. An index fund will drop the full amount the index drops.",
        appNote: null
    },
    {
        id: "stocks",
        title: "Direct stocks",
        keywords: [
            "stock", "stocks", "share market", "shares", "equity", "trading",
            "invest in stocks", "demat", "sensex", "nifty", "ipo", "dividend"
        ],
        summary:
            "Buying part-ownership of a specific company. Returns come from the business performing well and from dividends.",
        points: [
            "Concentration cuts both ways: one company can outperform any fund, or lose most of its value permanently.",
            "You need a demat and trading account, and you are responsible for research, diversification and rebalancing.",
            "Long-term capital gains above ₹1.25 lakh a year are taxed at 12.5%; short-term at 20%. Frequent trading also costs brokerage and STT.",
            "A common approach is a core of index funds with a small satellite in direct stocks, so a single mistake cannot derail a goal."
        ],
        risk: "Very high. Individual companies can and do go to zero. Never hold goal-critical money in a handful of stocks.",
        appNote: null
    },
    {
        id: "fixed_deposit",
        title: "Fixed deposits",
        keywords: [
            "fd", "fixed deposit", "term deposit", "rd", "recurring deposit",
            "bank deposit", "fd rate", "fd interest"
        ],
        summary:
            "You lend money to a bank for a fixed period at a fixed rate. The maturity value is known on day one.",
        points: [
            "Deposits are insured up to ₹5 lakh per bank per depositor by DICGC - across all your accounts at that bank combined.",
            "Interest is taxed at your slab rate every year as it accrues, which is what makes FDs weak for high earners over long periods.",
            "Premature withdrawal usually costs 0.5-1% of the rate. Laddering (several FDs maturing at different times) reduces that need.",
            "5-year tax-saver FDs qualify for 80C but cannot be broken early."
        ],
        risk: "Low credit risk, but real inflation risk: if the FD pays 7% and inflation is 6%, the real gain is about 1% before tax.",
        appNote: null
    },
    {
        id: "bonds",
        title: "Bonds and debt",
        keywords: [
            "bond", "bonds", "debentures", "g-sec", "government securities",
            "debt fund", "yield", "coupon", "duration", "corporate bond"
        ],
        summary:
            "A bond is a loan to a government or company that pays periodic interest and returns the principal at maturity.",
        points: [
            "Government securities carry effectively no default risk in domestic currency; corporate bonds pay more because they can default.",
            "Bond prices move inversely to interest rates. Longer-duration bonds swing more when rates change.",
            "Debt mutual funds give you a diversified bond portfolio without buying individual issues, plus daily liquidity.",
            "For units bought after 1 April 2023, debt fund gains are taxed at slab rate regardless of holding period."
        ],
        risk: "Credit risk (issuer defaults) and interest-rate risk (prices fall when rates rise). \"Safe\" is relative to the issuer.",
        appNote: null
    },
    {
        id: "gold",
        title: "Gold",
        keywords: [
            "gold", "sgb", "sovereign gold bond", "gold etf", "digital gold",
            "invest in gold", "gold rate", "jewellery investment"
        ],
        summary:
            "Gold is a store of value rather than a productive asset - it pays no dividend or interest, so returns come purely from price.",
        points: [
            "Sovereign Gold Bonds pay 2.5% annual interest on top of the gold price, and capital gains at maturity are tax exempt. That makes them the most efficient form for long holdings.",
            "Gold ETFs track the price with easy exit but no interest.",
            "Jewellery is a poor investment vehicle: making charges of 8-25% and GST are lost immediately on resale.",
            "5-10% of a portfolio is a common allocation as a hedge, not as a growth engine."
        ],
        risk: "Gold can go nowhere for years, then move sharply. It hedges currency and crisis risk, not inflation reliably.",
        appNote: null
    },
    {
        id: "real_estate",
        title: "Real estate and REITs",
        keywords: [
            "real estate", "property", "flat", "house", "reit", "reits", "rental yield",
            "home loan", "buy vs rent", "invit"
        ],
        summary:
            "Property returns come from rent plus capital appreciation. REITs let you own income-producing commercial property in small amounts.",
        points: [
            "Residential rental yields in most Indian cities run about 2-4% gross, before maintenance, vacancy and property tax. Appreciation does the heavy lifting.",
            "Transaction costs are high: stamp duty, registration, brokerage, and months to sell. It is the least liquid mainstream asset.",
            "A home you live in is a lifestyle decision with a financial dimension, not primarily an investment.",
            "REITs are exchange-traded, start from a few hundred rupees, and must distribute at least 90% of net distributable cash flow."
        ],
        risk: "Concentration and illiquidity. A single property is often several times an investor's entire net worth, frequently leveraged.",
        appNote: null
    },
    {
        id: "tax_saving",
        title: "Tax-saving investments",
        keywords: [
            "tax saving", "80c", "80d", "tax deduction", "ppf", "nps", "elss",
            "old regime", "new regime", "save tax", "tax benefit", "sukanya"
        ],
        summary:
            "Section 80C allows deductions up to ₹1.5 lakh a year under the old tax regime. The new regime has lower rates but removes most of these deductions.",
        points: [
            "80C options include ELSS funds (3-year lock-in, market-linked), PPF (15 years, government-backed), EPF, 5-year tax-saver FD, life insurance premiums and principal on a home loan.",
            "80D covers health insurance premiums - a separate limit from 80C, and worth using regardless of tax.",
            "NPS offers an extra ₹50,000 deduction under 80CCD(1B), but locks money until 60 with limited partial withdrawal.",
            "Compare regimes each year: if your deductions are small, the new regime's lower rates often win. Run both numbers rather than assuming."
        ],
        risk: "Buying a bad product for a deduction is the classic mistake - endowment insurance policies sold as tax saving typically return 4-5%.",
        appNote: null,
        volatile: true
    },
    {
        id: "compounding",
        title: "Compounding and time",
        keywords: [
            "compound", "compounding", "compound interest", "rule of 72",
            "time value", "power of compounding", "cagr", "xirr"
        ],
        summary:
            "Compounding is returns earning returns. Its effect is not linear - the last decade of a long investment usually produces more growth than the first two combined.",
        points: [
            "Rule of 72: divide 72 by the annual return to get the rough years to double. At 12%, about 6 years.",
            "Starting earlier beats investing more later. ₹5,000/month from age 25 usually beats ₹10,000/month from age 35 by 60.",
            "CAGR is the smoothed annual rate; XIRR handles irregular cash flows like SIPs and is the honest measure for most portfolios.",
            "Costs compound too. A 1% higher expense ratio can cost 15-20% of the final corpus over 25 years."
        ],
        risk: "Compounding assumes you stay invested. Selling in a downturn resets the clock.",
        appNote: null
    },
    {
        id: "debt_management",
        title: "Debt and loans",
        keywords: [
            "loan", "emi", "debt", "credit card", "personal loan", "home loan",
            "interest rate", "prepay", "foreclosure", "credit score", "cibil",
            "avalanche", "snowball"
        ],
        summary:
            "Debt costs are certain; investment returns are not. Clearing high-interest debt is usually the highest guaranteed return available to you.",
        points: [
            "Credit card revolving interest runs 36-48% a year. Nothing in a portfolio reliably beats that, so clear it before investing.",
            "Avalanche method (highest rate first) costs least; snowball (smallest balance first) is easier to sustain psychologically. Both beat paying minimums.",
            "Prepaying a home loan early in the tenure saves the most interest, because early EMIs are mostly interest.",
            "Keep credit utilisation under 30% and never miss a due date - payment history is the largest component of your credit score."
        ],
        risk: "Taking a loan to invest amplifies losses as much as gains, and the EMI is due whether the market cooperates or not.",
        appNote: null
    },
    {
        id: "insurance",
        title: "Insurance",
        keywords: [
            "insurance", "term insurance", "life insurance", "health insurance",
            "mediclaim", "ulip", "endowment", "premium", "cover", "sum assured"
        ],
        summary:
            "Insurance transfers risk. It is protection, not investment - mixing the two usually produces weak versions of both.",
        points: [
            "Term insurance gives the largest cover for the lowest premium. A common rule of thumb is 10-15x annual income if others depend on you.",
            "Health cover matters even when young - a single hospitalisation can wipe out years of savings. Employer cover alone is thin and disappears with the job.",
            "ULIPs and endowment plans bundle insurance with investment. They typically deliver lower cover and lower returns than buying term insurance and investing the difference.",
            "Check the claim settlement ratio and, more importantly, disclose pre-existing conditions honestly - non-disclosure is the main reason claims are rejected."
        ],
        risk: "Being underinsured is the risk people notice too late. Being over-insured on the wrong product wastes decades of premiums.",
        appNote: null
    },
    {
        id: "asset_allocation",
        title: "Asset allocation and diversification",
        keywords: [
            "asset allocation", "diversification", "diversify", "portfolio",
            "rebalance", "rebalancing", "risk tolerance", "portfolio mix"
        ],
        summary:
            "How you split money across asset classes drives most of your portfolio's behaviour - far more than which specific fund or stock you pick.",
        points: [
            "Match assets to time horizon: money needed within 3 years belongs in debt or cash, not equity.",
            "A rough starting point is (100 - your age)% in equity, adjusted for how much volatility you can actually tolerate without selling.",
            "Rebalance once a year back to target weights. It mechanically forces you to sell what has run up and buy what has lagged.",
            "Diversification means assets that behave differently. Five equity funds holding the same 40 large caps is not diversified."
        ],
        risk: "Over-diversifying into 15 similar funds adds complexity and cost without reducing risk.",
        appNote: "The AI Goal Planner builds an allocation from your horizon, savings rate and stated risk tolerance, and explains each choice."
    },
    {
        id: "retirement",
        title: "Retirement planning",
        keywords: [
            "retirement", "retire", "pension", "nps", "epf", "corpus", "fire",
            "retirement corpus", "annuity"
        ],
        summary:
            "The target is a corpus large enough that withdrawals plus growth outlast you, accounting for inflation over a 25-30 year retirement.",
        points: [
            "A common heuristic is 25-30x your annual expenses at retirement, based on a 3-4% safe withdrawal rate.",
            "Inflate today's expenses to the retirement date before calculating - at 6% inflation, costs roughly triple in 20 years.",
            "EPF and NPS form the base for salaried investors; equity funds usually provide the growth on top.",
            "Do not de-risk everything at retirement. With a 25-year horizon left, an all-debt portfolio slowly loses to inflation."
        ],
        risk: "Sequence-of-returns risk: a market fall in the first few years of withdrawals damages a portfolio far more than the same fall later.",
        appNote: null
    },
    {
        id: "risk",
        title: "Risk and returns",
        keywords: [
            "risk", "volatility", "risk tolerance", "safe investment", "guaranteed return",
            "high return", "drawdown", "market crash", "correction"
        ],
        summary:
            "Return is compensation for risk. Any product promising high returns with no risk is either misunderstood or a fraud.",
        points: [
            "Volatility (price swings) is not the same as risk of permanent loss. A diversified index fund is volatile; a single leveraged bet risks permanent loss.",
            "Equity markets fall 10% often, 20% regularly, and 40-50% occasionally. Plan for that rather than being surprised by it.",
            "Your real risk tolerance is what you did in the last crash, not what you say in a questionnaire.",
            "Guaranteed-return products (FDs, small savings) carry inflation risk instead - the loss is slower and less visible."
        ],
        risk: "The largest risk for most investors is behavioural: selling low after a fall and buying back high.",
        appNote: null
    }
];

/* ==========================================================
                        LOOKUP
========================================================== */

/**
 * Scores every topic against the question and returns the best match.
 * @returns {{ topic, score } | null}
 */
export function findTopic(text) {
    const source = ` ${String(text || "").toLowerCase()} `;

    let best = null;

    for (const topic of TOPICS) {
        let score = 0;

        for (const keyword of topic.keywords) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");

            if (pattern.test(source)) {
                /* Longer, more specific keywords are stronger evidence. */
                score += 10 + keyword.length;
            }
        }

        if (score > 0 && (!best || score > best.score)) {
            best = { topic, score };
        }
    }

    return best;
}

export function listTopics() {
    return TOPICS.map(topic => topic.title);
}

export default { TOPICS, findTopic, listTopics };
