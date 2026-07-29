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

class CalendarUI {

    constructor(calendarEngine) {
        this.calendar = calendarEngine;
        this.overlay = null;
        this.modal = null;
        this.isOpen = false;
        this.boundEscapeHandler = this.handleEscape.bind(this);
    }

    /* ==========================================================
                        INITIALIZE
    ========================================================== */
    init() {
        if (!this.calendar) {
            console.error("[CalendarUI] Calendar engine not provided.");
            return;
        }
        this.createModal();
        console.log("[CalendarUI] Initialized");
    }

    /* ==========================================================
                        CREATE MODAL
    ========================================================== */
    createModal() {
        /* ----------------------------------------------------------
           Prevent duplicate modal
        ---------------------------------------------------------- */
        const existing = document.getElementById("fintack-calendar-overlay");
        if (existing) {
            existing.remove();
        }

        /* ----------------------------------------------------------
           Overlay
        ---------------------------------------------------------- */
        this.overlay = document.createElement("div");
        this.overlay.id = "fintack-calendar-overlay";
        this.overlay.className = "fintack-calendar-overlay";

        /* ----------------------------------------------------------
           Calendar Window
        ---------------------------------------------------------- */
        this.modal = document.createElement("div");
        this.modal.className = "fintack-calendar-modal";

        this.modal.innerHTML = `
            <div class="calendar-header">
                <div class="calendar-header-left">
                    <div class="calendar-icon-box">
                        📅
                    </div>
                    <div>
                        <div class="calendar-title">
                            Calendar
                        </div>
                        <div class="calendar-subtitle">
                            Daily financial activity
                        </div>
                    </div>
                </div>

                <button
                    class="calendar-close-btn"
                    id="calendar-close-btn"
                    type="button"
                    aria-label="Close calendar"
                >
                    ×
                </button>
            </div>

            <div class="calendar-month-navigation">
                <button
                    class="calendar-nav-btn"
                    id="calendar-prev-month"
                    type="button"
                    aria-label="Previous month"
                >
                    ‹
                </button>

                <div class="calendar-current-month">
                    <div
                        class="calendar-month-name"
                        id="calendar-month-name"
                    >
                        Month
                    </div>
                    <div
                        class="calendar-year"
                        id="calendar-year"
                    >
                        Year
                    </div>
                </div>

                <button
                    class="calendar-nav-btn"
                    id="calendar-next-month"
                    type="button"
                    aria-label="Next month"
                >
                    ›
                </button>
            </div>

            <div class="calendar-summary">
                <div class="calendar-summary-item">
                    <span class="summary-label">
                        Income
                    </span>
                    <span
                        class="summary-value income"
                        id="calendar-month-income"
                    >
                        ₹0
                    </span>
                </div>

                <div class="calendar-summary-divider"></div>

                <div class="calendar-summary-item">
                    <span class="summary-label">
                        Expenses
                    </span>
                    <span
                        class="summary-value expense"
                        id="calendar-month-expense"
                    >
                        ₹0
                    </span>
                </div>

                <div class="calendar-summary-divider"></div>

                <div class="calendar-summary-item">
                    <span class="summary-label">
                        Balance
                    </span>
                    <span
                        class="summary-value"
                        id="calendar-month-balance"
                    >
                        ₹0
                    </span>
                </div>
            </div>

            <div class="calendar-weekdays">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>

            <div
                class="calendar-grid"
                id="calendar-grid"
            >
            </div>

            <div class="calendar-day-details">
                <div class="calendar-day-details-header">
                    <div>
                        <div class="selected-day-label">
                            Selected Day
                        </div>
                        <div
                            class="selected-day-date"
                            id="calendar-selected-date"
                        >
                            —
                        </div>
                    </div>

                    <div
                        class="selected-day-total"
                        id="calendar-selected-total"
                    >
                        ₹0
                    </div>
                </div>

                <div
                    class="calendar-transactions"
                    id="calendar-transactions"
                >
                    <div class="calendar-empty-state">
                        <div class="calendar-empty-icon">
                            🧾
                        </div>
                        <div class="calendar-empty-title">
                            No transactions
                        </div>
                        <div class="calendar-empty-text">
                            No financial activity for this day.
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        /* ----------------------------------------------------------
           Close button
        ---------------------------------------------------------- */
        const closeButton = this.modal.querySelector("#calendar-close-btn");
        closeButton?.addEventListener("click", () => this.close());

        /* ----------------------------------------------------------
           Previous month
        ---------------------------------------------------------- */
        const prevButton = this.modal.querySelector("#calendar-prev-month");
        prevButton?.addEventListener("click", async () => {
            if (typeof this.calendar.previousMonth === "function") {
                await this.calendar.previousMonth();
                this.render();
            }
        });

        /* ----------------------------------------------------------
           Next month
        ---------------------------------------------------------- */
        const nextButton = this.modal.querySelector("#calendar-next-month");
        nextButton?.addEventListener("click", async () => {
            if (typeof this.calendar.nextMonth === "function") {
                await this.calendar.nextMonth();
                this.render();
            }
        });

        /* ----------------------------------------------------------
           CLICK OUTSIDE TO CLOSE
           Important:
           Only close if the actual overlay itself was clicked.
           Clicking anything inside the modal will NOT close it.
        ---------------------------------------------------------- */
        this.overlay.addEventListener("click", event => {
            if (event.target === this.overlay) {
                this.close();
            }
        });

        /* ----------------------------------------------------------
           Stop modal click bubbling
        ---------------------------------------------------------- */
        this.modal.addEventListener("click", event => {
            event.stopPropagation();
        });

        /* ----------------------------------------------------------
           Inject CSS
        ---------------------------------------------------------- */
        this.injectStyles();
    }

    /* ==========================================================
                            OPEN
    ========================================================== */
    async open() {
        if (!this.overlay) {
            this.createModal();
        }

        this.isOpen = true;

        /* ----------------------------------------------------------
           Refresh calendar if supported
        ---------------------------------------------------------- */
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

    /* ==========================================================
                            CLOSE
    ========================================================== */
    close() {
        if (!this.overlay) return;

        this.isOpen = false;
        this.overlay.classList.remove("active");
        document.body.classList.remove("calendar-modal-open");
        document.removeEventListener("keydown", this.boundEscapeHandler);

        console.log("[CalendarUI] Closed");
    }

    /* ==========================================================
                            ESCAPE KEY
    ========================================================== */
    handleEscape(event) {
        if (event.key === "Escape" && this.isOpen) {
            this.close();
        }
    }

    /* ==========================================================
                            RENDER
    ========================================================== */
    render() {
        if (!this.modal) return;

        const state = this.calendar.getCalendarState();
        this.state = state;

        this.renderHeader();
        this.renderSummary();
        this.renderDays();
        this.renderSelectedDay();
    }

    /* ==========================================================
                            RENDER HEADER
    ========================================================== */
    renderHeader() {
        const monthElement = this.modal.querySelector("#calendar-month-name");
        const yearElement = this.modal.querySelector("#calendar-year");

        const monthName = this.state?.monthName || this.getMonthName(this.state?.currentMonth);

        if (monthElement) {
            monthElement.textContent = monthName;
        }

        if (yearElement) {
           yearElement.textContent = this.state?.currentYear || "";
        }
    }

    /* ==========================================================
                            MONTH SUMMARY
    ========================================================== */
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

    /* ==========================================================
                            RENDER CALENDAR DAYS
    ========================================================== */
    renderDays() {
        const grid = this.modal.querySelector("#calendar-grid");
        if (!grid) return;

        grid.innerHTML = "";

        const days = this.state?.days || [];

        if (!days.length) {
            grid.innerHTML = `
                <div class="calendar-loading">
                    Calendar data unavailable.
                </div>
            `;
            return;
        }

        days.forEach(day => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "calendar-day";

            /* ----------------------------------------------------------
               Detect current month
            ---------------------------------------------------------- */
            if (day.isCurrentMonth === false || day.currentMonth === false) {
                cell.classList.add("outside-month");
            }

            /* ----------------------------------------------------------
               Today
            ---------------------------------------------------------- */
            if (day.isToday) {
                cell.classList.add("today");
            }

            /* ----------------------------------------------------------
               Selected day
            ---------------------------------------------------------- */
            const selectedKey = this.state?.selectedDay?.dateKey;

            if (selectedKey && day.dateKey === selectedKey) {
                cell.classList.add("selected");
            }

            const transactions = day.transactions || [];

            let income = 0;
            let expense = 0;

            transactions.forEach(transaction => {

                const type = (
                    transaction.type ||
                    transaction.transaction_type ||
                    "expense"
                ).toLowerCase();

                const amount = Math.abs(
                    Number(transaction.amount || 0)
                );

                if (type === "income") {
                    income += amount;
                } else {
                    expense += amount;
                }

            });

            cell.innerHTML = `
                <div class="calendar-day-number">
                    ${day.day || day.dayNumber || ""}
                </div>

                <div class="calendar-day-values">
                    ${
                        income > 0
                            ? `
                                <span class="day-income">
                                    +${this.formatCompactMoney(income)}
                                </span>
                            `
                            : ""
                    }
                    ${
                        expense > 0
                            ? `
                                <span class="day-expense">
                                    -${this.formatCompactMoney(expense)}
                                </span>
                            `
                            : ""
                    }
                </div>
            `;

            cell.addEventListener("click", () => {
                this.selectDay(day);
            });

            grid.appendChild(cell);
        });
    }

    /* ==========================================================
                            SELECT DAY
    ========================================================== */
    async selectDay(day) {
        try {
            if (!day) return;

            this.calendar.selectDate(day.date || day.dateKey);
            this.render();
        } catch (error) {
            console.error("[CalendarUI] Failed to select date:", error);
        }
    }

    /* ==========================================================
                    RENDER SELECTED DAY
    ========================================================== */
    renderSelectedDay() {
        const selected = this.state?.selectedDay;

        if (!selected) {
            this.setText("#calendar-selected-date", "Select a date");
            this.setText("#calendar-selected-total", "₹0");
            return;
        }

        const dateLabel = this.formatDate(selected.date || selected.dateKey);
        this.setText("#calendar-selected-date", dateLabel);

        const transactions = selected.transactions || [];
        const totals = selected.totals || {};

        const expense = Number(totals.expense || 0);
        const income = Number(totals.income || 0);
        const balance = Number(totals.balance ?? (income - expense));

        this.setText("#calendar-selected-total", this.formatMoney(balance));
        this.renderTransactions(transactions);
    }

    /* ==========================================================
                    RENDER TRANSACTIONS
    ========================================================== */
    renderTransactions(transactions) {
        const container = this.modal.querySelector("#calendar-transactions");
        if (!container) return;

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="calendar-empty-state">
                    <div class="calendar-empty-icon">
                        🧾
                    </div>
                    <div class="calendar-empty-title">
                        No transactions
                    </div>
                    <div class="calendar-empty-text">
                        No financial activity for this day.
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions
            .map(transaction => {
                const type = (
                    transaction.type ||
                    transaction.transaction_type ||
                    "expense"
                ).toLowerCase();

                const isIncome = type === "income";
                const amount = Number(transaction.amount || 0);

                const title =
                    transaction.title ||
                    transaction.name ||
                    transaction.description ||
                    transaction.category ||
                    (isIncome ? "Income" : "Expense");

                const category =
                    transaction.category ||
                    (isIncome ? "Income" : "Expense");

                return `
                    <div class="calendar-transaction">
                        <div class="calendar-transaction-icon">
                            ${isIncome ? "↙" : "↗"}
                        </div>

                        <div class="calendar-transaction-info">
                            <div class="calendar-transaction-title">
                                ${this.escapeHTML(title)}
                            </div>
                            <div class="calendar-transaction-category">
                                ${this.escapeHTML(category)}
                            </div>
                        </div>

                        <div
                            class="
                                calendar-transaction-amount
                                ${isIncome ? "income" : "expense"}
                            "
                        >
                            ${isIncome ? "+" : "-"}
                            ${this.formatMoney(amount)}
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    /* ==========================================================
                        FORMAT MONEY
    ========================================================== */
    formatMoney(amount) {
        const value = Number(amount || 0);
        return `₹${Math.abs(value).toLocaleString("en-IN", {
            maximumFractionDigits: 2
        })}`;
    }

    /* ==========================================================
                    FORMAT COMPACT MONEY
    ========================================================== */
    formatCompactMoney(amount) {
        const value = Math.abs(Number(amount || 0));

        if (value >= 10000000) {
            return `₹${(value / 10000000).toFixed(1).replace(".0", "")}Cr`;
        }

        if (value >= 100000) {
            return `₹${(value / 100000).toFixed(1).replace(".0", "")}L`;
        }

        if (value >= 1000) {
            return `₹${(value / 1000).toFixed(1).replace(".0", "")}k`;
        }

        return `₹${value}`;
    }

    /* ==========================================================
                        FORMAT DATE
    ========================================================== */
    formatDate(dateValue) {
        if (!dateValue) return "Selected Day";

        let date;

        if (dateValue instanceof Date) {
            date = dateValue;
        } else {
            date = new Date(`${dateValue}T00:00:00`);
        }

        if (Number.isNaN(date.getTime())) {
            return String(dateValue);
        }

        return date.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    /* ==========================================================
                        MONTH NAME
    ========================================================== */
    getMonthName(monthIndex) {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[Number(monthIndex) || 0];
    }

    /* ==========================================================
                        SET TEXT
    ========================================================== */
    setText(selector, value) {
        const element = this.modal?.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    }

    /* ==========================================================
                        ESCAPE HTML
    ========================================================== */
    escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    /* ==========================================================
                        STYLES
    ========================================================== */
    injectStyles() {
        if (document.getElementById("fintack-calendar-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "fintack-calendar-styles";

        style.textContent = `
            /* ======================================================
                            BODY LOCK
            ====================================================== */
            body.calendar-modal-open {
                overflow: hidden;
            }

            /* ======================================================
                            OVERLAY
            ====================================================== */
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

            .fintack-calendar-modal::-webkit-scrollbar {
                display: none;
            }

            .fintack-calendar-overlay.active .fintack-calendar-modal {
                transform: translateY(0) scale(1);
            }

            /* ======================================================
                            HEADER
            ====================================================== */
            .calendar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 20px 14px;
            }

            .calendar-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .calendar-icon-box {
                width: 42px;
                height: 42px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 14px;
                background: rgba(92, 169, 255, 0.12);
                border: 1px solid rgba(92,169,255,0.18);
                font-size: 19px;
            }

            .calendar-title {
                font-size: 19px;
                font-weight: 800;
                letter-spacing: -0.3px;
            }

            .calendar-subtitle {
                margin-top: 2px;
                color: #8793a5;
                font-size: 11px;
            }

            /* ======================================================
                            CLOSE X BUTTON
            ====================================================== */
            .calendar-close-btn {
                width: 38px;
                height: 38px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 50%;
                background: rgba(255,255,255,0.07);
                color: #b7c0cd;
                font-size: 26px;
                font-weight: 300;
                line-height: 1;
                cursor: pointer;
                transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
            }

            .calendar-close-btn:hover {
                background: rgba(255,255,255,0.12);
                color: #ffffff;
            }

            .calendar-close-btn:active {
                transform: scale(0.92);
            }

            /* ======================================================
                        MONTH NAVIGATION
            ====================================================== */
            .calendar-month-navigation {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 20px 16px;
            }

            .calendar-nav-btn {
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 13px;
                background: #1d2634;
                color: #ffffff;
                font-size: 28px;
                cursor: pointer;
            }

            .calendar-current-month {
                text-align: center;
            }

            .calendar-month-name {
                font-size: 20px;
                font-weight: 800;
            }

            .calendar-year {
                margin-top: 2px;
                color: #7f8b9d;
                font-size: 11px;
            }

            /* ======================================================
                        MONTH SUMMARY
            ====================================================== */
            .calendar-summary {
                margin: 0 18px 18px;
                padding: 13px 10px;
                display: flex;
                align-items: center;
                justify-content: space-around;
                border-radius: 16px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.06);
            }

            .calendar-summary-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }

            .summary-label {
                color: #7f8a9b;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.6px;
            }

            .summary-value {
                font-size: 13px;
                font-weight: 800;
            }

            .summary-value.income,
            .summary-value.expense {
                color: #ffffff;
            }

            .calendar-summary-divider {
                width: 1px;
                height: 28px;
                background: rgba(255,255,255,0.07);
            }

            /* ======================================================
                            WEEKDAYS
            ====================================================== */
            .calendar-weekdays {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                padding: 0 16px 8px;
                text-align: center;
                color: #6f7a8b;
                font-size: 10px;
                font-weight: 700;
            }

            /* ======================================================
                        CALENDAR GRID
            ====================================================== */
            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 4px;
                padding: 0 14px 18px;
            }

            .calendar-day {
                position: relative;
                min-width: 0;
                height: 62px;
                padding: 7px 4px;
                display: flex;
                flex-direction: column;
                align-items: center;
                border: none;
                border-radius: 12px;
                background: transparent;
                color: #e9edf3;
                cursor: pointer;
                overflow: hidden;
                transition: background 0.15s ease, transform 0.15s ease;
            }

            .calendar-day:hover {
                background: rgba(255,255,255,0.05);
            }

            .calendar-day:active {
                transform: scale(0.94);
            }

            .calendar-day.outside-month {
                opacity: 0.25;
            }

            .calendar-day.today {
                box-shadow: inset 0 0 0 1px rgba(92,169,255,0.5);
            }

            .calendar-day.selected {
                background: linear-gradient(145deg, #4b9fff, #78c7ff);
                color: #07111e;
                box-shadow: 0 8px 20px rgba(73,158,255,0.28);
            }

            .calendar-day-number {
                font-size: 12px;
                font-weight: 800;
            }

            .calendar-day-values {
                margin-top: 5px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 20px;
                font-size: 8px;
                font-weight: 800;
                line-height: 10px;
                white-space: nowrap;
            }

            .day-income {
                color: #54dca5;
            }

            .day-expense {
                color: #ff7777;
            }

            .calendar-day.selected .day-income,
            .calendar-day.selected .day-expense {
                color: #07111e;
            }

            /* ======================================================
                        SELECTED DAY
            ====================================================== */
            .calendar-day-details {
                margin: 0 14px 16px;
                padding: 16px;
                border-radius: 20px;
                background: rgba(255,255,255,0.035);
                border: 1px solid rgba(255,255,255,0.06);
            }

            .calendar-day-details-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
            }

            .selected-day-label {
                color: #748094;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.7px;
            }

            .selected-day-date {
                margin-top: 3px;
                font-size: 14px;
                font-weight: 800;
            }

            .selected-day-total {
                font-size: 17px;
                font-weight: 900;
            }

            /* ======================================================
                        TRANSACTIONS
            ====================================================== */
            .calendar-transactions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .calendar-transaction {
                display: flex;
                align-items: center;
                padding: 10px;
                border-radius: 14px;
                background: #18212e;
            }

            .calendar-transaction-icon {
                width: 34px;
                height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border-radius: 11px;
                background: rgba(96,174,255,0.12);
                color: #68b6ff;
                font-size: 16px;
            }

            .calendar-transaction-info {
                min-width: 0;
                flex: 1;
                padding: 0 10px;
            }

            .calendar-transaction-title {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-size: 12px;
                font-weight: 700;
            }

            .calendar-transaction-category {
                margin-top: 2px;
                color: #7d899a;
                font-size: 9px;
            }

            .calendar-transaction-amount {
                flex-shrink: 0;
                font-size: 12px;
                font-weight: 800;
            }

            .calendar-transaction-amount.income {
                color: #55dca4;
            }

            .calendar-transaction-amount.expense {
                color: #ffffff;
            }

            /* ======================================================
                        EMPTY STATE
            ====================================================== */
            .calendar-empty-state {
                padding: 18px 10px 12px;
                text-align: center;
            }

            .calendar-empty-icon {
                margin-bottom: 6px;
                font-size: 22px;
                opacity: 0.7;
            }

            .calendar-empty-title {
                font-size: 12px;
                font-weight: 700;
            }

            .calendar-empty-text {
                margin-top: 4px;
                color: #778395;
                font-size: 9px;
            }

            .calendar-loading {
                grid-column: 1 / -1;
                padding: 30px;
                text-align: center;
                color: #7d899a;
                font-size: 11px;
            }
                
            /* Bigger transaction amounts inside calendar dates */

            .day-income,
            .day-expense {
                font-size: 10px !important;
                font-weight: 800 !important;
                line-height: 1.1 !important;
                margin-top: 5px !important;
            }

            /* ======================================================
                            MOBILE
            ====================================================== */
            @media (max-width: 480px) {
                .fintack-calendar-overlay {
                    padding: 10px;
                    align-items: center;
                }

                .fintack-calendar-modal {
                    width: calc(100vw - 20px);
                    max-height: calc(100dvh - 20px);
                    border-radius: 24px;
                }

                .calendar-header {
                    padding: 17px 16px 12px;
                }

                .calendar-grid {
                    padding-left: 10px;
                    padding-right: 10px;
                }

                .calendar-day {
                    height: 57px;
                }

                .calendar-day-number {
                    font-size: 11px;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

export default CalendarUI;

/* ==========================================================
   CALENDAR MONEY STYLE FIX
   Removes green/red background layers
========================================================== */

const fintackCalendarMoneyStyle = document.createElement("style");

fintackCalendarMoneyStyle.textContent = `

    /* Top Income / Expense / Balance values */

    .summary-value,
    .summary-value.income,
    .summary-value.expense {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;

        border: none !important;
        border-radius: 0 !important;

        box-shadow: none !important;

        padding: 0 !important;
    }


    /* Amounts displayed inside calendar days */

    .day-income,
    .day-expense {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;

        border: none !important;
        border-radius: 0 !important;

        box-shadow: none !important;

        padding: 0 !important;
    }


    /* Amount shown in selected-day transaction */

    .calendar-transaction-amount,
    .calendar-transaction-amount.income,
    .calendar-transaction-amount.expense {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;

        border: none !important;
        border-radius: 0 !important;

        box-shadow: none !important;

        padding: 0 !important;
    }

`;

document.head.appendChild(fintackCalendarMoneyStyle);