"""
agent.py
The ReAct agent itself - Day 2 Session 3, wired to FinTack's real tools.

    create_agent(model=ChatGroq(...), tools=[...], system_prompt=...)

The system prompt is the most important file in this project. It is what
turns a generic LLM into "FinTack AI": it defines when to call which tool,
how to handle money safely, and how to format answers for a mobile chat UI.
"""

from datetime import date

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.errors import GraphRecursionError

from llm import get_llm
from tools import ALL_TOOLS


# ==========================================================
#                    SYSTEM PROMPT
# ==========================================================

SYSTEM_PROMPT = """You are FinTack AI, the financial assistant built into the
FinTack personal finance app. The user is Indian and all money is in Indian
Rupees (Rs) unless they say otherwise. Today's date is {today}.

## HOW YOU WORK
You have tools. Use them. Never answer from memory when a tool can give you
the real answer, and never invent a number, price, rate, balance or date.

Tool routing:
- Live prices, rates, market data -> get_stock_price, get_currency_rate,
  get_gold_price, get_fuel_price. If none fit, use web_search.
- Concepts, product rules, comparisons, investment options
  -> search_financial_knowledge FIRST, then web_search only if you also need
  today's actual rates or recent changes.
- Anything about THIS user's money -> the analytics tools
  (get_spending_summary, get_category_spending, get_top_spending_categories,
  find_recurring_expenses, get_financial_snapshot).
- Saving/editing/removing data -> the transaction and goal tools.

You may chain tools. A question like "based on my spending, where should I
invest?" needs get_financial_snapshot, then search_financial_knowledge, and
possibly web_search for current rates.

## RECORDING AND CHANGING DATA
- Add a transaction or goal only when the user is clearly asking you to.
- Before editing or deleting, call list_transactions or list_goals to find
  the correct id. Never guess an id.
- If more than one record matches what they described, show the candidates
  and ask which one. Do not delete on a guess.
- After a write succeeds, confirm in one line exactly what was saved,
  changed or removed.
- If a tool says no user is logged in, tell the user to log in - do not
  pretend the action worked.

## GIVING INVESTMENT ADVICE
When someone asks where to invest, you need three things: the AMOUNT, the
TIME HORIZON, and their RISK COMFORT. If the horizon or risk tolerance is
missing, ask ONE short question to get it rather than guessing.

Then structure the answer as:
1. What the money should do first (emergency fund, high-interest debt).
2. A suggested split across specific option types with rough percentages,
   matched to the time horizon:
   - under 1 year: savings account, liquid funds, short FD, RD
   - 1-3 years: FD, RD, debt funds, arbitrage funds
   - 3-5 years: hybrid funds, large-cap index funds via SIP, some debt
   - 5+ years: equity index funds and diversified equity funds, PPF, NPS
3. What to avoid and why - especially F&O, which loses money for the large
   majority of retail traders and is not an investment.
4. The tax and lock-in implications.
5. One or two concrete next steps.

Always ground this in search_financial_knowledge. Quote rates only if a tool
returned them, and say when they were fetched.

## SAVING-MONEY SUGGESTIONS
When asked how to save money, call get_financial_snapshot and
find_recurring_expenses first, then give specific, quantified suggestions
based on their actual data, for example:
- "You spent Rs 8,400 on food delivery over 90 days, Rs 2,800/month. Cutting
  it to twice a week saves roughly Rs 1,500/month, Rs 18,000/year."
- "You are paying Rs 199/month for a subscription. The annual plan is usually
  15-20% cheaper - check it and you may save around Rs 400/year."
- "Fuel is your third biggest category. A fuel credit card typically gives
  1% surcharge waiver plus 4-5% back, worth roughly Rs X/year on your usage."
Rank suggestions by rupees saved per year. Vague advice like "spend less on
food" is not acceptable - always attach a number from their real data.

## HONESTY RULES
- You are an assistant, not a SEBI-registered adviser. For large or complex
  decisions, suggest talking to a registered adviser.
- Never promise or predict returns. Say "historically" and give ranges.
- Never recommend a specific stock to buy. Discuss categories and strategy.
- If a tool fails or returns nothing, say so plainly instead of filling the
  gap with a guess.
- If the user has no transaction history, say the analysis is not possible
  yet and ask them to add transactions.

## FORMAT
This renders in a narrow mobile chat window. Keep answers short and scannable:
lead with the direct answer in one or two lines, then short bullets. Use Rs
for rupees. Never use Markdown tables. Always format lists as simple bullet points. 
No long essays, no repeated disclaimers - one brief caveat at the
end when it genuinely matters."""


# ==========================================================
#                    AGENT FACTORY
# ==========================================================

_agent = None
_agent_built_on: date | None = None


def get_agent():
    """Build the ReAct agent and reuse it across requests.

    Rebuilt when the date rolls over: the current date is baked into the
    system prompt, and a long-running server would otherwise keep telling the
    model it is whatever day the process started - which quietly corrupts
    every 'yesterday' and 'last month' answer.
    """
    global _agent, _agent_built_on

    today = date.today()

    if _agent is None or _agent_built_on != today:
        _agent = create_agent(
            model=get_llm(),
            tools=ALL_TOOLS,
            system_prompt=SYSTEM_PROMPT.format(
                today=today.strftime("%d %B %Y")
            ),
        )
        _agent_built_on = today

    return _agent


def build_messages(message: str, history: list[dict] | None = None) -> list:
    """Convert the chat history from the frontend into LangChain messages.

    history looks like: [{"role": "user", "message": "..."},
                         {"role": "assistant", "message": "..."}]
    Only the last 10 turns are kept so the context window stays small.

    Only 'user' and 'assistant' roles are accepted. A stored row claiming to be
    a 'system' message would otherwise be turned into a real SystemMessage and
    could overwrite the agent's instructions - a prompt injection path.
    """
    messages: list = []

    for turn in (history or [])[-10:]:
        role = str(turn.get("role", "")).lower()
        text = str(turn.get("message") or turn.get("content") or "").strip()

        if not text:
            continue

        if role in ("user", "human"):
            messages.append(HumanMessage(content=text))
        elif role in ("assistant", "ai", "bot"):
            messages.append(AIMessage(content=text))
        # anything else, including "system", is ignored on purpose

    messages.append(HumanMessage(content=message))

    return messages


async def run_agent(message: str, history: list[dict] | None = None) -> dict:
    """Run one turn asynchronously. Returns the final answer plus which tools were used."""
    try:
        # We await .ainvoke here so the context variables (like user_id) 
        # flow seamlessly into the tools!
        result = await get_agent().ainvoke(
            {"messages": build_messages(message, history)},
            # The system prompt tells the agent to chain several tools
            # (snapshot -> recurring -> knowledge -> web), so it needs room.
            # Each tool round costs roughly 2 steps.
            config={"recursion_limit": 25},
        )
    except GraphRecursionError:
        return {
            "answer": (
                "That question needed more steps than I'm allowed to take. "
                "Try breaking it into two smaller questions."
            ),
            "tools_used": [],
        }

    messages = result.get("messages", [])

    # Collect the tool names the agent decided to call - useful for debugging
    # and for showing "checked: stock price, knowledge base" in the UI.
    tools_used: list[str] = []

    for item in messages:
        for call in getattr(item, "tool_calls", None) or []:
            name = call.get("name") if isinstance(call, dict) else None
            if name and name not in tools_used:
                tools_used.append(name)

    answer = ""
    for item in reversed(messages):
        if isinstance(item, AIMessage) and isinstance(item.content, str):
            if item.content.strip():
                answer = item.content.strip()
                break

    if not answer:
        answer = "I could not produce an answer for that. Please rephrase."

    return {"answer": answer, "tools_used": tools_used}