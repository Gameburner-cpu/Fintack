/* ==========================================================
                FINTACK NOTIFICATION UI
========================================================== */

import NotificationManager from "./notificationManager.js";

const NotificationUI = {

    userId: null,
    isOpen: false,


    /* ======================================================
                        INITIALIZE
    ====================================================== */

    initialize(userId) {

        if (!userId) {
            console.warn(
                "[NotificationUI] No user ID provided."
            );
            return;
        }

        this.userId = userId;

        console.log(
            "[NotificationUI] Initialized for:",
            userId
        );

        this.bindEvents();

        this.updateBadge();
    },


    /* ======================================================
                        BIND EVENTS
    ====================================================== */

    bindEvents() {

        /*
            Notification system changed.
        */

        window.addEventListener(
            "fintack:notifications-updated",
            (event) => {

                if (
                    event.detail?.userId &&
                    event.detail.userId !== this.userId
                ) {
                    return;
                }

                this.updateBadge();

                if (this.isOpen) {
                    this.renderNotifications();
                }
            }
        );


        /*
            ESC closes notification window.
        */

        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Escape" &&
                    this.isOpen
                ) {
                    this.close();
                }
            }
        );
    },


    /* ======================================================
                        OPEN WINDOW
    ====================================================== */

    open() {

        const overlay =
            document.getElementById(
                "notificationOverlay"
            );

        if (!overlay) {

            console.error(
                "[NotificationUI] notificationOverlay not found."
            );

            return;
        }

        this.isOpen = true;

        overlay.classList.remove("hidden");

        document.body.classList.add(
            "notification-open"
        );

        this.renderNotifications();
    },


    /* ======================================================
                        CLOSE WINDOW
    ====================================================== */

    close() {

        const overlay =
            document.getElementById(
                "notificationOverlay"
            );

        if (!overlay) return;

        overlay.classList.add("hidden");

        document.body.classList.remove(
            "notification-open"
        );

        this.isOpen = false;
    },


    /* ======================================================
                        TOGGLE WINDOW
    ====================================================== */

    toggle() {

        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },


    /* ======================================================
                        UPDATE BADGE
    ====================================================== */

    updateBadge() {

        if (!this.userId) return;

        const badge =
            document.getElementById(
                "notificationBadge"
            );

        if (!badge) return;

        const unreadCount =
            NotificationManager.getUnreadCount(
                this.userId
            );


        if (unreadCount <= 0) {

            badge.textContent = "";

            badge.classList.add("hidden");

            return;
        }


        /*
            Avoid huge numbers in the header.
        */

        badge.textContent =
            unreadCount > 99
                ? "99+"
                : unreadCount;


        badge.classList.remove("hidden");
    },


    /* ======================================================
                    RENDER NOTIFICATIONS
    ====================================================== */

    renderNotifications() {

        const container =
            document.getElementById(
                "notificationList"
            );

        if (!container) {

            console.error(
                "[NotificationUI] notificationList not found."
            );

            return;
        }


        const notifications =
            NotificationManager.getNotifications(
                this.userId
            );


        /*
            Empty notification state.
        */

        if (notifications.length === 0) {

            container.innerHTML = `
                <div class="notification-empty">

                    <div class="notification-empty-icon">
                        <i class="fa-regular fa-bell"></i>
                    </div>

                    <h3>No notifications</h3>

                    <p>
                        Your financial updates will
                        appear here.
                    </p>

                </div>
            `;

            return;
        }


        container.innerHTML =
            notifications
                .map(
                    notification =>
                        this.createNotificationHTML(
                            notification
                        )
                )
                .join("");


        this.bindNotificationActions();
    },


    /* ======================================================
                CREATE NOTIFICATION HTML
    ====================================================== */

    createNotificationHTML(notification) {

        const unreadClass =
            notification.read
                ? ""
                : "notification-unread";


        const time =
            this.formatTime(
                notification.createdAt
            );


        return `
            <div
                class="notification-item ${unreadClass}"
                data-notification-id="${notification.id}"
            >

                <div class="notification-icon">

                    <i class="${notification.icon}"></i>

                </div>


                <div class="notification-content">

                    <div class="notification-title-row">

                        <h4>
                            ${this.escapeHTML(
                                notification.title
                            )}
                        </h4>

                        ${
                            !notification.read
                                ? `
                                    <span
                                        class="notification-unread-dot"
                                    ></span>
                                `
                                : ""
                        }

                    </div>


                    <p>
                        ${this.escapeHTML(
                            notification.message
                        )}
                    </p>


                    <span class="notification-time">

                        ${time}

                    </span>

                </div>


                <button
                    class="notification-delete"
                    data-delete-notification="${notification.id}"
                    aria-label="Delete notification"
                >

                    <i class="fa-solid fa-xmark"></i>

                </button>

            </div>
        `;
    },


    /* ======================================================
                    NOTIFICATION ACTIONS
    ====================================================== */

    bindNotificationActions() {

        /*
            Clicking notification marks it read.
        */

        document
            .querySelectorAll(
                ".notification-item"
            )
            .forEach(item => {

                item.addEventListener(
                    "click",
                    () => {

                        const notificationId =
                            item.dataset
                                .notificationId;

                        NotificationManager
                            .markAsRead(
                                this.userId,
                                notificationId
                            );
                    }
                );
            });


        /*
            Delete notification.
        */

        document
            .querySelectorAll(
                "[data-delete-notification]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.stopPropagation();

                        const notificationId =
                            button.dataset
                                .deleteNotification;


                        NotificationManager.delete(
                            this.userId,
                            notificationId
                        );
                    }
                );
            });
    },


    /* ======================================================
                    MARK ALL AS READ
    ====================================================== */

    markAllAsRead() {

        if (!this.userId) return;

        NotificationManager.markAllAsRead(
            this.userId
        );
    },


    /* ======================================================
                        CLEAR ALL
    ====================================================== */

    clearAll() {

        if (!this.userId) return;

        NotificationManager.clearAll(
            this.userId
        );
    },


    /* ======================================================
                        FORMAT TIME
    ====================================================== */

    formatTime(dateString) {

        if (!dateString) return "";

        const date =
            new Date(dateString);

        const now =
            new Date();

        const difference =
            now.getTime() -
            date.getTime();


        const seconds =
            Math.floor(
                difference / 1000
            );


        if (seconds < 60) {
            return "Just now";
        }


        const minutes =
            Math.floor(
                seconds / 60
            );


        if (minutes < 60) {

            return `${minutes} min ago`;
        }


        const hours =
            Math.floor(
                minutes / 60
            );


        if (hours < 24) {

            return `${hours}h ago`;
        }


        const days =
            Math.floor(
                hours / 24
            );


        if (days === 1) {
            return "Yesterday";
        }


        if (days < 7) {

            return `${days} days ago`;
        }


        return date.toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    },


    /* ======================================================
                        ESCAPE HTML
    ====================================================== */

    escapeHTML(value) {

        if (value === null ||
            value === undefined) {
            return "";
        }

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
};


export default NotificationUI;