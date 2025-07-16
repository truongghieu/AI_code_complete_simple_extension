"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyEditAbortManager = void 0;
/**
 * Manager for abort controllers used in lazy edit operations
 */
class LazyEditAbortManager {
    constructor() {
        this.controllers = new Map();
    }
    /**
     * Get the singleton instance of the abort manager
     * @returns The singleton instance
     */
    static getInstance() {
        if (!LazyEditAbortManager.instance) {
            LazyEditAbortManager.instance = new LazyEditAbortManager();
        }
        return LazyEditAbortManager.instance;
    }
    /**
     * Get an abort controller for the given ID
     * @param id The ID to get the abort controller for
     * @returns The abort controller
     */
    get(id) {
        let controller = this.controllers.get(id);
        if (!controller) {
            controller = new AbortController();
            this.controllers.set(id, controller);
        }
        return controller;
    }
    /**
     * Abort the operation with the given ID
     * @param id The ID of the operation to abort
     */
    abort(id) {
        const controller = this.controllers.get(id);
        if (controller) {
            controller.abort();
            this.controllers.delete(id);
        }
    }
    /**
     * Clear all abort controllers
     */
    clear() {
        this.controllers.forEach((controller) => controller.abort());
        this.controllers.clear();
    }
}
exports.LazyEditAbortManager = LazyEditAbortManager;
//# sourceMappingURL=abortManager.js.map