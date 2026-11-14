import type { SlashCommand } from "@earendil-works/pi-tui";
import type { CommandDescriptor } from "@deepseek-ai/dsh-commands/types";

const localCommands: SlashCommand[] = [
  { name: "clear", description: "Clear the visible chat while keeping the current conversation" },
  { name: "resume", description: "Choose a saved conversation to resume" },
  { name: "cd", description: "Choose the session working directory" },
  { name: "permission", description: "Choose a dsh permission preset" },
  { name: "model", description: "Choose a provider and model while keeping conversation history" },
  {
    name: "file",
    argumentHint: "<path> | clear",
    description: "Attach a file or image to the next message, or clear attachments",
  },
  {
    name: "dsh",
    argumentHint: "<command> [args]",
    description: "Run a native dsh command, bypassing TUI command names",
  },
  {
    name: "effort",
    argumentHint: "[level | default]",
    description: "Choose reasoning effort from the current model's supported levels",
  },
  { name: "new", description: "Start a new conversation with the current model" },
  { name: "rename", argumentHint: "[title]", description: "Rename the current conversation" },
  { name: "fork", description: "Fork the current conversation from a completed turn" },
  { name: "archive", description: "Choose a conversation to archive" },
  { name: "restore", description: "Choose an archived conversation to restore" },
  { name: "pin", description: "Choose a conversation to pin" },
  { name: "unpin", description: "Choose a conversation to unpin" },
  { name: "ps", description: "List background jobs and inspect their output" },
  { name: "stop", description: "Choose a background job to stop" },
  { name: "session", description: "Show the current session ID for resuming later" },
  {
    name: "status",
    description: "Show model, session, usage, account limits, and dsh settings",
  },
  { name: "quit", description: "Shut down dsh and exit the TUI" },
];

const nativeCommands = [
  { name: "compact", description: "Summarize conversation history to free context space" },
  {
    name: "plan",
    argumentHint: "[off | message]",
    description: "Enter or leave plan mode, or send planning instructions",
  },
  {
    name: "goal",
    argumentHint: "[objective | clear | edit objective | pause | resume]",
    description: "Create, inspect, edit, pause, resume, or clear a goal",
  },
  {
    name: "permission",
    argumentHint: "[preset]",
    description: "Show current permissions and available presets, or select a preset",
  },
  {
    name: "feedback",
    argumentHint: "<text>",
    description: "Record feedback about the current conversation in dsh",
  },
  {
    name: "export",
    argumentHint: "[path.zip]",
    description:
      "Export the conversation, child sessions, and attachments as ZIP without overwriting",
  },
];

export function commandMenu(native?: readonly CommandDescriptor[]): SlashCommand[] {
  const commands =
    native?.map((command) => {
      const known = nativeCommands.find((item) => item.name === command.name);
      return {
        name: command.name,
        description:
          known?.description ?? (command.description.trim() || "Run a dsh plugin command"),
        argumentHint: known?.argumentHint ?? command.input?.hint,
      };
    }) ?? nativeCommands;
  return [
    ...new Map([...commands, ...localCommands].map((command) => [command.name, command])).values(),
  ];
}
