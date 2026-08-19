"""
transaction_tools.py
CRUD tools over the Supabase `transactions` table.

Table columns (from your existing backend/server.js):
    id, user_id, title, amount, type, category, date

The user_id is NEVER a tool argument - it is injected from the request
context in db.py, so the LLM cannot read or write another user's data.
"""

from datetime import date as date_cls, timedelta
from dateutil import parser as date_parser
from langchain_core.tools import tool

import db

# Keep categories consistent so the analytics tools can group reliably.
CATEGORIES = [
    "food", "travel", "shopping", "bills", "rent", "entertainment",
    "health", "education", "fuel", "subscription", "investment",
    "salary", "other",
]

# ==========================================================
#                      HELPERS
# ==========================================================

def _normalise_category(value: str) -> str:
    value = (value or "other").strip().lower()
    return value if value in CATEGORIES else "other"

def _parse_date(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return date_cls.today().isoformat()

    text = str(value).strip().lower()

    if text == "today":
        return date_cls.today().isoformat()
    if text == "yesterday":
        return (date_cls.today() - timedelta(days=1)).isoformat()
    if text == "tomorrow":
        return (date_cls.today() + timedelta(days=1)).isoformat()

    try:
        return date_cls.fromisoformat(text[:10]).isoformat()
    except ValueError:
        pass

    try:
        return date_parser.parse(text, dayfirst=True).date().isoformat()
    except (ValueError, OverflowError):
        return None

def _format_row(row: dict) -> str:
    return (
        f"#{row.get('id')} | {row.get('date')} | {row.get('title')} | "
        f"Rs {float(row.get('amount', 0)):,.2f} | {row.get('type')} | "
        f"{row.get('category')}"
    )

# ==========================================================
#                      TOOLS
# ==========================================================

@tool
async def add_transaction(
    title: str,
    amount: float,
    type: str = "expense",
    category: str = "other",
    date: str = "",
) -> str:
    """Record a new income or expense transaction for the logged-in user.

    Args:
        title: short description, e.g. 'Zomato dinner', 'Petrol'
        amount: positive number in rupees
        type: 'expense' or 'income'
        category: one of food, travel, shopping, bills, rent, entertainment,
                  health, education, fuel, subscription, investment, salary, other
        date: 'today', 'yesterday' or 'YYYY-MM-DD'. Defaults to today.

    Only call this when the user clearly wants to SAVE a transaction
    (e.g. 'add 500 spent on food', 'I paid 1200 for petrol yesterday').
    """
    try:
        user_id = db.get_current_user()

        if amount is None or float(amount) <= 0:
            return "Amount must be a positive number."

        parsed_date = _parse_date(date)

        if parsed_date is None:
            return (
                f"I could not understand the date '{date}'. "
                "Use 'today', 'yesterday' or a date like 2026-03-01."
            )

        payload = {
            "user_id": user_id,
            "title": (title or "Untitled").strip(),
            "amount": float(amount),
            "type": "income" if str(type).lower().startswith("in") else "expense",
            "category": _normalise_category(category),
            "date": parsed_date,
        }

        result = db.get_client().table("transactions").insert(payload).execute()

        if not result.data:
            return "The transaction could not be saved."

        return f"Saved transaction: {_format_row(result.data[0])}"

    except PermissionError as error:
        print(f"[Tool Error] PermissionError: {error}")
        return str(error)
    except Exception as error:
        print(f"[Tool Error] Supabase Exception: {error}")
        return f"Failed to add the transaction ({error})."


@tool
async def list_transactions(
    days: int = 30,
    category: str = "",
    type: str = "",
    limit: int = 20,
) -> str:
    """List the user's recent transactions, newest first."""
    try:
        user_id = db.get_current_user()
        since = (date_cls.today() - timedelta(days=int(days))).isoformat()

        query = (
            db.get_client()
            .table("transactions")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=True)
            .limit(int(limit))
        )

        if category:
            query = query.eq("category", _normalise_category(category))
        if type:
            query = query.eq(
                "type",
                "income" if str(type).lower().startswith("in") else "expense",
            )

        rows = query.execute().data or []

        if not rows:
            return f"No transactions found in the last {days} days."

        lines = "\n".join(_format_row(row) for row in rows)
        return f"{len(rows)} transaction(s) in the last {days} days:\n{lines}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        print(f"[Tool Error] Supabase Exception: {error}")
        return f"Failed to list transactions ({error})."


@tool
async def update_transaction(
    transaction_id: str,
    title: str = "",
    amount: float = 0,
    type: str = "",
    category: str = "",
    date: str = "",
) -> str:
    """Edit an existing transaction. Only the fields you pass are changed."""
    try:
        user_id = db.get_current_user()
        updates: dict = {}

        if title:
            updates["title"] = title.strip()
        if amount and float(amount) > 0:
            updates["amount"] = float(amount)
        if type:
            updates["type"] = (
                "income" if str(type).lower().startswith("in") else "expense"
            )
        if category:
            updates["category"] = _normalise_category(category)
        if date:
            parsed_date = _parse_date(date)
            if parsed_date is None:
                return f"I could not understand the date '{date}'."
            updates["date"] = parsed_date

        if not updates:
            return "Nothing to update - no new values were provided."

        result = (
            db.get_client()
            .table("transactions")
            .update(updates)
            .eq("id", transaction_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            return f"No transaction with id {transaction_id} belongs to this user."

        return f"Updated: {_format_row(result.data[0])}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        print(f"[Tool Error] Supabase Exception: {error}")
        return f"Failed to update the transaction ({error})."


@tool
async def delete_transaction(transaction_id: str) -> str:
    """Delete a transaction by its id."""
    try:
        user_id = db.get_current_user()

        result = (
            db.get_client()
            .table("transactions")
            .delete()
            .eq("id", transaction_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            return f"No transaction with id {transaction_id} belongs to this user."

        return f"Deleted transaction #{transaction_id}."

    except PermissionError as error:
        return str(error)
    except Exception as error:
        print(f"[Tool Error] Supabase Exception: {error}")
        return f"Failed to delete the transaction ({error})."


TRANSACTION_TOOLS = [
    add_transaction,
    list_transactions,
    update_transaction,
    delete_transaction,
]