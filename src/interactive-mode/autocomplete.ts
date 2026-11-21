import {
  CombinedAutocompleteProvider,
  type AutocompleteItem,
  type SlashCommand,
} from "@earendil-works/pi-tui";
import { activeAtToken } from "@deepseek-ai/dsh-file-reference/grammar";

export class Autocomplete extends CombinedAutocompleteProvider {
  triggerCharacters = ["@", "/"];
  private readonly references: (query: string, signal: AbortSignal) => Promise<AutocompleteItem[]>;
  constructor(
    commands: SlashCommand[],
    cwd: string,
    references: (query: string, signal: AbortSignal) => Promise<AutocompleteItem[]>,
  ) {
    super(commands, cwd);
    this.references = references;
  }
  override async getSuggestions(
    ...args: Parameters<CombinedAutocompleteProvider["getSuggestions"]>
  ) {
    const [lines, line, col, options] = args;
    const token = activeAtToken(lines[line] ?? "", col);
    if (!token) return super.getSuggestions(...args);
    const items = await this.references(token.query, options.signal);
    return options.signal.aborted || !items.length ? null : { items, prefix: token.prefix };
  }
}
