import {
  Container,
  Markdown,
  ProcessTerminal,
  ScrollView,
  Text,
  TuiAltScreen,
  VStack,
  matchesKey,
} from "@earendil-works/pi-tui";
import { selectionTheme } from "../src/interactive-mode/picker.ts";
import {
  editorBorder,
  PromptEditor,
  SentMessage,
  StartupBanner,
  Transcript,
} from "../src/interactive-mode/presentation.ts";
import { dim } from "../src/interactive-mode/theme.ts";
import { ToolRow } from "../src/interactive-mode/tools.ts";
import { markdownTheme } from "../src/interactive-mode/ui.ts";

const tui = new TuiAltScreen(new ProcessTerminal(), false, undefined, {
  mouse: true,
  scrollToEndIndicator: () => dim("↓ latest"),
});
const transcript = new Transcript();
transcript.addChild(new SentMessage("Briefly explain the architecture of lazydsh."));
transcript.addChild(new ToolRow("✓ read src/ui.ts"));
transcript.addChild(new ToolRow("✓ read src/runtime.ts"));
transcript.addChild(
  new Markdown(
    "lazydsh is a standalone terminal UI for **DeepSeek Harness**.\n\n- **UI** — renders the chat and handles input using pi-tui.\n- **Runtime** — connects the UI to agents, sessions, tools, and providers.\n- **Boot** — starts the DeepSeek Harness services used by the app.",
    2,
    1,
    markdownTheme,
  ),
);
const editor = new PromptEditor(tui, {
  borderColor: editorBorder,
  selectList: { ...selectionTheme, noMatch: dim },
});
editor.setText("How are sessions managed?");
const status = new Text(dim("deepseek-official · deepseek-flash · ~/projects/lazydsh"), 2, 1);

const history = new Container();
history.addChild(new StartupBanner());
history.addChild(transcript);
const scroll = new ScrollView(history, { primary: true, follow: "end", scrollbar: "auto" });
const composer = new Container();
composer.addChild(editor);
composer.addChild(status);
tui.setLayoutRoot(
  new VStack([
    { component: scroll, basis: 0, grow: 1, minSize: 0 },
    { component: composer, shrink: 0 },
  ]),
);
tui.setFocus(editor);

const { promise: done, resolve: finish } = Promise.withResolvers<void>();
tui.addInputListener((data) => {
  if (matchesKey(data, "ctrl+c")) {
    finish();
    return { consume: true };
  }
});
process.once("SIGINT", finish);
process.once("SIGTERM", finish);
try {
  tui.start();
  await done;
} finally {
  tui.stop();
  process.off("SIGINT", finish);
  process.off("SIGTERM", finish);
}
