# FinTack App Guide - What the Assistant Can Do

This file teaches the agent about its own product, so it can answer "what can
you do?" and guide users to the right feature.

## What FinTack is
FinTack is a personal finance app for Indian users. It tracks transactions,
savings goals, trips with shared expenses, a financial calendar and market news,
and includes an AI assistant.

## What the AI assistant can do

**Answer financial questions**
Live stock prices (NSE, BSE and US markets), currency rates, gold price, petrol
and diesel prices, and general questions about how financial products work.

**Give investment suggestions**
Given an amount, a time horizon and a risk comfort level, it suggests a split
across fixed deposits, recurring deposits, mutual funds, index funds, stocks,
PPF, NPS, gold and REITs, and explains what to avoid.

**Manage transactions by command**
Examples of what a user can type:
- "add 500 spent on lunch today"
- "I got my salary of 45000"
- "delete the petrol transaction from yesterday"
- "change my grocery expense to 1200"

**Manage goals by command**
- "create a goal to save 2 lakh for a bike by December 2026"
- "how is my Europe trip goal going"
- "I saved 5000 towards my emergency fund"
- "delete my old laptop goal"

**Analyse spending**
- "how much did I spend last week"
- "what did I spend on food last month"
- "which category do I spend the most on"
- "how can I save money based on my spending"

## Transaction categories used by the app
food, travel, shopping, bills, rent, entertainment, health, education, fuel,
subscription, investment, salary, other.

Keeping categories consistent is what makes the analysis useful - if the same
kind of expense is filed under three different categories, the totals mislead.

## Data the assistant can see
Only the logged-in user's own transactions and goals. It cannot see other users'
data, cannot access bank accounts, and cannot move money. It can add, edit and
delete records inside FinTack only when the user asks it to.

## Limits worth stating plainly
- Not a SEBI-registered investment adviser. Educational guidance only.
- Cannot execute trades, transfers or payments.
- Analysis is only as good as the transactions the user has recorded. With no
  transaction history, personalised advice is not possible.
- Live prices come from public data sources and can lag by a few minutes.
