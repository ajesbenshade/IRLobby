# Plugin Guidelines

## Current Repository Structure

```text
.agents/skills/
  plugin-manager/
  skill-creator/

skills/
  neon-postgres/

plugins/
  neon-postgres/
    .claude-plugin/plugin.json
    .cursor-plugin/plugin.json
    skills/
      neon-postgres -> ../../../skills/neon-postgres
    mcp.json
    assets/logo.svg

.claude-plugin/marketplace.json
.cursor-plugin/marketplace.json
```

## Purpose of This Structure

- Plugin files are co-located per plugin. Ownership and boundaries are clear.
- Reusable skill content stays top-level in `skills/`. Plugins reuse it with a symlink.
- Each plugin can own its MCP configuration in `plugins/<plugin-name>/mcp.json`.
- Marketplace manifests stay centralized at repo root.

## Create an Additional Plugin

1. Create `plugins/<plugin-name>/` with:
   - `.claude-plugin/plugin.json`
   - `.cursor-plugin/plugin.json`
   - `skills/` directory
   - optional `assets/` directory
2. Add plugin-local MCP config:
   - `plugins/<plugin-name>/mcp.json`
3. Symlink required skills:
   - `plugins/<plugin-name>/skills/<skill-name> -> ../../../skills/<skill-name>`
4. Add the plugin to both marketplaces:
   - `.claude-plugin/marketplace.json`: `source: "./plugins/<plugin-name>"`
   - `.cursor-plugin/marketplace.json`: with `pluginRoot: "plugins"`, use `source: "<plugin-name>"`
5. Verify paths in both plugin manifests are plugin-local and relative:
   - `skills: "./skills/"`
   - `mcpServers: "./mcp.json"`
   - Cursor logo path, if used: `assets/logo.svg`

## Guardrails

- Do not duplicate shared skills into plugin folders. Always use a symlink.
- Do not reference paths outside plugin roots in manifest fields.
- Keep plugin names kebab-case. Keep names consistent between marketplace and plugin manifests.
- Keep Cursor marketplace `pluginRoot` and `source` consistent. This avoids double-prefix path resolution errors.
