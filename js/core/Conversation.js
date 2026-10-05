/* ==========================================================================
   Conversation.js
   Handles conversation flow and temporary session state.
========================================================================== */

class Conversation {

    constructor() {

        this.session = {

            activeWorkspace: null,

            currentTopic: null,

            previousTopic: null,

            waitingFor: null,

            lastMessage: null,

            lastResponse: null

        };

    }

    async process(aiRequest) {

        aiRequest.conversation = {

            ...this.session

        };

        this.session.lastMessage = aiRequest.message;

        return aiRequest;

    }

    setTopic(topic) {

        this.session.previousTopic =
            this.session.currentTopic;

        this.session.currentTopic = topic;

    }

    setWaiting(field) {

        this.session.waitingFor = field;

    }

    clearWaiting() {

        this.session.waitingFor = null;

    }

    setWorkspace(workspaceId) {

        this.session.activeWorkspace =
            workspaceId;

    }

}

export default Conversation;