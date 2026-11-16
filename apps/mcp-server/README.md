# `@mcp-nexus/mcp-server`

MCP-сервер версии 2 для учётной системы Гедымин (Firebird). SDK `@modelcontextprotocol/server` 2.4, протоколы 2026-07-28 и 2025 (stateless).

## Запуск

Из корня worktree `D:\Git\MCP-Nexus-v2` (нужен `.env`):

```bash
pnpm --filter @mcp-nexus/mcp-server start:http   # http://127.0.0.1:4005/mcp
pnpm --filter @mcp-nexus/mcp-server start:stdio  # для Cursor / Claude Desktop
```

### Обязательные переменные

| Переменная | stdio | HTTP |
|---|---|---|
| `NODE_FB_HOST`, `NODE_FB_PORT`, `NODE_FB_DB` | да | да |
| `ISC_USER`, `ISC_PASSWORD` | да | да |
| `MCP_API_KEY` | нет | **да** (Bearer) |
| `GEDEMIN_WORKER_USER`, `GEDEMIN_WORKER_PASSWORD` | для отчётных тулов | то же |
| `GEDEMIN_WORKER_POOL_SIZE` / `GEDEMIN_WORKER_URLS` | пул 1–4 воркеров (2.4) | то же |

При старте сервер проверяет Firebird-конфиг и (если заданы) логин воркера через `GET /test` Гедымина. Пароль в логи не пишется. Если воркер недоступен — предупреждение в stderr, SQL-тулы продолжают работать.

HTTP без `MCP_API_KEY` не стартует. Неверный ключ → `401`; после серии неудач с одного IP → `429` (`MCP_AUTH_MAX_FAILURES` / `MCP_AUTH_WINDOW_MS` / `MCP_AUTH_LOCKOUT_MS`).

### Аудит вызовов

Каждый `tools/call` пишет строку JSONL: пользователь, тул, параметры (секреты → `[redacted]`), SQL для `run_sql`, `durationMs`, `rowCount`, `ok` / `errorCode`.

| Переменная | Смысл |
|---|---|
| `MCP_AUDIT_LOG` | Путь к файлу (по умолчанию `logs/mcp-audit.jsonl`) |
| `MCP_AUDIT=0` | Отключить аудит |
| `MCP_AUDIT_STDERR=1` | Дублировать запись в stderr |

Локальные стенды: порт `3055` (FB 5). OAuth 2.1 — только при выносе в облако (не в локальном режиме).

## Cursor (stdio)

В `.cursor/mcp.json` или настройках MCP:

```json
{
  "mcpServers": {
    "mcp-nexus": {
      "command": "node",
      "args": [
        "D:/Git/MCP-Nexus-v2/apps/mcp-server/node_modules/tsx/dist/cli.mjs",
        "D:/Git/MCP-Nexus-v2/apps/mcp-server/src/index.ts",
        "stdio"
      ],
      "cwd": "D:/Git/MCP-Nexus-v2",
      "envFile": "D:/Git/MCP-Nexus-v2/.env"
    }
  }
}
```

HTTP: URL `http://127.0.0.1:4005/mcp`, заголовок `Authorization: Bearer <MCP_API_KEY>`.  
Проверка: `GET /health`, готовность (без секретов): `GET /ready`.

## Тулы (MVP)

Поиск: `find_account`, `find_counterparty`, `find_document_type`, `find_item`, `find_analytics_value`.  
Учёт: `get_chart_of_accounts`, `get_trial_balance`, `get_balance` / `get_account_saldo`, `get_account_card`, `get_account_analysis`, `get_journal_order`.  
Конфиги: `list_report_configs`, `run_report_config`.  
Документы: `get_documents`, `get_document`. SQL: `run_sql` (только чтение).
