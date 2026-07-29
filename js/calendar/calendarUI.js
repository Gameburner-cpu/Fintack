/* ==========================================================================
   calendarUI.js
   FinTack Calendar UI

   Responsibilities:
   - Creates the calendar modal
   - Opens / closes calendar
   - Renders month grid
   - Displays daily transaction totals
   - Displays transactions for selected date
   - Handles previous / next month
   - Closes when clicking outside modal
   - Closes using X button
   - Closes using Escape key
========================================================================== */
import NotificationManager from "../notification/notificationManager.js";

class CalendarUI {
    constructor(calendarEngine) {
        this.calendar = calendarEngine;
        this.overlay = null;
        this.modal = null;
        this.isOpen = false;
        this.state = null; // Initialized state to prevent undefined reference issues
        this.boundEscapeHandler = this.handleEscape.bind(this);
        this.entryType = "expense";
    }

    init() {
        if (!this.calendar) {
            console.error("[CalendarUI] Calendar engine not provided.");
            return;
        }
        this.createModal();
        console.log("[CalendarUI] Initialized");
    }

    createModal() {
        // Prevent duplicate modal
        const existing = document.getElementById("fintack-calendar-overlay");
        if (existing) {
            existing.remove();
        }

        // Overlay
        this.overlay = document.createElement("div");
        this.overlay.id = "fintack-calendar-overlay";
        this.overlay.className = "fintack-calendar-overlay";

        // Calendar Window
        this.modal = document.createElement("div");
        this.modal.className = "fintack-calendar-modal";

        this.modal.innerHTML = `
            <div class="calendar-header">
                <div class="calendar-header-left">
                    <div class="calendar-icon-box">📅</div>
                    <div>
                        <div class="calendar-title">Calendar</div>
                        <div class="calendar-subtitle">Daily financial activity</div>
                    </div>  
                </div>

                <button class="calendar-close-btn" id="calendar-close-btn" type="button" aria-label="Close calendar">
                    ×
                </button>
            </div>

            <div class="calendar-month-navigation">
                <button class="calendar-nav-btn" id="calendar-prev-month" type="button" aria-label="Previous month">
                    ‹
                </button>

                <div class="calendar-current-month">
                    <div class="calendar-month-name" id="calendar-month-name">Month</div>
                    <div class="calendar-year" id="calendar-year">Year</div>
                </div>

                <button class="calendar-nav-btn" id="calendar-next-month" type="button" aria-label="Next month">
                    ›
                </button>
            </div>

            <div class="calendar-summary">
                <div class="calendar-summary-item">
                    <span class="summary-label">Income</span>
                    <span class="summary-value income" id="calendar-month-income">₹0</span>
                </div>

                <div class="calendar-summary-divider"></div>

                <div class="calendar-summary-item">
                    <span class="summary-label">Expenses</span>
                    <span class="summary-value expense" id="calendar-month-expense">₹0</span>
                </div>

                <div class="calendar-summary-divider"></div>

                <div class="calendar-summary-item">
                    <span class="summary-label">Balance</span>
                    <span class="summary-value" id="calendar-month-balance">₹0</span>
                </div>
            </div>

            <div class="calendar-weekdays">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
                <div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div class="calendar-grid" id="calendar-grid"></div>

            <div class="calendar-day-details">
                <div class="calendar-day-details-header">
                    <div>
                        <div class="selected-day-label">Selected Day</div>
                        <div class="selected-day-date" id="calendar-selected-date">—</div>
                    </div>
                    <div class="selected-day-total" id="calendar-selected-total">₹0</div>
                </div>

                <div class="calendar-quick-actions">
                    <button class="calendar-add-btn income" id="calendar-add-income" type="button">+ Add Income</button>
                    <button class="calendar-add-btn expense" id="calendar-add-expense" type="button">− Add Expense</button>
                </div>

                <form class="calendar-entry-form" id="calendar-entry-form">
                    <div class="calendar-entry-form-header">
                        <span id="calendar-entry-form-title">Add Expense</span>
                        <button type="button" id="calendar-entry-cancel">×</button>
                    </div>
                    <input id="calendar-entry-title" type="text" placeholder="Title (e.g. Fuel)" maxlength="80" required>
                    <div class="calendar-entry-row">
                        <input id="calendar-entry-amount" type="number" min="0.01" step="0.01" placeholder="Amount" required>
                        <select id="calendar-entry-category">
                            <option value="Other">Other</option><option value="Food">Food</option>
                            <option value="Transport">Transport</option><option value="Shopping">Shopping</option>
                            <option value="Bills">Bills</option><option value="Health">Health</option>
                            <option value="Entertainment">Entertainment</option><option value="Salary">Salary</option>
                            <option value="Investment">Investment</option>
                        </select>
                    </div>
                    <button class="calendar-entry-save" id="calendar-entry-save" type="submit">Add Expense</button>
                </form>

                <div class="calendar-transactions" id="calendar-transactions">
                    <div class="calendar-empty-state">
                        <div class="calendar-empty-icon">🧾</div>
                        <div class="calendar-empty-title">No transactions</div>
                        <div class="calendar-empty-text">No financial activity for this day.</div>
                    </div>
                </div>
            </div>
        `;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        // Event Listeners
        this.modal.querySelector("#calendar-close-btn")?.addEventListener("click", () => this.close());
        
        this.modal.querySelector("#calendar-prev-month")?.addEventListener("click", async () => {
            if (typeof this.calendar.previousMonth === "function") {
                await this.calendar.previousMonth();
                this.render();
            }
        });

        this.modal.querySelector("#calendar-next-month")?.addEventListener("click", async () => {
            if (typeof this.calendar.nextMonth === "function") {
                await this.calendar.nextMonth();
                this.render();
            }
        });

        // Click outside to close (only on overlay)
        this.overlay.addEventListener("click", event => {
            if (event.target === this.overlay) {
                this.close();
            }
        });

        this.modal.addEventListener("click", event => event.stopPropagation());
        this.modal.querySelector("#calendar-add-income")?.addEventListener("click", () => this.showEntryForm("income"));
        this.modal.querySelector("#calendar-add-expense")?.addEventListener("click", () => this.showEntryForm("expense"));
        this.modal.querySelector("#calendar-entry-cancel")?.addEventListener("click", () => this.hideEntryForm());
        this.modal.querySelector("#calendar-entry-form")?.addEventListener("submit", event => this.submitEntry(event));

        this.injectStyles();
    }

    async open() {
        if (!this.overlay) this.createModal();
        this.isOpen = true;

        try {
            if (typeof this.calendar.refresh === "function") {
                await this.calendar.refresh();
            }
        } catch (error) {
            console.warn("[CalendarUI] Refresh failed:", error);
        }

        this.render();
        this.overlay.classList.add("active");
        document.body.classList.add("calendar-modal-open");
        document.addEventListener("keydown", this.boundEscapeHandler);
        
        console.log("[CalendarUI] Opened");
    }

    close() {
        if (!this.overlay) return;
        this.isOpen = false;
        this.overlay.classList.remove("active");
        document.body.classList.remove("calendar-modal-open");
        document.removeEventListener("keydown", this.boundEscapeHandler);
        
        console.log("[CalendarUI] Closed");
    }

    handleEscape(event) {
        if (event.key === "Escape" && this.isOpen) {
            this.close();
        }
    }

    render() {
        if (!this.modal) return;
        this.state = this.calendar.getCalendarState();
        this.renderHeader();
        this.renderSummary();
        this.renderDays();
        this.renderSelectedDay();
    }

    renderHeader() {
        const monthName = this.state?.monthName || this.getMonthName(this.state?.currentMonth);
        this.setText("#calendar-month-name", monthName);
        this.setText("#calendar-year", this.state?.currentYear || "");
    }

    renderSummary() {
        const monthData = this.state?.currentMonthData || {};
        const totals = monthData.totals || {};

        const income = Number(totals.income || 0);
        const expense = Number(totals.expense || 0);
        const balance = Number(totals.balance ?? (income - expense));

        this.setText("#calendar-month-income", this.formatMoney(income));
        this.setText("#calendar-month-expense", this.formatMoney(expense));
        this.setText("#calendar-month-balance", this.formatMoney(balance));
    }

    renderDays() {
        const grid = this.modal.querySelector("#calendar-grid");
        if (!grid) return;
        grid.innerHTML = "";

        const days = this.state?.days || [];

        if (!days.length) {
            grid.innerHTML = `<div class="calendar-loading">Calendar data unavailable.</div>`;
            return;
        }

        days.forEach(day => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "calendar-day";

            if (day.isCurrentMonth === false || day.currentMonth === false) cell.classList.add("outside-month");
            if (day.isToday) cell.classList.add("today");

            const selectedKey = this.state?.selectedDay?.dateKey;
            if (selectedKey && day.dateKey === selectedKey) cell.classList.add("selected");

            const transactions = day.transactions || [];
            let income = 0, expense = 0;

            transactions.forEach(transaction => {
                const type = (transaction.type || transaction.transaction_type || "expense").toLowerCase();
                const amount = Math.abs(Number(transaction.amount || 0));
                type === "income" ? (income += amount) : (expense += amount);
            });

            cell.innerHTML = `
                <div class="calendar-day-number">${day.day || day.dayNumber || ""}</div>
                <div class="calendar-day-values">
                    ${income > 0 ? `<span class="day-income">+${this.formatCompactMoney(income)}</span>` : ""}
                    ${expense > 0 ? `<span class="day-expense">-${this.formatCompactMoney(expense)}</span>` : ""}
                </div>
            `;

            cell.addEventListener("click", () => this.selectDay(day));
            grid.appendChild(cell);
        });
    }

    async selectDay(day) {
        try {
            if (!day) return;
            this.calendar.selectDate(day.date || day.dateKey);
            this.render();
        } catch (error) {
            console.error("[CalendarUI] Failed to select date:", error);
        }
    }

    renderSelectedDay() {
        const selected = this.state?.selectedDay;

        if (!selected) {
            this.setText("#calendar-selected-date", "Select a date");
            this.setText("#calendar-selected-total", "₹0");
            this.renderTransactions([]);
            return;
        }

        this.setText("#calendar-selected-date", this.formatDate(selected.date || selected.dateKey));

        const transactions = selected.transactions || [];
        const totals = selected.totals || {};
        const expense = Number(totals.expense || 0);
        const income = Number(totals.income || 0);
        const balance = Number(totals.balance ?? (income - expense));

        this.setText("#calendar-selected-total", this.formatMoney(balance));
        this.renderTransactions(transactions);
    }

    showEntryForm(type) {
        if (!this.state?.selectedDay) return alert("Select a date first.");
        this.entryType = type === "income" ? "income" : "expense";
        const form = this.modal?.querySelector("#calendar-entry-form");
        const label = this.entryType === "income" ? "Add Income" : "Add Expense";
        this.setText("#calendar-entry-form-title", label);
        this.setText("#calendar-entry-save", label);
        form?.classList.add("active");
        this.modal?.querySelector("#calendar-entry-title")?.focus();
    }

    hideEntryForm() {
        const form = this.modal?.querySelector("#calendar-entry-form");
        form?.reset();
        form?.classList.remove("active");
    }

    getSelectedDateKey() {
        const selected = this.state?.selectedDay;
        if (!selected) return null;
        if (selected.dateKey) return String(selected.dateKey).split("T")[0];
        if (selected.date instanceof Date) {
            const y = selected.date.getFullYear();
            const m = String(selected.date.getMonth() + 1).padStart(2, "0");
            const d = String(selected.date.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }
        return selected.date ? String(selected.date).split("T")[0] : null;
    }

    async submitEntry(event) {
        event.preventDefault();
        let user = null;
        try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch (_) {}

        const date = this.getSelectedDateKey();
        const title = this.modal?.querySelector("#calendar-entry-title")?.value.trim() || "";
        const amount = Number(this.modal?.querySelector("#calendar-entry-amount")?.value || 0);
        const category = this.modal?.querySelector("#calendar-entry-category")?.value || "Other";
        const save = this.modal?.querySelector("#calendar-entry-save");

        if (!user?.id) return alert("Please login first.");
        if (!date) return alert("Select a date first.");
        if (!title || !Number.isFinite(amount) || amount <= 0) return alert("Enter a title and valid amount.");

        const oldText = save?.textContent || "Save";
        try {
            if (save) { save.disabled = true; save.textContent = "Saving..."; }
            const response = await fetch("https://fintack.onrender.com/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.id, title, amount, category, date, type: this.entryType })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.success === false) throw new Error(result?.message || result?.error || "Failed to save transaction.");

            // ======================================================
            // CREATE TRANSACTION NOTIFICATION
            // ======================================================

            NotificationManager.create(user.id, {
                type: this.entryType,
                title: this.entryType === "income" ? "Income Added" : "Expense Added",
                message: this.entryType === "income"
                        ? `₹${amount.toLocaleString("en-IN")} received from ${title}`
                        : `₹${amount.toLocaleString("en-IN")} spent on ${title}`,
                icon: this.entryType === "income" ? "fa-solid fa-wallet" : "fa-solid fa-receipt",
                data: {
                    transactionId: result?.transaction?.id || result?.id || null,
                    amount,
                    title,
                    category,
                    date,
                    type: this.entryType
                }
            });

            this.hideEntryForm();
            if (typeof this.calendar.refresh === "function") await this.calendar.refresh();
            if (typeof this.calendar.selectDate === "function") this.calendar.selectDate(date);
            this.render();
            window.dispatchEvent(new CustomEvent("fintack:transaction-created", { detail: { date, type: this.entryType } }));
        } catch (error) {
            console.error("[CalendarUI] Failed to save transaction:", error);
            alert(error.message || "Failed to save transaction.");
        } finally {
            if (save) { save.disabled = false; save.textContent = oldText; }
        }
    }

    renderTransactions(transactions) {
        const container = this.modal.querySelector("#calendar-transactions");
        if (!container) return;

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="calendar-empty-state">
                    <div class="calendar-empty-icon">🧾</div>
                    <div class="calendar-empty-title">No transactions</div>
                    <div class="calendar-empty-text">No financial activity for this day.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(transaction => {
            const type = (transaction.type || transaction.transaction_type || "expense").toLowerCase();
            const isIncome = type === "income";
            const amount = Number(transaction.amount || 0);
            const title = transaction.title || transaction.name || transaction.description || transaction.category || (isIncome ? "Income" : "Expense");
            const category = transaction.category || (isIncome ? "Income" : "Expense");

            return `
                <div class="calendar-transaction">
                    <div class="calendar-transaction-icon">${isIncome ? "↙" : "↗"}</div>
                    <div class="calendar-transaction-info">
                        <div class="calendar-transaction-title">${this.escapeHTML(title)}</div>
                        <div class="calendar-transaction-category">${this.escapeHTML(category)}</div>
                    </div>
                    <div class="calendar-transaction-amount ${isIncome ? "income" : "expense"}">
                        ${isIncome ? "+" : "-"}${this.formatMoney(amount)}
                    </div>
                </div>
            `;
        }).join("");
    }

    formatMoney(amount) {
        return `₹${Math.abs(Number(amount || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }

    formatCompactMoney(amount) {
        const value = Math.abs(Number(amount || 0));
        if (value >= 10000000) return `₹${(value / 10000000).toFixed(1).replace(".0", "")}Cr`;
        if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(".0", "")}L`;
        if (value >= 1000) return `₹${(value / 1000).toFixed(1).replace(".0", "")}k`;
        return `₹${value}`;
    }

    formatDate(dateValue) {
        if (!dateValue) return "Selected Day";
        const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(date.getTime())) return String(dateValue);
        
        return date.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    getMonthName(monthIndex) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months[Number(monthIndex) || 0];
    }

    setText(selector, value) {
        const element = this.modal?.querySelector(selector);
        if (element) element.textContent = value;
    }

    escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    injectStyles() {
        if (document.getElementById("fintack-calendar-styles")) return;

        const style = document.createElement("style");
        style.id = "fintack-calendar-styles";

        style.textContent = `
            /* ======================================================
               GLOBAL & OVERLAY
            ====================================================== */
            body.calendar-modal-open { overflow: hidden; }

            .fintack-calendar-overlay {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0, 0, 0, 0.72);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.22s ease, visibility 0.22s ease;
            }

            .fintack-calendar-overlay.active {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
            }

            /* ======================================================
               MODAL
            ====================================================== */
            .fintack-calendar-modal {
                width: min(430px, calc(100vw - 30px));
                max-height: calc(100vh - 36px);
                overflow-y: auto;
                overscroll-behavior: contain;
                border-radius: 26px;
                background: linear-gradient(180deg, #151c27 0%, #0d131c 100%);
                border: 1px solid rgba(255,255,255,0.08);
                box-shadow: 0 30px 80px rgba(0,0,0,0.65);
                transform: translateY(18px) scale(0.97);
                transition: transform 0.22s ease;
                color: #ffffff;
                scrollbar-width: none;
            }

            .fintack-calendar-modal::-webkit-scrollbar { display: none; }
            .fintack-calendar-overlay.active .fintack-calendar-modal { transform: translateY(0) scale(1); }

            /* ======================================================
               HEADER
            ====================================================== */
            .calendar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 20px 14px;
            }
            .calendar-header-left { display: flex; align-items: center; gap: 12px; }
            .calendar-icon-box {
                width: 42px; height: 42px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 14px;
                background: rgba(92, 169, 255, 0.12);
                border: 1px solid rgba(92,169,255,0.18);
                font-size: 19px;
            }
            .calendar-title { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; }
            .calendar-subtitle { margin-top: 2px; color: #8793a5; font-size: 11px; }

            .calendar-close-btn {
                width: 38px; height: 38px;
                display: flex; align-items: center; justify-content: center;
                border: none; border-radius: 50%;
                background: rgba(255,255,255,0.07); color: #b7c0cd;
                font-size: 26px; font-weight: 300; line-height: 1;
                cursor: pointer;
                transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
            }
            .calendar-close-btn:hover { background: rgba(255,255,255,0.12); color: #ffffff; }
            .calendar-close-btn:active { transform: scale(0.92); }

            /* ======================================================
               MONTH NAVIGATION
            ====================================================== */
            .calendar-month-navigation {
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 20px 16px;
            }
            .calendar-nav-btn {
                width: 40px; height: 40px;
                border: none; border-radius: 13px;
                background: #1d2634; color: #ffffff;
                font-size: 28px; cursor: pointer;
            }
            .calendar-current-month { text-align: center; }
            .calendar-month-name { font-size: 20px; font-weight: 800; }
            .calendar-year { margin-top: 2px; color: #7f8b9d; font-size: 11px; }

            /* ======================================================
               MONTH SUMMARY
            ====================================================== */
            .calendar-summary {
                margin: 0 18px 18px; padding: 13px 10px;
                display: flex; align-items: center; justify-content: space-around;
                border-radius: 16px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.06);
            }
            .calendar-summary-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
            .summary-label { color: #7f8a9b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; }
            .summary-value { font-size: 13px; font-weight: 800; }
            
            /* UPDATED COLOR FOR SUMMARY VALUES */
            .summary-value.income { color: #54dca5; }
            .summary-value.expense { color: #ff7777; }
            
            .calendar-summary-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.07); }

            /* Resets for leaked global styles on amounts */
            .summary-value, .summary-value.income, .summary-value.expense,
            .day-income, .day-expense,
            .calendar-transaction-amount, .calendar-transaction-amount.income, .calendar-transaction-amount.expense {
                background: transparent !important;
                background-image: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
            }

            /* ======================================================
               CALENDAR GRID & WEEKDAYS
            ====================================================== */
            .calendar-weekdays {
                display: grid; grid-template-columns: repeat(7, 1fr);
                padding: 0 16px 8px; text-align: center;
                color: #6f7a8b; font-size: 10px; font-weight: 700;
            }
            .calendar-grid {
                display: grid; grid-template-columns: repeat(7, 1fr);
                gap: 4px; padding: 0 14px 18px;
            }
            .calendar-day {
                position: relative; min-width: 0; height: 62px; padding: 7px 4px;
                display: flex; flex-direction: column; align-items: center;
                border: none; border-radius: 12px;
                background: transparent; color: #e9edf3;
                cursor: pointer; overflow: hidden;
                transition: background 0.15s ease, transform 0.15s ease;
            }
            .calendar-day:hover { background: rgba(255,255,255,0.05); }
            .calendar-day:active { transform: scale(0.94); }
            .calendar-day.outside-month { opacity: 0.25; }
            .calendar-day.today { box-shadow: inset 0 0 0 1px rgba(92,169,255,0.5); }
            .calendar-day.selected {
                background: linear-gradient(145deg, #4b9fff, #78c7ff);
                color: #07111e;
                box-shadow: 0 8px 20px rgba(73,158,255,0.28);
            }
            .calendar-day-number { font-size: 12px; font-weight: 800; }
            
            .calendar-day-values {
                margin-top: 5px; display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                min-height: 20px; font-size: 10px !important;
                font-weight: 800 !important; line-height: 1.1 !important;
                white-space: nowrap;
            }
            .day-income { color: #54dca5; margin-top: 5px !important; }
            .day-expense { color: #ff7777; margin-top: 5px !important; }
            .calendar-day.selected .day-income, .calendar-day.selected .day-expense { color: #07111e; }
            .calendar-loading { grid-column: 1 / -1; padding: 30px; text-align: center; color: #7d899a; font-size: 11px; }

            /* ======================================================
               SELECTED DAY & TRANSACTIONS
            ====================================================== */
            .calendar-day-details {
                margin: 0 14px 16px; padding: 16px; border-radius: 20px;
                background: rgba(255,255,255,0.035);
                border: 1px solid rgba(255,255,255,0.06);
            }
            .calendar-day-details-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
            .selected-day-label { color: #748094; font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; }
            .selected-day-date { margin-top: 3px; font-size: 14px; font-weight: 800; }
            .selected-day-total { font-size: 17px; font-weight: 900; }

            .calendar-transactions { display: flex; flex-direction: column; gap: 8px; }
            .calendar-transaction {
                display: flex; align-items: center; padding: 10px;
                border-radius: 14px; background: #18212e;
            }
            .calendar-transaction-icon {
                width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; border-radius: 11px;
                background: rgba(96,174,255,0.12); color: #68b6ff; font-size: 16px;
            }
            .calendar-transaction-info { min-width: 0; flex: 1; padding: 0 10px; }
            .calendar-transaction-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; font-weight: 700; }
            .calendar-transaction-category { margin-top: 2px; color: #7d899a; font-size: 9px; }
            
            .calendar-transaction-amount { flex-shrink: 0; font-size: 12px; font-weight: 800; }
            
            /* UPDATED COLOR FOR TRANSACTION AMOUNTS */
            .calendar-transaction-amount.income { color: #55dca4; }
            .calendar-transaction-amount.expense { color: #ff7777; }

            .calendar-empty-state { padding: 18px 10px 12px; text-align: center; }
            .calendar-empty-icon { margin-bottom: 6px; font-size: 22px; opacity: 0.7; }
            .calendar-empty-title { font-size: 12px; font-weight: 700; }
            .calendar-empty-text { margin-top: 4px; color: #778395; font-size: 9px; }

            .calendar-quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
            .calendar-add-btn { min-height:38px; border:1px solid rgba(255,255,255,.07); border-radius:12px; background:#18212e; color:#fff; font-size:11px; font-weight:800; cursor:pointer; }
            .calendar-add-btn.income { color:#68ddb0; } .calendar-add-btn.expense { color:#ff8b8b; }
            .calendar-entry-form { display:none; margin-bottom:12px; padding:12px; border-radius:14px; background:#121b27; border:1px solid rgba(255,255,255,.07); }
            .calendar-entry-form.active { display:block; }
            .calendar-entry-form-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:12px; font-weight:800; }
            #calendar-entry-cancel { width:28px; height:28px; border:0; border-radius:50%; background:rgba(255,255,255,.06); color:#aab4c2; font-size:19px; }
            .calendar-entry-form input, .calendar-entry-form select { width:100%; box-sizing:border-box; min-height:40px; padding:0 11px; border:1px solid rgba(255,255,255,.08); border-radius:11px; outline:none; background:#0c131d; color:#fff; font-size:11px; }
            .calendar-entry-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
            .calendar-entry-save { width:100%; min-height:40px; margin-top:8px; border:0; border-radius:11px; background:linear-gradient(135deg,#4b9fff,#78c7ff); color:#07111e; font-size:11px; font-weight:900; }
            .calendar-entry-save:disabled { opacity:.55; }

            /* ======================================================
               MOBILE RESPONSIVENESS
            ====================================================== */
            @media (max-width: 600px) {
                .fintack-calendar-overlay { padding: 10px; }
                
                .fintack-calendar-modal {
                    width: calc(100vw - 20px) !important;
                    max-width: 380px !important;
                    max-height: calc(100dvh - 20px) !important;
                    border-radius: 24px !important;
                }

                .calendar-header { padding: 16px 16px 10px !important; }
                .calendar-month-navigation { margin: 8px 0 !important; padding: 8px 16px 12px !important; }
                
                .calendar-summary {
                    margin: 0 14px 12px !important;
                    padding: 10px !important;
                }

                .calendar-grid {
                    padding: 0 10px 12px !important;
                    gap: 2px !important;
                }

                .calendar-day {
                    height: 52px !important; 
                    padding: 4px 2px !important;
                }

                .calendar-day-number { font-size: 11px !important; }

                .day-income, .day-expense {
                    font-size: 9px !important;
                    margin-top: 3px !important;
                }

                .calendar-day-details {
                    margin: 0 10px 14px !important;
                    padding: 14px !important;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

export default CalendarUI;