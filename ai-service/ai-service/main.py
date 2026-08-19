"""
main.py
FastAPI wrapper around the agent.

Your Node backend calls POST /agent/ask with the message, the logged-in
user's id and the recent chat history. This service never trusts a user_id
that came from the browser - see the note on AGENT_SERVICE_TOKEN below.

Run locally:
    uvicorn main:app --reload --port 8000
"""

import hmac
import logging

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
import db
from agent import run_agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fintack-ai")

config.assert_config()

app = FastAPI(title="FinTack AI Agent Service", version="1.0.0")

# Only mount CORS if origins were explicitly configured. This service is meant
# to be called server-to-server by the Node backend, never by a browser.
if config.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )


# ==========================================================
#                      SCHEMAS
# ==========================================================

class ChatTurn(BaseModel):
    role: str
    message: str = ""


class AskRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    user_id: str | None = None
    history: list[ChatTurn] = []


class AskResponse(BaseModel):
    success: bool
    answer: str
    tools_used: list[str] = []


# ==========================================================
#                      ROUTES
# ==========================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": config.GROQ_MODEL,
        "service": "fintack-ai-agent",
    }


@app.post("/agent/ask", response_model=AskResponse)
async def ask(
    body: AskRequest,
    x_service_token: str = Header(default=""),
):
    """
    Security note: the caller must present the shared service token, and the
    user_id must be resolved from the JWT on the Node side. Never expose this
    endpoint directly to the browser - if you do, anyone can pass any user_id
    and read someone else's transactions.
    """
    # compare_digest avoids leaking the token through timing differences
    if not hmac.compare_digest(x_service_token, config.AGENT_SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid service token.")

    # ContextVar is set securely on the current async event loop
    db.set_current_user(body.user_id)

    try:
        # Await the agent so the context survives down to the tools!
        result = await run_agent(
            body.message.strip(),
            [turn.model_dump() for turn in body.history],
        )

        return AskResponse(
            success=True,
            answer=result["answer"],
            tools_used=result["tools_used"],
        )

    except Exception:
        # Log the real error server-side; never leak table names, PostgREST
        # messages or tracebacks back through the proxy to the browser.
        logger.exception("Agent failed")
        raise HTTPException(
            status_code=500,
            detail="The AI assistant hit an internal error. Please try again.",
        )

    finally:
        db.set_current_user(None)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=config.PORT, reload=True)