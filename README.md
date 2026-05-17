# provv — Agent Skills Provision Manager

`provv` installs and manages AI agent skills from a central **master** folder into your projects. Works with any agent that reads `.agents/skills/` (pi, opencode, Claude Code, Cursor, etc.)

```bash
npm i -g @muhsalaa/provv
```

---

## Quick Start

```bash
# 1. Create a master folder (source of truth for all your skills)
mkdir ~/my-skills && cd ~/my-skills
provv init

# 2. Install a skill into your project
cd ~/code/my-project
provv install
```

First time? `provv install` will offer to create or point to a master automatically.

---

## Terminology

| Term | Meaning |
|---|---|
| **Master** | Central folder holding all your skills. Path stored in `~/.config/provv/config.json`. |
| **Own skill** | A skill directory inside `master/skills/`. Created by you, tracked in git. |
| **skills.sh skill** | A skill from the [skills.sh](https://skills.sh) ecosystem. Installed via `npx skills add`. |
| **Target / project** | Any directory with `.git`, `.agents`, `CLAUDE.md`, or `AGENTS.md`. |
| **Link / symlink** | `project/.agents/skills/<name>` → `master/.../<name>`. |

---

## Commands

### `provv init`

Scaffold current directory as a master folder.

```bash
mkdir ~/my-skills && cd ~/my-skills
provv init
```

| Action | Details |
|---|---|
| Creates `skills/` | Directory for your own skill folders |
| Creates / updates `.gitignore` | Adds `node_modules`, `.agents`, `provv-links.json`. Appends missing patterns if file already exists |
| Creates `skills-lock.json` | Empty lockfile for skills.sh skills |
| Migrates flat skills | Detects skill folders at root → prompts to move into `skills/` |
| Writes config | Saves master path to `~/.config/provv/config.json` |

**Detection:** Only flags "already a master" if configured in provv config OR `skills/` has actual skill folders. Just having `skills-lock.json` (from a project) is not enough to block.

---

### `provv install [skills...]`

Install skills to master and link to current project. The single entry point.

```bash
provv install                          # Interactive: pick skills
provv install caveman                  # Install a known skill directly
provv install npx skills add <url> --skill <name>  # Install new from skills.sh
```

| Step | What happens |
|---|---|
| No master? | **Auto-setup** — offers to init or point to existing master |
| Detect project | Checks cwd for `.git`, `.agents`, `CLAUDE.md`, `AGENTS.md`. Warns if missing. |
| Read master | Loads own skills from `skills/` and skills.sh skills from `skills-lock.json` |
| Pick skills | Multiselect from own + skills.sh + "Install from skills.sh..." option |
| Download (if needed) | Runs `npx skills add ... --copy -y` in master. Agent-specific dirs (`.pi/`, `.claude/`, etc.) are **auto-cleaned** afterwards — only `.agents/skills/` is kept |
| Symlink | Creates `project/.agents/skills/<name>` → `master/.../<name>` |
| Git exclude | Controlled by `gitExclude` config: `auto-ignore` (default, silent), `ask`, `never` |
| Track | Writes link to `provv-links.json` (gitignored — machine-local) |

**Installing from skills.sh:**

```bash
provv install npx skills add microsoft/azure-skills --skill azure-ai
```

Or via the interactive menu:

```bash
provv install
# → select "Install from skills.sh..."
# → paste the npx skills add command or type repo + skill name
```

---

### `provv unlink [skills...]`

Remove skill symlink(s) from current project without touching the master.

```bash
provv unlink               # Interactive: pick linked skills
provv unlink caveman       # Remove caveman symlink
```

Also cleans up `.git/info/exclude` and updates `provv-links.json`.

---

### `provv delete [skills...]`

Delete a skill from master entirely — removes files from master AND all linked symlinks across every project.

```bash
provv delete               # Interactive: pick skills to delete
provv delete caveman       # Delete caveman from master + all links
```

**Destructive.** Prompts for confirmation. Cleans:

| What | Where |
|---|---|
| Files | `master/skills/<name>` or `master/.agents/skills/<name>` |
| Symlinks | All paths tracked in `provv-links.json` for this skill |
| Lockfile | Removes entry from `skills-lock.json` |
| Tracking | Removes entry from `provv-links.json` |

---

### `provv update [skills...]`

Update skills.sh skills to latest versions in master.

```bash
provv update               # Interactive: pick skills to update
provv update caveman       # Update specific skill
```

Runs `npx skills update -y` in the master folder. Agent-specific dirs are auto-cleaned after update. Own skills are unaffected (they're git-tracked).

---

### `provv list`

Show all skills and their link status. Context-aware — changes based on where you run it.

**Inside a project dir:**

```
── Linked to this project ──
  ○ init-docs → linked here                 ← own skill, green
  ◆ grill-me [✓] → linked here              ← skills.sh synced, green

── Not linked here ──
  ○ add-docs → not linked                   ← own, dim
  ○ weekly-summary → linked elsewhere        ← own, linked to other project
  ◆ caveman [✓] → not linked                ← skills.sh synced, dim
  ◆ migrate-oxfmt [⇣] → not linked          ← skills.sh not synced, dim
  ◆ frontend-design [✓] → ⚠ symlink missing  ← broken, yellow
```

**Outside a project dir:**

```
── Available skills ──
  ○ add-docs → available
  ◆ grill-me [✓] → available
```

| Indicator | Meaning |
|---|---|
| `○` | Own skill (created by you, in `skills/`) |
| `◆` | skills.sh skill (from [skills.sh](https://skills.sh) ecosystem) |
| `[✓]` | Downloaded locally (synced) |
| `[⇣]` | In lockfile but not yet downloaded |
| `→ linked here` | Symlinked to current project (green) |
| `→ linked elsewhere` | Symlinked to other projects |
| `→ not linked` | Not symlinked anywhere (dimmed) |
| `→ ⚠ symlink missing` | Tracking says linked but file is gone (yellow, shows fix command) |
| `→ available` | Outside project context — ready to install |

---

### `provv master [action] [path]`

Show or change the master path.

```bash
provv master               # Show current master path
provv master set /path     # Point to existing master folder
provv master path          # Same as no args
```

---

## Project Structure

**Master folder (your source of truth):**

```
my-skills/
├── skills/                    # Your own skills (git-tracked)
│   ├── my-cool-skill/
│   │   ├── SKILL.md
│   │   └── CATALOG.md
│   └── another-skill/
├── .agents/skills/            # skills.sh downloads (gitignored)
├── skills-lock.json           # skills.sh manifest
├── provv-links.json           # Symlink targets per skill (gitignored)
├── .gitignore                 # node_modules, .agents, provv-links.json
├── package.json
└── README.md
```

**Project folder (after `provv install`):**

```
my-project/
├── .agents/skills/
│   ├── init-docs → ~/my-skills/skills/init-docs        # symlink
│   └── caveman → ~/my-skills/.agents/skills/caveman    # symlink
├── .git/info/exclude          # .agents/skills/* appended
└── ...rest of project
```

---

## Config

Saved to `~/.config/provv/config.json`:

```json
{
  "masterPath": "/home/you/my-skills",
  "gitExclude": "auto-ignore"
}
```

| Field | Default | Description |
|---|---|---|
| `masterPath` | — | Path to your master skills folder |
| `gitExclude` | `"auto-ignore"` | How to handle symlinks in git: `"auto-ignore"` (silent, default), `"never"` (keep tracked), `"ask"` (prompt each install) |

**Validation:** Unknown fields and invalid values are caught and warned to stderr. Falls back to defaults safely.

---

## Security

`.npmrc` enforces:

| Policy | Value | Effect |
|---|---|---|
| `min-release-age` | `7d` | Blocks packages published < 7 days ago (npm v11+) |
| `audit` | `true` | Fails on high/critical vulnerabilities |
| `fund` | `false` | No funding noise |

---

## Dependencies

| Package | Purpose |
|---|---|
| `@clack/prompts` | Interactive CLI prompts (multiselect, confirm, spinner) |
| `commander` | Command routing and argument parsing |
| `picocolors` | Terminal color output |
