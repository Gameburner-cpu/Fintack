"""
tools package
Collects every LangChain tool the FinTack agent can call.
"""

from tools.market_tools import MARKET_TOOLS
from tools.transaction_tools import TRANSACTION_TOOLS
from tools.goal_tools import GOAL_TOOLS
from tools.analytics_tools import ANALYTICS_TOOLS
from tools.knowledge_tools import KNOWLEDGE_TOOLS

ALL_TOOLS = (
    KNOWLEDGE_TOOLS
    + ANALYTICS_TOOLS
    + TRANSACTION_TOOLS
    + GOAL_TOOLS
    + MARKET_TOOLS
)

__all__ = [
    "ALL_TOOLS",
    "MARKET_TOOLS",
    "TRANSACTION_TOOLS",
    "GOAL_TOOLS",
    "ANALYTICS_TOOLS",
    "KNOWLEDGE_TOOLS",
]
    