/**
 * Compare two model objects for equality.
 * Ported from pi-ai's modelsAreEqual.
 */

export interface ModelInfo {
  provider: string;
  id: string;
  name?: string;
  [key: string]: any;
}

/**
 * Check if two model objects are equal (same provider and id).
 */
export function modelsAreEqual(a: ModelInfo | undefined, b: ModelInfo): boolean {
  return a !== undefined && a.provider === b.provider && a.id === b.id;
}
