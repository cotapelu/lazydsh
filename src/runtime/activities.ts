/**
 * Cancellable work owned by one Runtime instance.
 *
 * A runtime runs more than one request at a time: the user's turn plus any
 * concurrent probe the UI starts (`/status` opens a connection check while a
 * turn is streaming). Keeping them in a set means a probe cannot replace the
 * turn's controller — assigning a single field did, and after a mid-turn
 * `/status` the turn's request was no longer bound to `cancel()`/`close()`.
 */

export class ActivitySet {
  private readonly controllers = new Set<AbortController>();

  /** Track one unit of cancellable work; returns the controller for chaining. */
  add(controller: AbortController): AbortController {
    this.controllers.add(controller);
    return controller;
  }

  /** Stop tracking one unit of work (it finished or was discarded). */
  delete(controller: AbortController): void {
    this.controllers.delete(controller);
  }

  /** Abort every in-flight request this runtime started. */
  abortAll(): void {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  get size(): number {
    return this.controllers.size;
  }

  [Symbol.iterator]() {
    return this.controllers.values();
  }
}
