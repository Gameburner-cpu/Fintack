/* ==========================================================================
   calendar.js
   FinTack Calendar Engine

   Responsibilities:
   - Load transaction data
   - Track selected month
   - Track selected day
   - Generate calendar month data
   - Calculate daily/monthly totals
   - Provide calendar data to calendarUI.js
========================================================================== */

import {

    getCalendarTransactions,
    getTransactionsForDate,
    getTransactionsForMonth,
    calculateDailyTotals,
    calculateMonthlyTotals,
    groupTransactionsByDate,
    formatDateKey

} from "./calendarAPI.js";


class FinTackCalendar {

    constructor() {

        /* ==========================================================
                            USER
        ========================================================== */

        this.userId = null;


        /* ==========================================================
                        TRANSACTION DATA
        ========================================================== */

        this.transactions = [];

        this.groupedTransactions = {};


        /* ==========================================================
                        CURRENT CALENDAR VIEW
        ========================================================== */

        const today = new Date();

        this.currentYear =
            today.getFullYear();

        this.currentMonth =
            today.getMonth();


        /* ==========================================================
                        SELECTED DATE
        ========================================================== */

        this.selectedDate =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
            );


        /* ==========================================================
                        CHANGE LISTENERS
        ========================================================== */

        this.listeners = [];

    }


    /* ==========================================================
                        INITIALIZE CALENDAR
    ========================================================== */

    async initialize(userId) {

        if (!userId) {

            console.warn(
                "[Calendar] Cannot initialize without user ID."
            );

            return null;

        }

        this.userId = userId;

        await this.refresh();

        console.log(
            "[Calendar] Initialized:",
            this.getCalendarState()
        );

        return this.getCalendarState();

    }


    /* ==========================================================
                        REFRESH DATA
    ========================================================== */

    async refresh() {

        if (!this.userId) {

            return null;

        }

        this.transactions =
            await getCalendarTransactions(
                this.userId
            );

        this.groupedTransactions =
            groupTransactionsByDate(
                this.transactions
            );

        this.notify();

        return this.getCalendarState();

    }


    /* ==========================================================
                        PREVIOUS MONTH
    ========================================================== */

    previousMonth() {

        this.currentMonth--;

        if (this.currentMonth < 0) {

            this.currentMonth = 11;

            this.currentYear--;

        }

        this.notify();

        return this.getCalendarState();

    }


    /* ==========================================================
                            NEXT MONTH
    ========================================================== */

    nextMonth() {

        this.currentMonth++;

        if (this.currentMonth > 11) {

            this.currentMonth = 0;

            this.currentYear++;

        }

        this.notify();

        return this.getCalendarState();

    }


    /* ==========================================================
                            GO TO TODAY
    ========================================================== */

    goToToday() {

        const today =
            new Date();

        this.currentYear =
            today.getFullYear();

        this.currentMonth =
            today.getMonth();

        this.selectedDate =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
            );

        this.notify();

        return this.getCalendarState();

    }


    /* ==========================================================
                        SELECT DATE
    ========================================================== */

    selectDate(date) {

        if (!date) {

            return;

        }

        const selected =
            date instanceof Date
                ? date
                : this.createLocalDate(date);

        if (
            !selected ||
            Number.isNaN(selected.getTime())
        ) {

            return;

        }

        this.selectedDate =
            new Date(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
            );

        /*
            If user clicks a date belonging to
            another visible month, move calendar
            to that month automatically.
        */

        this.currentYear =
            this.selectedDate.getFullYear();

        this.currentMonth =
            this.selectedDate.getMonth();

        this.notify();

        return this.getSelectedDayData();

    }


    /* ==========================================================
                    SELECT DATE BY NUMBERS
    ========================================================== */

    selectDay(year, month, day) {

        return this.selectDate(

            new Date(
                year,
                month,
                day
            )

        );

    }


    /* ==========================================================
                    GET SELECTED DAY DATA
    ========================================================== */

    getSelectedDayData() {

        const transactions =
            getTransactionsForDate(

                this.transactions,

                this.selectedDate

            );

        const totals =
            calculateDailyTotals(
                transactions
            );

        return {

            date:
                new Date(
                    this.selectedDate
                ),

            dateKey:
                formatDateKey(
                    this.selectedDate
                ),

            transactions,

            totals

        };

    }


    /* ==========================================================
                    GET CURRENT MONTH DATA
    ========================================================== */

    getCurrentMonthData() {

        const transactions =
            getTransactionsForMonth(

                this.transactions,

                this.currentYear,

                this.currentMonth

            );

        const totals =
            calculateMonthlyTotals(
                transactions
            );

        return {

            year:
                this.currentYear,

            month:
                this.currentMonth,

            monthName:
                this.getMonthName(
                    this.currentMonth
                ),

            transactions,

            totals

        };

    }


    /* ==========================================================
                    GENERATE CALENDAR DAYS
    ========================================================== */

    getCalendarDays() {

        const year =
            this.currentYear;

        const month =
            this.currentMonth;


        /* ----------------------------------------------------------
                        CURRENT MONTH
        ---------------------------------------------------------- */

        const firstDay =
            new Date(
                year,
                month,
                1
            );

        const lastDay =
            new Date(
                year,
                month + 1,
                0
            );


        const daysInMonth =
            lastDay.getDate();

        const startWeekDay =
            firstDay.getDay();


        const days = [];


        /* ----------------------------------------------------------
                    PREVIOUS MONTH DAYS
        ---------------------------------------------------------- */

        const previousMonthLastDay =
            new Date(
                year,
                month,
                0
            ).getDate();


        for (
            let i = startWeekDay - 1;
            i >= 0;
            i--
        ) {

            const dayNumber =
                previousMonthLastDay - i;

            const date =
                new Date(
                    year,
                    month - 1,
                    dayNumber
                );

            days.push(
                this.createDayObject(
                    date,
                    false
                )
            );

        }


        /* ----------------------------------------------------------
                        CURRENT MONTH DAYS
        ---------------------------------------------------------- */

        for (
            let day = 1;
            day <= daysInMonth;
            day++
        ) {

            const date =
                new Date(
                    year,
                    month,
                    day
                );

            days.push(
                this.createDayObject(
                    date,
                    true
                )
            );

        }


        /* ----------------------------------------------------------
                        NEXT MONTH DAYS
        ---------------------------------------------------------- */

        let nextDay = 1;

        while (
            days.length % 7 !== 0
        ) {

            const date =
                new Date(
                    year,
                    month + 1,
                    nextDay
                );

            days.push(
                this.createDayObject(
                    date,
                    false
                )
            );

            nextDay++;

        }


        /*
            Keep a consistent six-row calendar.

            7 columns × 6 rows = 42 cells.

            This prevents the modal/card from jumping
            in height when changing months.
        */

        while (
            days.length < 42
        ) {

            const date =
                new Date(
                    year,
                    month + 1,
                    nextDay
                );

            days.push(
                this.createDayObject(
                    date,
                    false
                )
            );

            nextDay++;

        }

        return days;

    }


    /* ==========================================================
                        CREATE DAY OBJECT
    ========================================================== */

    createDayObject(
        date,
        isCurrentMonth
    ) {

        const dateKey =
            formatDateKey(date);

        const transactions =
            this.groupedTransactions[
                dateKey
            ] || [];

        const totals =
            calculateDailyTotals(
                transactions
            );

        const today =
            new Date();

        const todayKey =
            formatDateKey(today);

        const selectedKey =
            formatDateKey(
                this.selectedDate
            );


        return {

            date:
                new Date(date),

            dateKey,

            day:
                date.getDate(),

            isCurrentMonth,

            isToday:
                dateKey === todayKey,

            isSelected:
                dateKey === selectedKey,

            hasTransactions:
                transactions.length > 0,

            transactionCount:
                transactions.length,

            transactions,

            income:
                totals.income,

            expense:
                totals.expense,

            balance:
                totals.balance

        };

    }


    /* ==========================================================
                    GET COMPLETE CALENDAR STATE
    ========================================================== */

    getCalendarState() {

        return {

            userId:
                this.userId,

            currentYear:
                this.currentYear,

            currentMonth:
                this.currentMonth,

            monthName:
                this.getMonthName(
                    this.currentMonth
                ),

            days:
                this.getCalendarDays(),

            selectedDay:
                this.getSelectedDayData(),

            currentMonthData:
                this.getCurrentMonthData(),

            totalTransactions:
                this.transactions.length

        };

    }


    /* ==========================================================
                        MONTH NAME
    ========================================================== */

    getMonthName(month) {

        const months = [

            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"

        ];

        return months[month] || "";

    }


    /* ==========================================================
                        FORMAT DISPLAY DATE
    ========================================================== */

    formatDisplayDate(date) {

        if (!date) {

            return "";

        }

        return new Intl.DateTimeFormat(

            "en-IN",

            {

                weekday: "long",

                day: "numeric",

                month: "long",

                year: "numeric"

            }

        ).format(date);

    }


    /* ==========================================================
                        CHANGE LISTENER
    ========================================================== */

    onChange(callback) {

        if (
            typeof callback !== "function"
        ) {

            return () => {};

        }

        this.listeners.push(
            callback
        );


        /*
            Return unsubscribe function.
        */

        return () => {

            this.listeners =
                this.listeners.filter(
                    listener =>
                        listener !== callback
                );

        };

    }


    /* ==========================================================
                        NOTIFY LISTENERS
    ========================================================== */

    notify() {

        const state =
            this.getCalendarState();

        this.listeners.forEach(
            listener => {

                try {

                    listener(state);

                }

                catch (error) {

                    console.error(
                        "[Calendar] Listener error:",
                        error
                    );

                }

            }
        );

    }


    /* ==========================================================
                        SAFE DATE CREATOR
    ========================================================== */

    createLocalDate(value) {

        if (
            value instanceof Date
        ) {

            return new Date(
                value.getFullYear(),
                value.getMonth(),
                value.getDate()
            );

        }

        if (
            typeof value === "string"
        ) {

            const match =
                value.match(
                    /^(\d{4})-(\d{2})-(\d{2})/
                );

            if (match) {

                return new Date(

                    Number(match[1]),

                    Number(match[2]) - 1,

                    Number(match[3])

                );

            }

        }

        return new Date(value);

    }

}


/* ==========================================================
                    SINGLE CALENDAR INSTANCE
========================================================== */

/*
    We use one shared calendar instance throughout FinTack.

    calendarUI.js will import this same instance.
*/

const Calendar =
    new FinTackCalendar();


export {

    FinTackCalendar

};


export default Calendar;