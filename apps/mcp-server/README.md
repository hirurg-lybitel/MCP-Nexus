# `@mcp-nexus/mcp-server`

MCP-сервер версии 2 для учётной системы Гедымин (Firebird). SDK `@modelcontextprotocol/server` 2.4, протоколы 2026-07-28 и 2025 (stateless).

## Запуск

Из корня worktree `D:\Git\MCP-Nexus-v2` (нужен `.env` с `ISC_*`, `NODE_FB_*`, `MCP_API_KEY`):

```bash
pnpm --filter @mcp-nexus/mcp-server start:http   # http://127.0.0.1:4005/mcp
pnpm --filter @mcp-nexus/mcp-server start:stdio  # для Cursor / Claude Desktop
```

Локальные стенды: `NODE_FB_HOST=localhost`, порт `3052` (FB 2.5, `CRM.FDB`) или `3055` (FB 5, `CRM_FB5.FDB`).

## Cursor (stdio)

В настройках MCP добавьте сервер (путь к `tsx` и проекту подставьте свои):

```json
{
  "mcpServers": {
    "mcp-nexus": {
      "command": "pnpm",
      "args": ["--filter", "@mcp-nexus/mcp-server", "start:stdio"],
      "cwd": "D:/Git/MCP-Nexus-v2",
      "env": {
        "NODE_FB_HOST": "localhost"
      }
    }
  }
}
```

Либо HTTP: URL `http://127.0.0.1:4005/mcp` и заголовок `Authorization: Bearer <MCP_API_KEY>`.

## Тулы (этап 0)

| Тул | Статус |
|---|---|
| `run_sql` | Работает (только чтение) |
| `get_trial_balance` | Заготовка до воркера (0.7–0.8) |
