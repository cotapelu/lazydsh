# Extension API Design (Draft)

## Overview

lazydsh's extension system is intentionally minimal (72-line widget registry).
This document outlines a design for a full extension API, inspired by
pi-coding-agent's extension system.

## Current State

- `ExtensionWidgetRegistry` — registers widgets with `id`, `name`, `component`, `position`, `priority`, `status()`
- `createExtensionWidgetContainer` — creates a container for widgets at a position
- `extensionWidgets` — global singleton instance

## Proposed API

### Extension Types

```typescript
interface Extension {
  name: string;
  version: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
```

### Extension Context

```typescript
interface ExtensionContext {
  ui: ExtensionUIContext;
  session: ExtensionSessionContext;
  tools: ExtensionToolsContext;
  resources: ExtensionResourcesContext;
  settings: ExtensionSettingsContext;
}
```

### Extension UI Context

```typescript
interface ExtensionUIContext {
  select(title: string, options: string[], opts?: SelectOptions): Promise<string | undefined>;
  confirm(title: string, message: string, opts?: ConfirmOptions): Promise<boolean>;
  input(title: string, placeholder?: string, opts?: InputOptions): Promise<string | undefined>;
  editor(title: string, prefill?: string): Promise<string | undefined>;
  custom(factory: CustomFactory, options?: CustomOptions): Promise<any>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string | undefined): void;
  setWorkingMessage(message: string | undefined): void;
  setWorkingVisible(visible: boolean): void;
  setWidget(key: string, content: string[] | ComponentFactory, options?: WidgetOptions): void;
  setFooter(factory: FooterFactory | undefined): void;
  setHeader(factory: HeaderFactory | undefined): void;
  setEditorText(text: string): void;
  getEditorText(): string;
  setEditorComponent(factory: EditorFactory | undefined): void;
  setTitle(title: string): void;
  addAutocompleteProvider(factory: AutocompleteProviderFactory): void;
}
```

### Extension Session Context

```typescript
interface ExtensionSessionContext {
  cwd: string;
  model: Model;
  scopedModels: ScopedModel[];
  thinkingLevel: string;
  isIdle(): boolean;
  waitForIdle(): Promise<void>;
  newSession(options?: NewSessionOptions): Promise<NewSessionResult>;
  fork(entryId: string, options?: ForkOptions): Promise<ForkResult>;
  switchSession(sessionPath: string, options?: SwitchSessionOptions): Promise<SwitchSessionResult>;
  compact(options?: CompactOptions): Promise<CompactResult>;
  getContextUsage(): ContextUsage | undefined;
  getSystemPrompt(): string;
  getSteeringMessages(): string[];
  getFollowUpMessages(): string[];
  steer(text: string): void;
  followUp(text: string): void;
  prompt(text: string, options?: PromptOptions): Promise<void>;
  abort(): void;
  executeBash(
    command: string,
    onChunk: (chunk: string) => void,
    options?: BashOptions,
  ): Promise<BashResult>;
}
```

### Extension Tools Context

```typescript
interface ExtensionToolsContext {
  getToolDefinition(name: string): ToolDefinition | undefined;
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): void;
}
```

### Extension Resources Context

```typescript
interface ExtensionResourcesContext {
  getSkills(): Skill[];
  getPrompts(): Prompt[];
  getThemes(): Theme[];
  getExtensions(): Extension[];
}
```

### Extension Settings Context

```typescript
interface ExtensionSettingsContext {
  get(key: string): any;
  set(key: string, value: any): void;
  getGlobalSettings(): Record<string, any>;
  getProjectSettings(): Record<string, any>;
}
```

### Extension Manifest

```typescript
interface ExtensionManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  contributes?: {
    commands?: CommandContribution[];
    tools?: ToolContribution[];
    shortcuts?: ShortcutContribution[];
    resources?: ResourceContribution[];
  };
}
```

### Implementation Plan

1. **Phase 1**: Define ExtensionContext interface and basic UI context
2. **Phase 2**: Implement extension loading (manifest parsing, module loading)
3. **Phase 3**: Implement extension dialogs (select, confirm, input, editor, custom)
4. **Phase 4**: Implement extension widgets (above/below editor)
5. **Phase 5**: Implement extension shortcuts and commands
6. **Phase 6**: Implement extension tools and resources
7. **Phase 7**: Implement extension settings and persistence

### Current Status

- Phase 0: Widget registry only (72 lines)
- Phases 1-7: Not started (intentionally out of scope)

### References

- pi-coding-agent: `modes/interactive/interactive-mode.js` (ExtensionUIContext)
- lazydsh: `interactive-mode/extensions.ts` (current widget registry)
- DSH: `@deepseek-ai/dsh-tools` (tool definitions with presentCall/presentResult)
