"""
market_tools.py
Live market data tools - stock prices, USD/INR rate, gold, petrol, web search.

All free, no paid API keys required:
  - Yahoo Finance public chart endpoint  -> stocks, indices, gold futures
  - open.er-api.com                      -> currency rates
  - DuckDuckGo search                    -> petrol/diesel prices and anything else

Each tool returns a SHORT plain-text string. Keep tool output small - it goes
straight back into the model's context window on every step.
"""

from datetime import datetime, timezone

import requests
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun

TIMEOUT = 12
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinTackAI/1.0)"}

TROY_OUNCE_IN_GRAMS = 31.1035


# ==========================================================
#                  INTERNAL HELPERS
# ==========================================================

def _yahoo_quote(symbol: str) -> dict:
    """Fetch one quote from Yahoo Finance's public chart endpoint."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

    response = requests.get(
        url,
        params={"range": "5d", "interval": "1d"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    response.raise_for_status()

    result = response.json()["chart"]["result"]

    if not result:
        raise ValueError(f"No data returned for symbol '{symbol}'.")

    meta = result[0]["meta"]

    price = meta.get("regularMarketPrice")
    previous = meta.get("chartPreviousClose") or meta.get("previousClose")

    if price is None:
        raise ValueError(f"No price available for symbol '{symbol}'.")

    change_pct = None
    if previous:
        change_pct = (price - previous) / previous * 100

    return {
        "symbol": meta.get("symbol", symbol),
        "name": meta.get("longName") or meta.get("shortName") or symbol,
        "price": price,
        "currency": meta.get("currency", ""),
        "exchange": meta.get("fullExchangeName", ""),
        "change_pct": change_pct,
    }


def _usd_inr() -> float:
    response = requests.get(
        "https://open.er-api.com/v6/latest/USD",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return float(response.json()["rates"]["INR"])


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


# ==========================================================
#                       TOOLS
# ==========================================================

@tool
def get_stock_price(symbol: str) -> str:
    """Get the current market price of a stock, index, ETF or crypto.

    Use the Yahoo Finance ticker format:
      - Indian stocks on NSE: add '.NS'  (RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS)
      - Indian stocks on BSE: add '.BO'
      - Indian indices: '^NSEI' for Nifty 50, '^BSESN' for Sensex
      - US stocks: plain ticker (AAPL, MSFT, TSLA, NVDA)
      - Crypto: 'BTC-USD', 'ETH-USD'

    If the user gives a company name instead of a ticker, convert it to the
    ticker yourself, or use web_search first to find the correct ticker.
    """
    symbol = symbol.strip().upper()

    try:
        quote = _yahoo_quote(symbol)
    except Exception as error:
        return (
            f"Could not fetch a price for '{symbol}' ({error}). "
            "Check the ticker format, or use web_search instead."
        )

    change = (
        f"{quote['change_pct']:+.2f}% vs previous close"
        if quote["change_pct"] is not None
        else "change unavailable"
    )

    return (
        f"{quote['name']} ({quote['symbol']}) on {quote['exchange']}: "
        f"{quote['price']:,.2f} {quote['currency']}, {change}. "
        f"Fetched {_now()}."
    )


@tool
def get_currency_rate(from_currency: str, to_currency: str = "INR") -> str:
    """Get the current exchange rate between two currencies.

    Use 3-letter ISO codes, e.g. from_currency='USD', to_currency='INR'.
    Answers questions like 'what is the dollar rate' or '1 euro to rupees'.
    """
    base = from_currency.strip().upper()
    target = to_currency.strip().upper()

    try:
        response = requests.get(
            f"https://open.er-api.com/v6/latest/{base}",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("result") != "success":
            return f"Currency service returned an error for '{base}'."

        rate = data["rates"].get(target)

        if rate is None:
            return f"'{target}' is not a supported currency code."

        updated = data.get("time_last_update_utc", _now())

        return f"1 {base} = {rate:,.4f} {target}. Last updated {updated}."

    except Exception as error:
        return f"Could not fetch the {base}/{target} rate ({error})."


@tool
def get_gold_price() -> str:
    """Get the current gold price, in USD per troy ounce and INR per 10 grams.

    Returns the INTERNATIONAL spot/futures price converted to rupees. Indian
    retail gold costs roughly 15-18% more than this because of import duty and
    GST, and jewellery adds making charges on top. Always mention that caveat.
    For an exact local retail rate, use web_search.
    """
    try:
        quote = _yahoo_quote("GC=F")          # COMEX gold futures, USD/oz
        usd_per_ounce = quote["price"]

        usd_inr = _usd_inr()

        inr_per_10g = usd_per_ounce / TROY_OUNCE_IN_GRAMS * 10 * usd_inr

        return (
            f"Gold (international futures): ${usd_per_ounce:,.2f} per troy ounce. "
            f"At 1 USD = {usd_inr:,.2f} INR that is about "
            f"Rs {inr_per_10g:,.0f} per 10 grams of 24K, before Indian import "
            f"duty and GST (retail is typically 15-18% higher). "
            f"Fetched {_now()}."
        )

    except Exception as error:
        return (
            f"Could not fetch the gold price ({error}). "
            "Use web_search for 'gold rate today India' instead."
        )


@tool
def get_fuel_price(city: str = "Delhi", fuel_type: str = "petrol") -> str:
    """Get today's petrol or diesel price for an Indian city.

    There is no free official fuel price API, so this searches the web.
    fuel_type should be 'petrol', 'diesel' or 'cng'.
    """
    query = f"{fuel_type} price today {city} India rupees per litre"

    try:
        result = DuckDuckGoSearchRun().invoke(query)
        return (
            f"Web search results for {fuel_type} price in {city} "
            f"(verify the date in the text):\n{result[:1500]}"
        )
    except Exception as error:
        return f"Could not search for fuel prices ({error})."


@tool
def web_search(query: str) -> str:
    """Search the web for current information.

    Use this for anything time-sensitive that the other tools do not cover:
    market news, RBI repo rate, current FD interest rates, budget changes,
    company news, an unknown stock ticker, scheme rules, and so on.
    Never invent current figures - search for them.
    """
    try:
        result = DuckDuckGoSearchRun().invoke(query)
        return result[:2500] if result else "No results found."
    except Exception as error:
        return f"Web search failed ({error})."


MARKET_TOOLS = [
    get_stock_price,
    get_currency_rate,
    get_gold_price,
    get_fuel_price,
    web_search,
]
