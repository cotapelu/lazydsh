/**
 * ANSI escape sequence utilities.
 * Ported from pi-coding-agent's ansi.js
 */

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Strip ANSI escape sequences from a string.
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

/**
 * Strip ANSI escape sequences from a string, but preserve SGR (color) codes.
 * Useful for passing styled text to components that handle their own styling.
 */
export function stripAnsiExceptSgr(text: string): string {
  // Match all ANSI sequences except SGR (which end with 'm')
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[^m]/g, "");
}
