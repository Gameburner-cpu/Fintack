"""
db.py
Supabase client + the "current user" context.

WHY A USER CONTEXT?
-------------------
LangChain tools are called by the LLM, and the LLM must NEVER be allowed to
choose which user's data to read or write (it could hallucinate a user id and
leak another person's transactions).

So the user id is injected per-request by the API layer into a ContextVar,
and the tools read it from there. The LLM literally cannot pass a user_id.
"""

from contextvars import ContextVar
from supabase import create_client, Client

import config

_client: Client | None = None

# Per-request user id. Set by main.py before invoking the agent.
_current_user_id: ContextVar[str | None] = ContextVar(
    "current_user_id", default=None
)


def get_client() -> Client:
    """Lazy singleton Supabase client (service role - full table access)."""
    global _client

    if _client is None:
        _client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE,
        )

    return _client


def set_current_user(user_id: str | None) -> None:
    _current_user_id.set(str(user_id) if user_id is not None else None)


def get_current_user() -> str:
    """Returns the user id for this request, or raises if not logged in."""
    user_id = _current_user_id.get()

    if not user_id:
        raise PermissionError(
            "No user is logged in for this request, so personal financial "
            "data cannot be accessed."
        )

    return user_id


def has_user() -> bool:
    return _current_user_id.get() is not None
