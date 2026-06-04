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
- `/api/mcp/...` endpoints are available for MCP clients

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

# Firebird (optional — enables Firebird MCP tools: search_tables, list_tables, describe_table, execute_sql)
ISC_USER=SYSDBA
ISC_PASSWORD=your_password
NODE_FB_HOST=localhost
NODE_FB_PORT=3050
NODE_FB_DB=D:/path/to/database.fdb
# FIREBIRD_MAX_ROWS=500
# FIREBIRD_QUERY_TIMEOUT_MS=30000
```

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

The application will be available at `http://{host}:{port}`, and the MCP server will be running in parallel.
But there's a proxy trick to redirect all requests to `http://{host}:{port}/api/mcp` to local MCP server through `next.config.ts`:

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/mcp/:path*', 
      destination: `http://localhost:${mcp_port}/mcp/:path*`,
    },
  ];
}
```


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

## 🛠️ API Endpoints

| Method | Path                        | Description                              | Response              |
|--------|-----------------------------|------------------------------------------|-----------------------|
| `GET`  | `/api/health-check`         | Checking application liveness            | `OK` (200)            |
| `POST` | `/api/mcp/...`              | MCP Protocol endpoints (via rewrite)     | depends on request    |

`/api/health-check` — a minimalistic route that always returns a status of 200 and the text "OK". 
Useful for:

- health checks in Docker / Kubernetes
- monitoring service availability
- checking that the Next.js application launched correctly

## Firebird MCP server (read-only, portable)

Exposed at `http://localhost:4005/mcp` — usable from Cursor, VS Code, or any MCP client.

| Tool | Description |
|------|-------------|
| `search_tables` | Search `AT_RELATIONS` by title / name (e.g. «групп товар») |
| `list_tables` | User tables (`RDB$RELATIONS` + titles from `AT_RELATIONS`) |
| `describe_table` | Columns + `refTable` for FK fields from `AT_FIELDS` / RDB$ |
| `execute_sql` | Read-only SQL; validates table names before run |

Database access lives in [`packages/db-firebird`](packages/db-firebird). MCP wiring: [`apps/web/lib/mcp/firebird-tools.ts`](apps/web/lib/mcp/firebird-tools.ts).

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
