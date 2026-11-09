# Agent Watch

A Claude Code mod that shows your subagents as little orange pixel bots in an **Agents** pane beside the chat.

- Each agent gets its own bot, with its own shade and hat (antenna, party hat, headphones, bow, sprout or crown).
- While an agent works, its bot bobs, walks, waves a claw and blinks. When the agent finishes, the bot smiles and gets a green check. If the agent fails, the bot gets X eyes.
- Under each card: how long the agent has run, how many tools it has used, and the tool it's on right now.
- The pane opens by itself when a subagent starts. Type `/agent-watch` to bring it back after closing it.

In the terminal, the pane shows a simple colored list.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install agent-watch --marketplace gitpkj/agent-watch
```

Answer `y` to add the marketplace, then press Enter to pick the user scope.

Or from a shell:

```bash
claude plugin install agent-watch --marketplace gitpkj/agent-watch
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `gitpkj/agent-watch`, then **Add plugin**.

The bots show up in sessions started after the install.

## Remove

```bash
claude plugin uninstall agent-watch
```
