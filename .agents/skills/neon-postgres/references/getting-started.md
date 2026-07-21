# Getting Started with Neon

This is an interactive guide for setting up a Neon project and connecting it to code.

See the [official getting started guide](https://neon.com/docs/get-started/signing-up.md) for complete details.

## Setup Flow

### 1. Select Organization and Project

- Check existing organizations and projects (via MCP server or CLI).
- **1 organization**: Use it as the default.
- **Multiple organizations**: List all and ask which to use.
- **No projects**: Ask if the user wants to create a new project.
- **1 project**: Ask "Would you like to use '{project_name}' or create a new one?"
- **Multiple projects (<6)**: List all and let the user choose.
- **Many projects (6+)**: List recent projects. Offer to create a new project or specify by name or ID.

### 2. Get Connection String

- Use the MCP server or CLI to get the connection string.
- Store it in `.env` as `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:password@host/database
```

**Before you modify `.env`:**

1. Read the `.env` file first.
2. If the file is readable: use search/replace to update or append `DATABASE_URL`.
3. If the file is unreadable (permissions): use an append command or show the line to add manually.
4. Never overwrite an existing `.env`. Always append or update in place.

### 3. Install Driver

Choose a driver based on deployment platform. For detailed guidance, see `connection-methods.md`.

| Environment              | Driver                     | Install                                |
| ------------------------ | -------------------------- | -------------------------------------- |
| Edge/Serverless platforms | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Cloudflare Workers       | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| AWS Lambda               | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Traditional Node.js      | `pg`                       | `npm install pg`                       |
| Long-running servers     | `pg` with pooling          | `npm install pg`                       |

For serverless driver patterns, see `neon-serverless.md`. For complex scenarios (multiple runtimes, hybrid architectures), see `connection-methods.md`.

### 4. Authentication (if needed)

Skip this step for CLI tools, scripts, or apps without user accounts.

If the app needs auth: use the MCP server `provision_neon_auth` tool. Then see `neon-auth.md` for setup. For auth and database queries, see `neon-js.md`.

### 5. ORM Setup (optional)

Check for an existing ORM (Prisma, Drizzle, TypeORM). If none exists, ask if the user wants one. For Drizzle integration, see `neon-drizzle.md`.

### 6. Schema Setup

- Check for existing migration files or ORM schemas.
- If none exist: offer to create an example schema or design one together.

### 7. Developer Tools

```bash
npx neon init
```

This installs the VSCode extension and configures the MCP server. See `devtools.md` for details.

## What's Next

After setup is complete, offer to help with:

- Neon-specific features (branching, autoscaling, scale-to-zero) — see `features.md`
- Connection pooling for production
- Writing queries or building API endpoints
- Database migrations and schema changes
- Performance optimization

## Resume Support

If the user says "Continue with Neon setup", check what is already configured:

- MCP server connection
- `.env` file with `DATABASE_URL`
- Dependencies installed
- Schema created

Then resume from where they left off.

## Security Reminders

- Never commit connection strings to version control.
- Use environment variables for all credentials.
- Prefer SSL connections (default in Neon).
- Use least-privilege database roles.
- Rotate API keys and passwords regularly.

## Documentation

| Topic              | URL                                                   |
| ------------------ | ----------------------------------------------------- |
| Getting Started    | https://neon.com/docs/get-started/signing-up.md       |
| Connecting to Neon | https://neon.com/docs/connect/connect-intro.md        |
| Connection String  | https://neon.com/docs/connect/connect-from-any-app.md |
| Frameworks Guide   | https://neon.com/docs/get-started/frameworks.md       |
| ORMs Guide         | https://neon.com/docs/get-started/orms.md             |
| VSCode Extension   | https://neon.com/docs/local/vscode-extension.md       |
| MCP Server         | https://neon.com/docs/ai/neon-mcp-server.md           |
