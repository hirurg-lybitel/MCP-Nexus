# `@mcp-nexus/web` — тестовый чат

Тестовый стенд (D5 / 2.10): **чистый MCP-клиент** к `apps/mcp-server` (v2). Свой встроенный MCP с demo/Firebird-тулами по умолчанию **выключен**.

## Запуск

1. Подними MCP v2 (порт 4005):

```bash
pnpm --filter @mcp-nexus/mcp-server start:http
```

2. В `.env` тот же `MCP_API_KEY`, что у mcp-server. Опционально:

| Переменная | Смысл |
|---|---|
| `MCP_UPSTREAM_URL` | По умолчанию `http://127.0.0.1:4005/mcp` |
| `MCP_PORT` | Порт upstream, если URL не задан |
| `WEB_EMBEDDED_MCP=1` | Легаси: встроенный Firebird MCP в web (не для пилота v2) |

3. Web:

```bash
pnpm --filter web dev
```

Чат: BFF `/api/mcp` → upstream; system prompt берёт `initialize.instructions` с сервера; host-тулы UI — `create_query_plan` / `present_query_result`.
