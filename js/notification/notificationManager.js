/* ==========================================================
                FINTACK NOTIFICATION ENGINE
========================================================== */

const NotificationManager = {

    /* ======================================================
                        STORAGE KEY
    ====================================================== */

    getStorageKey(userId) {
        return `fintack_notifications_${userId}`;
    },


    /* ======================================================
                    GET ALL NOTIFICATIONS
    ====================================================== */

    getNotifications(userId) {

        if (!userId) return [];

        try {

            const key = this.getStorageKey(userId);

            const stored =
                localStorage.getItem(key);

            if (!stored) return [];

            const notifications =
                JSON.parse(stored);

            return Array.isArray(notifications)
                ? notifications
                : [];

        } catch (error) {

            console.error(
                "[FinTack Notifications] Read Error:",
                error
            );

            return [];
        }
    },


    /* ======================================================
                    SAVE NOTIFICATIONS
    ====================================================== */

    saveNotifications(userId, notifications) {

        if (!userId) return false;

        try {

            const key =
                this.getStorageKey(userId);

            localStorage.setItem(
                key,
                JSON.stringify(notifications)
            );

            return true;

        } catch (error) {

            console.error(
                "[FinTack Notifications] Save Error:",
                error
            );

            return false;
        }
    },


    /* ======================================================
                    CREATE NOTIFICATION
    ====================================================== */

    create(userId, notification = {}) {

        if (!userId) return null;

        const notifications =
            this.getNotifications(userId);

        const newNotification = {

            id:
                "notification_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2, 9),

            type:
                notification.type || "general",

            title:
                notification.title ||
                "FinTack Notification",

            message:
                notification.message || "",

            icon:
                notification.icon ||
                "fa-solid fa-bell",

            read: false,

            createdAt:
                new Date().toISOString(),

            data:
                notification.data || {}
        };


        /*
            Newest notification appears first.
        */

        notifications.unshift(
            newNotification
        );


        /*
            Prevent localStorage from growing forever.

            Keep latest 100 notifications.
        */

        const trimmedNotifications =
            notifications.slice(0, 100);


        this.saveNotifications(
            userId,
            trimmedNotifications
        );


        /*
            Tell the UI that notifications changed.

            notificationUI.js will listen for this later.
        */

        window.dispatchEvent(
            new CustomEvent(
                "fintack:notifications-updated",
                {
                    detail: {
                        userId,
                        notification:
                            newNotification
                    }
                }
            )
        );


        console.log(
            "[FinTack Notification Created]",
            newNotification
        );


        return newNotification;
    },


    /* ======================================================
                    GET UNREAD COUNT
    ====================================================== */

    getUnreadCount(userId) {

        const notifications =
            this.getNotifications(userId);

        return notifications.filter(
            notification =>
                !notification.read
        ).length;
    },


    /* ======================================================
                    MARK ONE AS READ
    ====================================================== */

    markAsRead(userId, notificationId) {

        if (!userId || !notificationId)
            return false;

        const notifications =
            this.getNotifications(userId);

        const notification =
            notifications.find(
                item =>
                    item.id === notificationId
            );

        if (!notification)
            return false;


        notification.read = true;


        this.saveNotifications(
            userId,
            notifications
        );


        this.dispatchUpdate(userId);

        return true;
    },


    /* ======================================================
                    MARK ALL AS READ
    ====================================================== */

    markAllAsRead(userId) {

        if (!userId) return false;

        const notifications =
            this.getNotifications(userId);

        notifications.forEach(
            notification => {
                notification.read = true;
            }
        );


        this.saveNotifications(
            userId,
            notifications
        );


        this.dispatchUpdate(userId);

        return true;
    },


    /* ======================================================
                    DELETE NOTIFICATION
    ====================================================== */

    delete(userId, notificationId) {

        if (!userId || !notificationId)
            return false;

        let notifications =
            this.getNotifications(userId);


        notifications =
            notifications.filter(
                notification =>
                    notification.id !==
                    notificationId
            );


        this.saveNotifications(
            userId,
            notifications
        );


        this.dispatchUpdate(userId);

        return true;
    },


    /* ======================================================
                    CLEAR ALL
    ====================================================== */

    clearAll(userId) {

        if (!userId) return false;

        this.saveNotifications(
            userId,
            []
        );


        this.dispatchUpdate(userId);

        return true;
    },


    /* ======================================================
                    UPDATE EVENT
    ====================================================== */

    dispatchUpdate(userId) {

        window.dispatchEvent(
            new CustomEvent(
                "fintack:notifications-updated",
                {
                    detail: {
                        userId
                    }
                }
            )
        );
    }
};


export default NotificationManager;