/* =====================================================
                NAVIGATION MANAGER
===================================================== */

class NavigationManager {
    constructor() {
        this.stack = [];
        window.addEventListener(
            "popstate",
            this.handleBack.bind(this)
        );

    }

    open(id, element) {
        if (!element) return;
        // Prevent duplicate entries
        const exists = this.stack.find(item => item.id === id);
        if (exists) return;
        element.classList.remove("hidden");
        this.stack.push({
            id,
            element
        });

        history.pushState(
            { modal: id },
            ""
        );
    }

    close(id) {
        const index = this.stack.findIndex(item => item.id === id);
        if (index === -1) return;
        this.stack[index].element.classList.add("hidden");
        this.stack.splice(index, 1);
    }

    closeTop() {
        if (this.stack.length === 0) return;
        const top = this.stack.pop();
        top.element.classList.add("hidden");
    }

    handleBack() {
        if (this.stack.length === 0) return;
        this.closeTop();
    }
}
const Navigation = new NavigationManager();