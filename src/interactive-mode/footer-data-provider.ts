/**
 * Footer Data Provider
 *
 * Provides dynamic data for the footer component:
 * - Git branch detection
 * - Extension status registry
 * - CWD formatting
 * - Available provider count
 */
import { spawnSync } from "node:child_process";
import { resolve, relative, isAbsolute, sep } from "node:path";

/** Sanitize text for single-line status display */
function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/** Format token counts for compact display */
export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

/** Format CWD for footer display, replacing home with ~ */
export function formatCwdForFooter(cwd: string, home?: string): string {
  if (!home) return cwd;
  const resolvedCwd = resolve(cwd);
  const resolvedHome = resolve(home);
  const relativeToHome = relative(resolvedHome, resolvedCwd);
  const isInsideHome =
    relativeToHome === "" ||
    (relativeToHome !== ".." &&
      !relativeToHome.startsWith(`..${sep}`) &&
      !isAbsolute(relativeToHome));
  if (!isInsideHome) return cwd;
  return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

/** Data provider interface for footer */
export interface FooterDataProvider {
  getGitBranch(): string | undefined;
  getExtensionStatuses(): Map<string, string>;
  setExtensionStatus(key: string, text: string): void;
  clearExtensionStatuses(): void;
  getAvailableProviderCount(): number;
  setAvailableProviderCount(count: number): void;
  onBranchChange(callback: () => void): void;
  setCwd(cwd: string): void;
  getCwd(): string;
}

/**
 * Creates a footer data provider with git branch watching and extension status management.
 */
export function createFooterDataProvider(
  initialCwd: string,
  _getSessionName: () => string | undefined,
  _getModelRuntime: () => { getAvailableSnapshot(): any[]; getProviders(): any[] } | undefined,
): FooterDataProvider {
  let cwd = initialCwd;
  let gitBranch: string | undefined;
  let branchChangeCallbacks: (() => void)[] = [];
  const extensionStatuses = new Map<string, string>();
  let availableProviderCount = 0;
  let branchWatchInterval: ReturnType<typeof setInterval> | undefined;

  /** Update git branch and notify listeners */
  function updateGitBranch(): void {
    try {
      const result = spawnSync("git", ["branch", "--show-current"], {
        cwd,
        encoding: "utf-8",
        timeout: 1000,
      });
      const newBranch = result.stdout?.trim();
      if (newBranch && newBranch !== gitBranch) {
        gitBranch = newBranch;
        branchChangeCallbacks.forEach((cb) => cb());
      } else if (!newBranch && gitBranch) {
        gitBranch = undefined;
        branchChangeCallbacks.forEach((cb) => cb());
      }
    } catch {
      // Ignore git errors
    }
  }

  /** Start watching for git branch changes */
  function startBranchWatcher(): void {
    if (branchWatchInterval) return;
    updateGitBranch();
    branchWatchInterval = setInterval(updateGitBranch, 5000);
  }

  return {
    getGitBranch(): string | undefined {
      return gitBranch;
    },

    getExtensionStatuses(): Map<string, string> {
      return extensionStatuses;
    },

    setExtensionStatus(key: string, text: string): void {
      extensionStatuses.set(key, sanitizeStatusText(text));
    },

    clearExtensionStatuses(): void {
      extensionStatuses.clear();
    },

    getAvailableProviderCount(): number {
      return availableProviderCount;
    },

    setAvailableProviderCount(count: number): void {
      availableProviderCount = count;
    },

    onBranchChange(callback: () => void): void {
      branchChangeCallbacks.push(callback);
      if (branchChangeCallbacks.length === 1) {
        startBranchWatcher();
      }
    },

    setCwd(newCwd: string): void {
      cwd = newCwd;
      updateGitBranch();
    },

    getCwd(): string {
      return cwd;
    },
  };
}
