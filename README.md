# 🔌 MCP Nexus

> A comprehensive demonstration of Model Context Protocol (MCP) server with universal access capabilities

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.25.3-green)](https://modelcontextprotocol.io/)

## 🌟 Overview

**MCP Nexus** is a Next.js application that showcases a fully-featured Model Context Protocol (MCP) server implementation. The project demonstrates how to build an MCP server that can be accessed from multiple entry points, making it a versatile solution for integrating AI capabilities into your applications.

## ✨ Key Features

### 🔄 Universal Access

The primary strength of this project is its ability to provide MCP server access through **all possible channels**:

- **🌐 External Clients** - Connect from external tools like Cursor, Claude Desktop, or any MCP-compatible client
- **💻 Client-Side Access** - Use MCP tools directly from your Next.js client components
- **⚙️ Server-Side Access** - Leverage MCP capabilities in your Next.js API routes and server components

This multi-channel approach makes MCP Nexus a complete reference implementation for building production-ready MCP servers that can be integrated anywhere in your stack.

## 🚀 Live Demo

Try the public deployment here:  
👉 https://mcp-nexus-fgka.onrender.com/

- `/api/health-check` → should return `OK`
- MCP endpoints require `MCP_API_KEY` (see [Connecting external clients](#connecting-external-clients))

## 🚀 Getting Started

### Prerequisites

- **Node.js** 25 or higher
- **pnpm** 10 or higher

### Installation

```bash
pnpm install
```

### Environment Variables

Copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env` and adjust values:

```bash
# Server Configuration
NODE_ENV=development
HOST=localhost
PORT=4004
MCP_PORT=4005
NEXT_PUBLIC_MCP_PORT=4005
NEXT_PUBLIC_OPENAI_SECURITY_KEY=replace-with-your-key

# OpenAI credentials for GPT proxy (server-only — never NEXT_PUBLIC_*)
OPENAI_API_KEY=sk-...
OPENAI_PROJECT_KEY=proj_...

# MCP access control (required in production)
MCP_API_KEY=generate-a-long-random-secret

# Firebird (optional — enables Firebird MCP tools: search_tables, list_tables, describe_table, execute_sql)
ISC_USER=SYSDBA
ISC_PASSWORD=your_password
NODE_FB_HOST=localhost
NODE_FB_PORT=3050
NODE_FB_DB=D:/path/to/database.fdb
# FIREBIRD_MAX_ROWS=500
# FIREBIRD_QUERY_TIMEOUT_MS=30000
# FIREBIRD_SQL_DIALECT=2.5
```

Set `MCP_API_KEY` to a long random secret before deploying. In production the MCP server rejects unauthenticated requests. The web UI must verify this key in **Settings**; the BFF at `/api/mcp` forwards the client `Authorization` header and does not inject the key automatically.

Set `OPENAI_API_KEY` and optionally `OPENAI_PROJECT_KEY` in `.env` for chat; they are sent to the GPT proxy as `openai_api_key` and `project`. The proxy **security key** is entered per user in **Settings**.

The `.env` file is in `.gitignore`. Without Firebird variables the MCP server still starts; Firebird tools return a clear configuration error.

### Firebird native driver (Windows / local dev)

`node-firebird-driver-native` depends on a native addon (`node-firebird-native-api`). After `pnpm install`, if tools fail with **Could not locate the bindings file**:

1. Ensure [Firebird client](https://firebirdsql.org/) (`fbclient.dll`) is installed and on `PATH`.
2. Build the addon (requires Visual Studio Build Tools and Python for `node-gyp`):

```bash
pnpm firebird:build-native
```

If that does not produce `addon.node`, run manually inside the package:

```bash
cd node_modules/node-firebird-native-api
npm run gyp:configure
npm run gyp:build
```

Smoke test (read-only) against your `.env`:

```bash
# optional: use another project's .env without copying secrets into apps/web
$env:FIREBIRD_ENV_FILE="D:\git\gdmn-nxt\.env"   # PowerShell
pnpm firebird:smoke
```

### Development

Start the development environment (runs both Next.js app and MCP server):

```bash
pnpm dev
```

The application will be available at `http://{host}:{port}`, and the MCP server will be running in parallel on `MCP_PORT` (default `4005`).

The web UI connects to MCP through a **BFF route** at `/api/mcp` (`apps/web/app/api/mcp/route.ts`). After you verify your MCP key in Settings, the browser sends `Authorization: Bearer <key>` on each MCP request; the BFF validates it and forwards to the MCP server.


### Running Specific Components

```bash
# Run only the Next.js app
pnpm --filter web dev:next

# Run only the MCP server
pnpm --filter web dev
```

### Cleanup

Remove all `node_modules` and cache files:

```bash
pnpm clean
```

This will remove:
- All `node_modules` directories
- Turbo cache (`.turbo`)
- Next.js build cache (`.next`)
- TypeScript build info (`.tsbuildinfo`)
- Build and dist directories

## Docker deployment

### Local build (development)

Build and run from source on your machine. Secrets come from `apps/web/.env` at **runtime** only (not baked into the image).

```bash
pnpm docker:s:up
pnpm docker:s:down
```

`.env` files are excluded from the Docker build context via `.dockerignore`. Do not pass `MCP_API_KEY`, Firebird credentials, or OpenAI keys as Docker build-args.

### CI: GitHub Actions → GHCR

On every push to `main` (and on version tags `v*`), [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) builds the image and pushes it to:

`ghcr.io/hirurg-lybitel/mcp-nexus`

Only `NEXT_PUBLIC_MCP_PORT` is passed at build time (not a secret). All sensitive values stay on the server.

#### Make the GHCR package private (recommended)

A public GitHub repo can still use a **private** container package:

1. Push to `main` once so the workflow creates the package.
2. Open **GitHub → your profile/org → Packages → mcp-nexus**.
3. **Package settings → Change visibility → Private**.

Only accounts with `read:packages` (or your org) can `docker pull` the image.

### Production on VPS

On the server, keep secrets outside the git repo:

```bash
sudo mkdir -p /opt/mcp-nexus
sudo nano /opt/mcp-nexus/.env          # copy from .env.example, fill production values
sudo chmod 600 /opt/mcp-nexus/.env
```

Create a GitHub Personal Access Token with `read:packages`, then log in to GHCR:

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Copy [`docker-compose.prod.yaml`](docker-compose.prod.yaml) to the server (or clone the repo without `.env`):

```bash
cd /opt/mcp-nexus
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml --env-file .env up -d
```

To update after a new push to `main`:

```bash
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml --env-file .env up -d
```

Ensure the VPS can reach your Firebird host (`NODE_FB_HOST`). A LAN IP will not work from a public server without VPN or a tunnel.

## 🛠️ API Endpoints

| Method | Path                        | Description                              | Response              |
|--------|-----------------------------|------------------------------------------|-----------------------|
| `GET`  | `/api/health-check`         | Checking application liveness            | `OK` (200)            |
| `*`    | `/api/mcp`                  | MCP BFF proxy (requires client Bearer token when `MCP_API_KEY` is set) | depends on request |

`/api/health-check` — a minimalistic route that always returns a status of 200 and the text "OK". 
Useful for:

- health checks in Docker / Kubernetes
- monitoring service availability
- checking that the Next.js application launched correctly

## Connecting external clients

Direct MCP access is at `http://localhost:4005/mcp` (or your host's `MCP_PORT`). **Authentication is required** when `MCP_API_KEY` is set.

### Cursor

Add to [`.cursor/mcp.json`](.cursor/mcp.json):

```json
{
  "mcpServers": {
    "local-mcp": {
      "url": "http://localhost:4005/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_API_KEY}"
      }
    }
  }
}
```

Set `MCP_API_KEY` in your environment (or Cursor env) to match `apps/web/.env`.

## Firebird MCP server (read-only, portable)

Exposed at `http://localhost:4005/mcp` — usable from Cursor, VS Code, or any MCP client. Requires `Authorization: Bearer <MCP_API_KEY>` when the key is configured.

| Tool | Description |
|------|-------------|
| `search_tables` | Search `AT_RELATIONS` by title / name (e.g. «групп товар») |
| `list_tables` | User tables (`RDB$RELATIONS` + titles from `AT_RELATIONS`) |
| `describe_table` | Columns + `refTable` for FK fields from `AT_FIELDS` / RDB$ |
| `execute_sql` | Read-only SQL; validates table names before run |

Database access lives in [`packages/db-firebird`](packages/db-firebird). MCP wiring: [`apps/web/lib/mcp/firebird-tools.ts`](apps/web/lib/mcp/firebird-tools.ts).

### Read-only guarantees

All SQL goes through a single executor ([`ReadQueryExecutor`](packages/db-firebird/src/infrastructure/read-query-executor.ts)) with defense in depth:

1. **SQL text guard** ([`assertReadOnlySql`](packages/db-firebird/src/infrastructure/read-only-sql-guard.ts)) — only `SELECT` / `WITH`; blocks `;`, DML/DDL keywords, `EXECUTE`, `GEN_ID`, `FOR UPDATE`, `INTO`.
2. **Dialect guard** ([`assertDialectCompatibleSql`](packages/db-firebird/src/infrastructure/firebird-sql-dialect-guard.ts)) — when `FIREBIRD_SQL_DIALECT=2.5` (default), blocks CTEs (`WITH`), window functions (`OVER`, `ROW_NUMBER`, …), and `RECURSIVE`. Set `FIREBIRD_SQL_DIALECT=3` on Firebird 3+ deployments to allow modern SQL. Mirror the same value in `NEXT_PUBLIC_FIREBIRD_SQL_DIALECT` so the chat system prompt matches server validation.
3. **Firebird transaction** — every query runs in `accessMode: 'READ_ONLY'`.
4. **Preflight on `execute_sql`** — table names validated against the schema; `SELECT *` blocked on tables with sensitive columns; row and timeout limits.

There is **no** runtime switch to allow writes (`FIREBIRD_ALLOW_WRITE` is not implemented).

| Attack vector | Blocked? |
|---------------|----------|
| `INSERT` / `UPDATE` / `DELETE` / `MERGE` | Yes (guard) |
| DDL / `EXECUTE BLOCK` | Yes (guard) |
| Multi-statement (`;`) | Yes (guard) |
| `GEN_ID`, `FOR UPDATE`, `SELECT … INTO` | Yes (guard) |
| Write tools on MCP | Yes (not registered) |

**Residual risks** (documented, not eliminated in code alone):

- **Selectable stored procedures** (`SELECT * FROM MY_PROC(...)`) may have side effects depending on procedure body; `READ_ONLY` transactions should reject data modifications but this is environment-specific.
- **Privileged DB user** — use a dedicated read-only Firebird user instead of `SYSDBA` in production (see `.env.example`).
- **Table-name preflight** does not parse quoted or schema-qualified identifiers; this affects discovery validation, not write access.

Verify locally:

```bash
pnpm --filter @mcp-nexus/db-firebird test
pnpm --filter @mcp-nexus/db-firebird test:integration   # needs Firebird in apps/web/.env
```

## MCP-Nexus web agent (host-only tools)

Registered in the Next.js chat (`GptFunctions`), not on the Firebird MCP server:

| Tool | Description |
|------|-------------|
| `create_query_plan` | Structured plan → To-dos UI |
| `present_query_result` | Final rows → chat table (uses `db-firebird` for AT_* labels when configured) |

Implementation: [`apps/web/lib/agent/`](apps/web/lib/agent/).

Cursor / external MCP clients: point to `http://localhost:4005/mcp` (see [`.cursor/mcp.json`](.cursor/mcp.json) `local-mcp`) — they get Firebird tools only; plan/present require the web assistant.

## 🛠️ Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Monorepo**: Turbo
- **Package Manager**: pnpm
- **MCP SDK**: @modelcontextprotocol/sdk
- **Database**: Firebird via `node-firebird-driver-native` (`@mcp-nexus/db-firebird`)

## 🎯 Use Cases

- **Learning MCP** - Understand how to implement MCP servers from scratch
- **Integration Reference** - See how to integrate MCP into Next.js applications
- **Multi-Channel Access** - Learn how to enable MCP access from client, server, and external tools
- **Development Template** - Use as a starting point for your own MCP-powered applications

## 📚 Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Turbo Documentation](https://turbo.build/repo/docs)

## 📄 License

This project is open source and available for educational and development purposes.

---

**Built with ❤️ to demonstrate the power of universal MCP access**
