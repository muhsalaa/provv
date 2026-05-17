# provv — Agent Skills Provision Manager

`provv` installs, links, and manages AI agent skills from a central **master** folder into your projects. Works with any agent that reads `.agents/skills/` (pi, opencode, Claude Code, Cursor, etc.)

```bash
npm i -g provv
```

---

## Quick Start

```bash
# 1. Create a master folder (source of truth for all your skills)
mkdir ~/my-skills && cd ~/my-skills
provv init

# 2. Point provv to it (or provv init does this automatically)
provv master set ~/my-skills

# 3. Install + link a skill to your project
cd ~/code/my-project
provv install
```

---

## Terminology

| Term | Meaning |
|---|---|
| **Master** | Central folder holding all your skills. Path stored in `~/.config/provv/config.json`. |
| **Own skill** | A skill directory inside `master/skills/`. Created by you, tracked in git. |
| **skills.sh skill** | A skill from the [skills.sh](https://skills.sh) ecosystem. Installed via `npx skills add` into `master/.agents/skills/`. |
| **Target / project** | Any directory with `.git`, `.agents`, `CLAUDE.md`, or `AGENTS.md` — where skills get symlinked. |
| **Link** | A symlink from `project/.agents/skills/<name>` → `master/skills/<name>` or `master/.agents/skills/<name>`. |

---

## Commands

### `provv init`

Scaffold current directory as a master folder. Creates directory structure, lockfiles, and gitignore.

```bash
mkdir ~/my-skills && cd ~/my-skills
provv init
```

**What it does:**

| Action | Details |
|---|---|
| Creates `skills/` | Directory for your own skill folders |
| Creates `.gitignore` | Ignores `node_modules` and `.agents` |
| Creates `skills-lock.json` | Empty lockfile for skills.sh skills |
| Migrates flat skills | Detects skill folders at root → prompts to move into `skills/` |
| Writes config | Saves master path to `~/.config/provv/config.json` |

---

### `provv install [skills...]`

Install skills to master and link to current project. The main workflow.

```bash
provv install                  # Interactive: pick skills, install, link
provv install caveman          # Skip picker, install caveman directly
```

**Flow:**

| Step | What happens |
|---|---|
| Detect project | Checks cwd for `.git`, `.agents`, `CLAUDE.md`, `AGENTS.md`. Warns if missing. |
| Read master | Loads own skills from `skills/` and skills.sh skills from `skills-lock.json` |
| Pick skills | Multiselect from own + skills.sh + "Install from skills.sh..." option |
| Download (if needed) | For skills.sh skills without files, runs `npx skills add ... --copy -y` in master |
| Symlink | Creates `project/.agents/skills/<name>` → `master/.../<name>` |
| Git exclude | Prompts to add `.agents/skills/<name>` to `.git/info/exclude` (default: yes) |
| Track | Writes link to `provv-links.json` for future cleanup |

**Installing from skills.sh:**

```bash
provv install
# → select "Install from skills.sh..."
# → paste: npx skills add microsoft/azure-skills --skill azure-ai
# → or type repo URL + skill name separately
# → downloads to master → prompts to link → done
```

---

### `provv link [skills...]`

Symlink an already-installed skill to current project (no download).

```bash
provv link                     # Interactive: pick from available skills
provv link caveman             # Link caveman directly
```

Only skills with actual files on disk are shown. skills.sh skills that haven't been synced are excluded (install them first).

---

### `provv unlink [skills...]`

Remove skill symlink(s) from current project.

```bash
provv unlink                   # Interactive: pick linked skills to remove
provv unlink caveman           # Remove caveman symlink
```

Also cleans up `.git/info/exclude` and removes the project from `provv-links.json`. Does NOT touch the master.

---

### `provv delete [skills...]`

Delete a skill from master entirely. Removes files from master AND all linked symlinks across all projects.

```bash
provv delete                   # Interactive: pick skills to delete
provv delete caveman           # Delete caveman from master + all links
```

**This is destructive.** Prompts for confirmation before proceeding. Cleans:

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
provv update                   # Interactive: pick skills to update
provv update caveman           # Update specific skill
```

Runs `npx skills update -y` in the master folder. Own skills are not affected (they're git-tracked in your master repo).

---

### `provv list`

Show all skills and their link status.

```bash
provv list
```

**Output format:**

```
── Your Skills ──
  init-docs → not linked
  add-docs → linked           ← green when linked
  weekly-summary → not linked

── skills.sh ──
  caveman [⇣] → not linked
  grill-me [✓] → linked       ← green when linked
```

| Indicator | Meaning |
|---|---|
| `[✓]` | Downloaded locally (synced) |
| `[⇣]` | In lockfile but not downloaded (run install) |
| `→ linked` | Symlinked to current project (green) |
| `→ not linked` | Not symlinked anywhere (dimmed) |

---

### `provv master [action] [path]`

Show or change the master path.

```bash
provv master                   # Show current master path
provv master set /path         # Point to an existing master folder
provv master path              # Same as no args
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
├── provv-links.json            # Symlink targets per skill
├── .gitignore                 # node_modules, .agents
├── package.json
└── README.md
```

**Project folder (after linking a skill):**

```
my-project/
├── .agents/skills/
│   ├── init-docs → ~/my-skills/skills/init-docs       # symlink
│   └── caveman → ~/my-skills/.agents/skills/caveman   # symlink
├── .git/info/exclude          # .agents/skills/* appended
└── ...rest of project
```

---

## Config

Saved to `~/.config/provv/config.json`:

```json
{
  "masterPath": "/home/you/my-skills"
}
```

Generated by `provv init` or `provv master set`.

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
