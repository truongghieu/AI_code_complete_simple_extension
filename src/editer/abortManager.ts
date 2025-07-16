/**
 * Manager for abort controllers used in lazy edit operations
 */
export class LazyEditAbortManager {
  private static instance: LazyEditAbortManager;
  private controllers: Map<string, AbortController>;

  private constructor() {
    this.controllers = new Map();
  }

  /**
   * Get the singleton instance of the abort manager
   * @returns The singleton instance
   */
  public static getInstance(): LazyEditAbortManager {
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
  public get(id: string): AbortController {
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
  public abort(id: string): void {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  /**
   * Clear all abort controllers
   */
  public clear(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}
