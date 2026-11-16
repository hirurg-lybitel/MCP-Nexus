# Namespace воркера Гедымина

Папка указана в `D:\Soft\gedemin-worker\gedemin.ini` как `[NAMESPACE] Path`.

## Безопасность (2.3)

- Веб воркера только на **127.0.0.1** (`[WEB SERVER]` в `gedemin.ini`, `GEDEMIN_WORKER_HOST=127.0.0.1`). H03.
- Обработчики `/mcp/*` требуют query-параметр `token`. Значение задаётся при `install-namespace` из `GEDEMIN_WORKER_TOKEN` (иначе `MCP_API_KEY`, иначе `mcp-worker-dev`). Без token → `UNAUTHORIZED` (H02).
- Клиент MCP после модального окна Гедымина не принимает «ok + пустые строки» как успех (`WORKER_BLOCKED_EMPTY`).

## Пакет `MCP.Worker.API.yml`

VBScript HTTP-обработчики для отчётов MCP (ASCII JSON):

| Путь | Функция |
|------|---------|
| `/mcp/trial_balance` | `mcp_trial_balance` |
| `/mcp/account_card` | `mcp_account_card` |
| `/mcp/account_review` | `mcp_account_review` |
| `/mcp/journal_order` | `mcp_journal_order` |
| `/mcp/run_report_config` | `mcp_run_report_config` |

### Установка / удаление

```bash
node packages/report-worker/scripts/install-namespace.mjs
node packages/report-worker/scripts/uninstall-namespace.mjs
```

Скрипты пишут/удаляют `GD_FUNCTION`, `RP_ADDITIONALFUNCTION`, макрос `RUNONLOGIN` в `EVT_MACROSLIST`. После install нужен перелогин воркера (или рестарт), чтобы `mcp_RegisterHandlers` подхватил скрипты.

### Запуск

```bash
node packages/report-worker/scripts/start-worker.mjs
# один воркер под супервизором:
node packages/report-worker/scripts/supervise-worker.mjs
# пул 2–4 (2.4):
node packages/report-worker/scripts/supervise-pool.mjs
```

`/SN` — строка Firebird (`GEDEMIN_WORKER_SN` или `NODE_FB_HOST/PORT/DB`), не алиас из `databases.ini`.

Проверка: `http://127.0.0.1:9080/test`, `/mcp/trial_balance?token=...`.

## Пул воркеров (2.4)

Один `gedemin.exe` — один поток HTTP. Параллельные отчёты = несколько процессов на разных портах.

| Переменная | Смысл |
|---|---|
| `GEDEMIN_WORKER_POOL_SIZE` | 1–4 (по умолчанию 1) |
| `GEDEMIN_WORKER_BASE_PORT` | первый порт (9080 → 9081…) |
| `GEDEMIN_WORKER_URLS` | явный список URL через запятую (приоритетнее size) |
| `GEDEMIN_WORKER_QUEUE_TIMEOUT_MS` | ожидание свободного слота (по умолчанию 180000) |
| `GEDEMIN_WORKER_HOMES` | каталоги с `gedemin.exe` + своим `gedemin.ini` на слот |

Каждый слот нужен свой каталог (копия `gedemin-worker`) и в `gedemin.ini`:

```ini
[WEB SERVER]
Active=1
Bindings=127.0.0.1:9081
```

При `POOL_SIZE=1` / одном URL поведение как раньше. MCP-клиент ставит запросы в FIFO-очередь; при timeout слота — `WORKER_TIMEOUT` и рестарт через `onHung` (в `supervise-pool`).
