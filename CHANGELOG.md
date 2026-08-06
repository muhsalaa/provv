# Changelog

All notable changes to provv are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are [SemVer](https://semver.org/).

## [Unreleased]

## [1.4.0] - 2026-08-06

### Added
- Interactive install from a repo shows a checkbox picker: per-skill checkboxes plus an "All skills" header that selects/deselects the whole list (parsed from `npx skills add --list`, ANSI-safe).
- Interactive install groups skills by source repo (e.g. `mattpocock/skills`, `anthropics/skills`), with "My own skills" group shown only when own skills exist. Group header selects the whole repo.
- Batch install: installing 2+ skills from the same repo runs a single `npx skills add --all` instead of one call per skill.
- Install timing: final report shows the installed skill names and total elapsed time.

### Changed
- Install processing loop is silent — no per-skill "Done" spam. Failures are still reported individually.
- Final install report is one compact line: comma-separated names + total time.

### Fixed
- Installing a nonexistent skill (e.g. typo'd name) now fails clearly instead of reporting a false success.

## [1.3.2] - 2026-07-31

### Fixed
- Missing path guard when no path is provided.

## [1.3.1] - 2026-07-31

### Fixed
- Error handling when no path is provided.

## [1.3.0] - 2026-07-03

### Added
- `--global` flag for install to `~/.agents/skills/` for all agents.

### Changed
- Bundle dependencies for global install.

## [1.2.1] - 2026-06-26

### Added
- Allow install of all skills.

## [1.2.0] - 2026-06-07

### Added
- Hide already-installed skills from `provv install` list.

### Changed
- Read version from package.json, remove dead code.

## [1.1.1] - 2026-05-20

### Changed
- Don't commit learning notes to gitignore.

## [1.1.0] - 2026-05-19

### Added
- Allow install inside the master folder.
- Handle bare `npx skills add` (no `--skill`) install.

## [1.0.0] - 2026-05-17

### Added
- Initial release: init, install, unlink, delete, update, list, master commands.
- Central master folder with own skills (`skills/`) + skills.sh skills (`.agents/skills/`).
- Symlink-based linking into projects, git-exclude management, tracking file.
