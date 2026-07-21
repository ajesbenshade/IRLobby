# Neon Features

This page summarizes Neon's key platform features. Fetch the linked docs for full details.

## Branching

Branching creates instant, copy-on-write database clones at any point in time. Branches store only changes from the parent. Branches do not duplicate data.

- Branches are instant. No data copying occurs.
- Use branches for dev environments, staging, preview deployments, and testing migrations.
- Each branch can have its own compute endpoint.
- If the Neon MCP server is available, use it to list and create branches. Otherwise, use the CLI or Platform API.

[Branching docs](https://neon.com/docs/introduction/branching.md)

## Autoscaling

Compute scales automatically between configured min and max Compute Units (CUs). Scaling is based on CPU and memory pressure. No manual action is required.

[Autoscaling docs](https://neon.com/docs/introduction/autoscaling.md)

## Scale to Zero

Computes suspend after inactivity. The default inactivity period is 5 minutes. You can configure this period. The first query after suspend has a ~500ms cold start. Storage is always maintained.

[Scale to zero docs](https://neon.com/docs/introduction/scale-to-zero.md)

## Instant Restore

Instant restore provides point-in-time recovery without pre-configured backups. The restore window depends on your plan (7-30 days). You can create branches from any historical point. You can also use Time Travel queries.

[Instant restore docs](https://neon.com/docs/introduction/branch-restore.md)

## Read Replicas

Read replicas are read-only compute endpoints. They share storage with the primary. No data duplication occurs. Creation is instant. Each replica scales independently. Use read replicas for analytics, reporting, and read-heavy workloads.

[Read replicas docs](https://neon.com/docs/introduction/read-replicas.md)

## Connection Pooling

Neon has built-in PgBouncer. Enable pooling by adding `-pooler` to the endpoint hostname. Transaction mode is the default. Pooling supports up to 10,000 concurrent connections. Connection pooling is essential for serverless environments.

[Connection pooling docs](https://neon.com/docs/connect/connection-pooling.md)

## Neon Auth

Neon Auth is managed authentication. Auth state branches with your database. Neon Auth supports email, social providers (Google, GitHub), session management, and UI components.

For setup, see `neon-auth.md`. For auth + Data API, see `neon-js.md`.

[Neon Auth docs](https://neon.com/docs/auth/overview.md)

## IP Allow Lists

IP allow lists restrict database access to specific IP addresses or CIDR ranges. You can scope allow lists to protected branches only.

[IP Allow docs](https://neon.com/docs/introduction/ip-allow.md)

## Logical Replication

Logical replication replicates data to and from external Postgres databases. It uses native logical replication.

[Logical replication docs](https://neon.com/docs/guides/logical-replication-guide.md)
