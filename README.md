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

Create a `.env` file in the apps/web directory to configure the application:

```bash
# Server Configuration
NODE_ENV=development                    # Environment mode
HOSTNAME=localhost                      # Server hostname (default: localhost)
PORT=4004                               # Next.js server port (default: 4004)
NEXT_PUBLIC_MCP_PORT=4005               # MCP server port (default: 4005)
NEXT_PUBLIC_OPENAI_SECURITY_KEY=123     # OpenAI security key (replace with your own key)
```

The `.env` file is already included in `.gitignore` and won't be committed to the repository. Make sure to create your own `.env` file based on your needs.

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
```

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

## 📦 Project Structure

## 🛠️ Tech Stack

- **Framework**: Next.js 25
- **Language**: TypeScript
- **Monorepo**: Turbo
- **Package Manager**: pnpm
- **MCP SDK**: @modelcontextprotocol/sdk

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
