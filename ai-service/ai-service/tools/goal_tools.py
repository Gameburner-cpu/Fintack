"""
goal_tools.py
CRUD tools over the Supabase `goals` table.

Table columns (from your existing backend/server.js):
    id, user_id, title, target_amount, saved_amount, deadline, created_at
"""

from datetime import date as date_cls

from dateutil import parser as date_parser
from langchain_core.tools import tool

import db


def _parse_deadline(value: str) -> str | None:
    """Returns an ISO date, or None if the text could not be parsed."""
    if not value or not str(value).strip():
        return None

    text = str(value).strip()

    # ISO first - dateutil with dayfirst=True would misread '2027-06-30'
    try:
        return date_cls.fromisoformat(text[:10]).isoformat()
    except ValueError:
        pass

    try:
        return date_parser.parse(text, dayfirst=True).date().isoformat()
    except (ValueError, OverflowError):
        return None


def _format_goal(row: dict) -> str:
    target = float(row.get("target_amount") or 0)
    saved = float(row.get("saved_amount") or 0)
    pct = (saved / target * 100) if target else 0

    deadline = row.get("deadline")
    remaining = max(target - saved, 0)

    months_left = ""
    if deadline:
        try:
            days = (date_cls.fromisoformat(str(deadline)[:10]) - date_cls.today()).days
            if days > 0:
                monthly = remaining / max(days / 30.44, 0.1)
                months_left = (
                    f", {days} days left, needs about Rs {monthly:,.0f}/month"
                )
            else:
                months_left = ", deadline has passed"
        except ValueError:
            pass

    return (
        f"#{row.get('id')} | {row.get('title')} | saved Rs {saved:,.0f} of "
        f"Rs {target:,.0f} ({pct:.1f}%) | deadline {deadline or 'none'}{months_left}"
    )


@tool
def add_goal(
    title: str,
    target_amount: float,
    deadline: str = "",
    saved_amount: float = 0,
) -> str:
    """Create a new savings goal for the logged-in user.

    Args:
        title: what the goal is for, e.g. 'Europe trip', 'Emergency fund'
        target_amount: total rupees needed
        deadline: target date as 'YYYY-MM-DD' (ask the user if not given)
        saved_amount: rupees already saved towards it (default 0)
    """
    try:
        user_id = db.get_current_user()

        if not target_amount or float(target_amount) <= 0:
            return "A goal needs a positive target amount."

        if deadline and _parse_deadline(deadline) is None:
            return (
                f"I could not understand the deadline '{deadline}'. "
                "Use a date like 2027-06-30."
            )

        payload = {
            "user_id": user_id,
            "title": (title or "New goal").strip(),
            "target_amount": float(target_amount),
            "saved_amount": float(saved_amount or 0),
            "deadline": _parse_deadline(deadline),
        }

        result = db.get_client().table("goals").insert(payload).execute()

        if not result.data:
            return "The goal could not be created."

        return f"Created goal: {_format_goal(result.data[0])}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to create the goal ({error})."


@tool
def list_goals() -> str:
    """List all savings goals for the logged-in user with progress and
    the monthly saving needed to hit each deadline.

    Use this whenever the user asks about their goals, and also before
    editing or deleting a goal so you know the correct goal id.
    """
    try:
        user_id = db.get_current_user()

        rows = (
            db.get_client()
            .table("goals")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )

        if not rows:
            return "This user has no savings goals yet."

        return f"{len(rows)} goal(s):\n" + "\n".join(_format_goal(r) for r in rows)

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to list goals ({error})."


@tool
def update_goal(
    goal_id: str,
    title: str = "",
    target_amount: float = 0,
    saved_amount: float = -1,
    deadline: str = "",
) -> str:
    """Edit a goal. Only the fields you pass are changed.

    Call list_goals first to find the goal_id.
    Note: saved_amount here SETS the total saved. To add money to a goal,
    use add_savings_to_goal instead.
    """
    try:
        user_id = db.get_current_user()

        updates: dict = {}

        if title:
            updates["title"] = title.strip()
        if target_amount and float(target_amount) > 0:
            updates["target_amount"] = float(target_amount)
        if saved_amount is not None and float(saved_amount) >= 0:
            updates["saved_amount"] = float(saved_amount)
        if deadline:
            parsed = _parse_deadline(deadline)
            if parsed is None:
                return f"I could not understand the deadline '{deadline}'."
            updates["deadline"] = parsed

        if not updates:
            return "Nothing to update - no new values were provided."

        result = (
            db.get_client()
            .table("goals")
            .update(updates)
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            return f"No goal with id {goal_id} belongs to this user."

        return f"Updated goal: {_format_goal(result.data[0])}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to update the goal ({error})."


@tool
def add_savings_to_goal(goal_id: str, amount: float) -> str:
    """Add money to a goal's saved amount, e.g. 'I saved 5000 towards my bike'.

    This increments the existing saved_amount rather than replacing it.
    """
    try:
        user_id = db.get_current_user()
        client = db.get_client()

        if not amount or float(amount) <= 0:
            return (
                "The amount added to a goal must be positive. To reduce a "
                "goal's saved amount, use update_goal instead."
            )

        # maybe_single() returns None instead of raising when no row matches.
        # Plain .single() raises an APIError on 0 rows, which would surface as
        # a confusing generic failure instead of a clear message.
        current = (
            client.table("goals")
            .select("saved_amount")
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not current or not current.data:
            return f"No goal with id {goal_id} belongs to this user."

        new_total = float(current.data["saved_amount"] or 0) + float(amount)

        result = (
            client.table("goals")
            .update({"saved_amount": new_total})
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            return f"Could not update goal {goal_id} - it may have been deleted."

        return f"Added Rs {float(amount):,.0f}. {_format_goal(result.data[0])}"

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to add savings ({error})."


@tool
def delete_goal(goal_id: str) -> str:
    """Delete a savings goal by id. Call list_goals first to find the id.

    This is irreversible - if the user's request is ambiguous, confirm first.
    """
    try:
        user_id = db.get_current_user()

        result = (
            db.get_client()
            .table("goals")
            .delete()
            .eq("id", goal_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            return f"No goal with id {goal_id} belongs to this user."

        return f"Deleted goal #{goal_id}."

    except PermissionError as error:
        return str(error)
    except Exception as error:
        return f"Failed to delete the goal ({error})."


GOAL_TOOLS = [
    add_goal,
    list_goals,
    update_goal,
    add_savings_to_goal,
    delete_goal,
]
