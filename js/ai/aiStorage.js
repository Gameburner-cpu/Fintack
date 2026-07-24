/* ==========================================================================
   aiStorage.js
   Handles AI Chat Storage API
========================================================================== */

const AI_API = "https://fintack.onrender.com/api/ai";

const AIStorage = {

    async createChat(userId, title = "New Chat") {

        const response = await fetch(`${AI_API}/chats`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                user_id: userId,

                title

            })

        });

        return await response.json();

    },

    async getChats(userId) {

        const response = await fetch(

            `${AI_API}/chats?user_id=${userId}`

        );

        return await response.json();

    },

    async getMessages(chatId) {

        const response = await fetch(

            `${AI_API}/chats/${chatId}/messages`

        );

        return await response.json();

    },

    async saveMessage(chatId, role, message) {

        const response = await fetch(

            `${AI_API}/chats/${chatId}/messages`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    role,

                    message

                })

            }

        );

        return await response.json();

    },

    async deleteChat(chatId) {

        const response = await fetch(

            `${AI_API}/chats/${chatId}`,

            {

                method: "DELETE"

            }

        );

        return await response.json();

    }

};

export default AIStorage;