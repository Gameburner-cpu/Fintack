"""
analytics_tools.py
Spending analysis tools.

These do the ARITHMETIC IN PYTHON and hand the model a small summary.
Never make the LLM add up numbers itself - it will get them wrong. The tool
computes, the LLM explains.

Covers:
  - spending over any period ('last week expense')
  - spending by category ('last month on food')
  - the category the user spends most on
  - a full financial snapshot used to generate savings advice
  - recurring/subscription detection (monthly vs yearly savings)
"""

from collections import defaultdict
from datetime import date as date_cls, timedelta

from langchain_core.tools import tool

import db


# ==========================================================
#                       HELPERS
# ==========================================================

# Rolling windows, in days. 0 means "today only".
PERIODS = {
    "today": 0,
    "yesterday": 1,
    "this week": 7,
    "last week": 7,
    "last 7 days": 7,
    "this month": 30,
    "last month": 30,
    "last 30 days": 30,
    "last 3 months": 90,
    "last quarter": 90,
    "last 6 months": 180,
    "this year": 365,
    "last year": 365,
}

# PostgREST caps rows per request (max-rows, 1000 by default). Without paging,
# a heavy user's totals would be silently computed from a truncated set.
PAGE_SIZE = 1000
MAX_ROWS = 5000


def _days_for(period: str, default: int = 30) -> int:
    text = (period or "").strip().lower()
    return PERIODS.get(text, default)


def _fetch(days: int) -> list[dict]:
    """All of the user's transactions in the last `days` days, newest first.

    Pages through the result so totals are never computed from a truncated
    response.
    """
    user_id = db.get_current_user()
    since = (date_cls.today() - timedelta(days=max(days, 0))).isoformat()

    client = db.get_client()
    rows: list[dict] = []
    offset = 0

    while offset < MAX_ROWS:
        page = (
            client.table("transactions")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=True)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
            .data
            or []
        )

        rows.extend(page)

        if len(page) < PAGE_SIZE:
            break

        offset += PAGE_SIZE

    return rows


def _split(rows: list[dict]) -> tuple[float, float, dict]:
    """Returns (total_expense, total_income, expense_by_category)."""
    expense = 0.0
    income = 0.0
    by_category: dict[str, float] = defaultdict(float)

    for row in rows:
        amount = float(row.get("amount") or 0)

        if str(row.get("type", "")).lower() == "income":
            income += amount
        else:
            expense += amount
            by_category[str(row.get("category") or "other").lower()] += amount

    return expense, income, dict(by_category)


# ==========================================================
#                       TOOLS
# ==========================================================

@tool
def get_spending_summary(period: str = "last month") -> str:
    """Total income, total expense and net savings for a period.

    period can be: 'today', 'last week', 'last month', 'last 3 months',
    'last 6 months', 'this year'. Defaults to last month. These are rolling
    windows counted back from today, not calendar months - say so if the
    distinction matters to the user's question.

    Use this for 'how much did I spend last week', 'what are my expenses
    this month', 'am I saving anything'.
    """
    try:
        days = _days_for(period)
        rows = _fetch(days)

        if not rows:
            return f"No transactions recorded in the {period}."

        expense, income, by_category = _split(rows)

        top = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)[:5]
        breakdown = ", ".join(
            f"{name} Rs {value:,.0f} ({value / expense * 100:.0f}%)"
            for name, value in top
        ) if expense else "no expenses"

        net = income - expense
        daily = expense / max(days, 1)

        return (
            f"Period: {period} (last {max(days, 1)} day(s), "
            f"{len(rows)} transactions).\n"
            f"Total expense: Rs {expense:,.2f}\n"
            f"Total income: Rs {income:,.2f}\n"
            f"Net: Rs {net:,.2f} ({'saved' if net >= 0 else 'overspent'})\n"
            f"Average spend per day: Rs {daily:,.0f}\n"
            f"Top categories: {breakdown}"
        )

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to build the spending summary ({error})."


@tool
def get_category_spending(category: str, period: str = "last month") -> str:
    """How much the user spent in ONE category over a period.

    Answers 'how much did I spend on food last month', 'my travel expenses
    this week'. category examples: food, travel, shopping, bills, rent,
    entertainment, health, education, fuel, subscription.
    """
    try:
        days = _days_for(period)
        rows = _fetch(days)

        target = (category or "").strip().lower()

        matching = [
            row for row in rows
            if str(row.get("category") or "").lower() == target
            and str(row.get("type", "")).lower() != "income"
        ]

        if not matching:
            return f"No '{category}' expenses found in the {period}."

        total = sum(float(row.get("amount") or 0) for row in matching)
        expense, _, _ = _split(rows)
        share = (total / expense * 100) if expense else 0

        biggest = max(matching, key=lambda r: float(r.get("amount") or 0))

        recent = "\n".join(
            f"  {r.get('date')} - {r.get('title')} - Rs {float(r.get('amount') or 0):,.0f}"
            for r in matching[:8]
        )

        return (
            f"{category.title()} spending in the {period}:\n"
            f"Total: Rs {total:,.2f} across {len(matching)} transactions\n"
            f"Share of all spending: {share:.1f}%\n"
            f"Average per transaction: Rs {total / len(matching):,.0f}\n"
            f"Largest: {biggest.get('title')} Rs {float(biggest.get('amount') or 0):,.0f} "
            f"on {biggest.get('date')}\n"
            f"Recent items:\n{recent}"
        )

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to analyse category spending ({error})."


@tool
def get_top_spending_categories(period: str = "last month", top_n: int = 5) -> str:
    """Rank the user's spending categories from highest to lowest.

    Answers 'which category do I spend the most on', 'where is my money going'.
    """
    try:
        days = _days_for(period)
        rows = _fetch(days)

        if not rows:
            return f"No transactions recorded in the {period}."

        expense, _, by_category = _split(rows)

        if not by_category:
            return f"No expenses recorded in the {period}."

        ranked = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)

        lines = "\n".join(
            f"{index}. {name.title()}: Rs {value:,.0f} "
            f"({value / expense * 100:.1f}% of Rs {expense:,.0f})"
            for index, (name, value) in enumerate(ranked[: int(top_n)], start=1)
        )

        return f"Spending by category, {period}:\n{lines}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to rank categories ({error})."


@tool
def find_recurring_expenses(period: str = "last 6 months") -> str:
    """Find repeating charges - subscriptions, EMIs, rent, memberships.

    Groups transactions by a normalised title and reports anything that
    appears 2 or more times, with its typical amount and yearly cost.

    Use this before suggesting things like 'switch this monthly subscription
    to an annual plan' so the advice is based on the user's real charges.
    """
    try:
        days = _days_for(period, default=180)
        rows = _fetch(days)

        if not rows:
            return f"No transactions recorded in the {period}."

        groups: dict[str, list[float]] = defaultdict(list)

        for row in rows:
            if str(row.get("type", "")).lower() == "income":
                continue

            key = " ".join(
                str(row.get("title") or "").lower().split()
            )[:28].strip()

            if key:
                groups[key].append(float(row.get("amount") or 0))

        recurring = {
            name: amounts
            for name, amounts in groups.items()
            if len(amounts) >= 2
        }

        if not recurring:
            return (
                f"No clearly repeating charges found in the {period}. "
                "The user may not have enough transaction history yet."
            )

        ranked = sorted(
            recurring.items(),
            key=lambda kv: sum(kv[1]),
            reverse=True,
        )[:12]

        months = max(days / 30.44, 1)

        lines = []
        for name, amounts in ranked:
            total = sum(amounts)
            typical = total / len(amounts)
            per_year = total / months * 12

            lines.append(
                f"- '{name}': {len(amounts)}x, typically Rs {typical:,.0f} each, "
                f"Rs {total:,.0f} in this period, roughly Rs {per_year:,.0f}/year"
            )

        return (
            f"Repeating charges in the {period}:\n" + "\n".join(lines)
        )

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to find recurring expenses ({error})."


@tool
def get_financial_snapshot() -> str:
    """A complete picture of the user's finances: 3-month income, expense,
    savings rate, category split, recurring charges and active goals.

    Call this FIRST whenever the user asks for personalised advice, such as
    'how can I save money', 'where should I invest', 'review my finances'.
    Then combine it with search_financial_knowledge to give grounded advice.
    """
    try:
        user_id = db.get_current_user()
        rows = _fetch(90)

        if not rows:
            return (
                "This user has no transactions recorded yet, so no personalised "
                "analysis is possible. Ask them to add some transactions first."
            )

        expense, income, by_category = _split(rows)

        savings_rate = ((income - expense) / income * 100) if income else 0

        ranked = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
        category_lines = "\n".join(
            f"  {name.title()}: Rs {value:,.0f} "
            f"(Rs {value / 3:,.0f}/month, {value / expense * 100:.1f}%)"
            for name, value in ranked[:8]
        )

        goals = (
            db.get_client()
            .table("goals")
            .select("*")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )

        if goals:
            goal_lines = "\n".join(
                f"  {g.get('title')}: Rs {float(g.get('saved_amount') or 0):,.0f} "
                f"of Rs {float(g.get('target_amount') or 0):,.0f} "
                f"by {g.get('deadline') or 'no deadline'}"
                for g in goals
            )
        else:
            goal_lines = "  none set"

        return (
            f"FINANCIAL SNAPSHOT (last 90 days, {len(rows)} transactions)\n"
            f"Income: Rs {income:,.0f} (Rs {income / 3:,.0f}/month)\n"
            f"Expense: Rs {expense:,.0f} (Rs {expense / 3:,.0f}/month)\n"
            f"Monthly surplus: Rs {(income - expense) / 3:,.0f}\n"
            f"Savings rate: {savings_rate:.1f}%\n"
            f"Spending by category:\n{category_lines}\n"
            f"Goals:\n{goal_lines}"
        )

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to build the financial snapshot ({error})."


ANALYTICS_TOOLS = [
    get_spending_summary,
    get_category_spending,
    get_top_spending_categories,
    find_recurring_expenses,
    get_financial_snapshot,
]
