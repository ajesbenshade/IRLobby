---
name: plugin-manager
description: Manage plugin structure and configuration for this repository in Cursor and Claude Code. Use when you create, update, or review plugin folders under plugins/, wire marketplace manifests, set up skill symlinks, assign per-plugin mcp.json files, or add plugins while you keep repo conventions.
---

# Plugin Manager

Maintain plugin packaging for both ecosystems in one repository. Use a shared `plugins/` directory and a shared top-level `skills/` source of truth.

## Working Rules

- Keep each plugin self-contained in `plugins/<plugin-name>/`.
- Keep shared reusable skill content in top-level `skills/`.
- Expose shared skills per plugin with symlinks in `plugins/<plugin-name>/skills/`.
- Keep MCP config plugin-local at `plugins/<plugin-name>/mcp.json`.
- Keep both marketplace manifests at repo root:
  - `.claude-plugin/marketplace.json`
  - `.cursor-plugin/marketplace.json`

## Required Plugin Layout

For every plugin, verify this layout exists:

```text
plugins/<plugin-name>/
  .claude-plugin/plugin.json
  .cursor-plugin/plugin.json
  skills/
    <skill-name> -> ../../../skills/<skill-name>   # symlink
  mcp.json
  assets/
```

## Create or Update a Plugin

1. Create `plugins/<plugin-name>/`.
2. Add both manifests:
   - `plugins/<plugin-name>/.claude-plugin/plugin.json`
   - `plugins/<plugin-name>/.cursor-plugin/plugin.json`
3. Add or update `plugins/<plugin-name>/mcp.json` for plugin-specific MCP servers.
4. Symlink required top-level skills into `plugins/<plugin-name>/skills/`.
5. Add `plugins/<plugin-name>/assets/logo.svg` for Cursor.
6. Register the plugin in both marketplaces. Use `source: "./plugins/<plugin-name>"`.
7. Validate JSON and path references before you finish.

## Manifest Guidelines

- **Claude plugin manifest**
  - Path: `plugins/<plugin-name>/.claude-plugin/plugin.json`
  - Use plugin-local relative paths. For example:
    - `"skills": "./skills/"`
    - `"mcpServers": "./mcp.json"`
- **Cursor plugin manifest**
  - Path: `plugins/<plugin-name>/.cursor-plugin/plugin.json`
  - Use plugin-local relative paths. For example:
    - `"skills": "./skills/"`
    - `"mcpServers": "./mcp.json"`
    - `"logo": "assets/logo.svg"`
- **Marketplace manifests**
  - `.claude-plugin/marketplace.json` uses `source: "./plugins/<plugin-name>"`.
  - `.cursor-plugin/marketplace.json` uses `metadata.pluginRoot: "plugins"` and plugin entries with `source: "<plugin-name>"`.

## References

- For detailed examples and checklists, read `references/plugin-guidelines.md`.
