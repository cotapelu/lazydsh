/**
 * ESM resolve hook for source-mode Node runs (test drivers).
 *
 * The TypeScript sources import siblings by their built `.js` name (the
 * NodeNext convention). Node strips types but does not rewrite specifiers, so
 * a source-mode `node driver.mjs` cannot resolve them. This hook retries a
 * failing `./x.js` import as `./x.ts`, which Node natively type-strips.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
