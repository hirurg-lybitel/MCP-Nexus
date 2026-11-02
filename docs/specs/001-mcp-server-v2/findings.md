# Результаты исследований

Факты, на которых построен [план](plan.md). Дата исследования — 2026-11-02, если не указано иное.

## 1. Текущая реализация MCP-Nexus

- Monorepo: `apps/web` (Next.js 16 + собственный чат через GPT-прокси + MCP-сервер на Express в том же процессе) и `packages/db-firebird` (слой доступа к Firebird: порты, use-case'ы, инфраструктура, тесты).
- MCP-тулы: `search_tables`, `list_tables`, `describe_table`, `execute_sql` и демо-тулы погоды. Промпты — только демо и `query_table_rows`.
- Знания о предметной области — системный промпт и пользовательский `domain context` в `localStorage`. Их получает только встроенный веб-чат; внешние клиенты (Cursor и др.) получают «голые» тулы, поле MCP `instructions` не используется.
- `execute_sql` отдаёт до 500 сырых строк без итогов.
- Защита: проверка текста SQL (только SELECT/WITH), транзакции `READ_ONLY`, проверка существования таблиц, маскирование чувствительных полей по шаблонам, лимит строк, таймаут.
- Авторизация: один общий `MCP_API_KEY`. Аудита нет.

### Технические проблемы

| Проблема | Где |
|---|---|
| SDK `@modelcontextprotocol/sdk` 1.29, сессионный Streamable HTTP (`mcp-session-id`, GET-поток, `InMemoryEventStore`). Спецификация MCP 2026-07-28 сделала транспорт stateless | `apps/web/lib/mcp/server.ts` |
| Режим `FIREBIRD_SQL_DIALECT=2.5` блокирует `WITH`, хотя CTE есть с Firebird 2.1 (проверено на 2.5.9). «SQL-диалект» (1/3) смешан с версией сервера | `packages/db-firebird/src/infrastructure/firebird-sql-dialect-guard.ts` |
| Таймаут через `Promise.race` не отменяет запрос на сервере | `read-query-executor.ts` |
| Одно соединение (`Attachment`) на все запросы, пула нет | `firebird-connection.ts` |
| Поля BLOB (в т. ч. результат `LIST()`) возвращаются как служебный объект драйвера, а не как текст | `read-query-executor.ts` (`fetchAsObject`) |
| На Firebird 4+ агрегаты по `NUMERIC` возвращают `INT128`, драйвер отвечает «Data type unknown» | `read-query-executor.ts`, настройки соединения |
| Кодировка соединения не задаётся явно (кириллица из WIN1251 сейчас приходит корректно) | `firebird-connection.ts` |
| Подключение под `SYSDBA` | `apps/web/.env` |

## 2. Окружение разработчика

| Компонент | Значение |
|---|---|
| Gedemin | `D:\Soft\gedemin\gedemin.exe`, 2.9.7.13136 от 28.10.2026 (до обновления 2.9.7.13126), **32-битный** |
| Клиент Firebird у Гедымина | `fbembed.dll` 2.5, 32-битный |
| UDF | `D:\Soft\gedemin\UDF\gudf.dll`, 32-битная |
| Firebird 2.5.9 | служба `FirebirdServerDefaultInstance`, порт 3052, `D:\Soft\Firebird\Firebird_2_5` |
| Firebird 3.0 | служба `FirebirdServerFirebird_3`, `D:\Soft\Firebird\Firebird_3_0` |
| Firebird 5.0.4 | служба `FirebirdServerFirebird_5_0`, порт 3055, `D:\Soft\Firebird\Firebird_5_0` (установлен для стенда, см. план 0.2) |
| `gedemin.ini` | `[NAMESPACE] Path=D:\Git\gedemin-apps\crm`; секции `[WEB SERVER]` нет |
| Базы (`databases.ini`) | `CRM` → `localhost/3052:D:\Soft\gedemin\Databases\CRM.FDB`; `CRM_EMPTY` → `ETALON.FDB` |

Настройки Firebird 5 (в конце `firebird.conf`): `RemoteServicePort = 3055`, `IpcName = FIREBIRD_5_0`, `AuthServer/AuthClient = Srp256, Srp, Legacy_Auth`, `UserManager = Legacy_UserManager, Srp` (порядок как в инструкции: Гедымин создаёт пользователей первым плагином, а 32-битный клиент 2.5 понимает только устаревшую авторизацию), `WireCrypt = Enabled` и настройки из инструкции платформы (§3б). SYSDBA и служебный `STARTUSER` заведены в обоих менеджерах пользователей; пароль SYSDBA — из `apps/web/.env`.

Пользователь Гедымина для воркера: `mcp_worker` (`GD_USER.ID` 949805496, контакт 949805495 в папке «Контакты»), группа «Пользователи» (`INGROUP = 4`), организация по умолчанию «Амперсант ООО». Создан SQL-ом по той же цепочке, что `TgdcUser` (§4), в `CRM.FDB` и `CRM_FB5.FDB`; свой пользователь Firebird заведён на обоих серверах (на FB5 — в обоих плагинах) с ролью `ADMINISTRATOR`. Проверено: вход через `GD_P_SEC_LOGINUSER` (`RESULT = 1`) и подключение под его пользователем Firebird. Пароли — только в `.env` worktree (`GEDEMIN_WORKER_*`), в git не попадают. 64-битная `gudf.dll` (сборка 09.08.2013) лежит в `D:\Soft\Firebird\Firebird_5_0\UDF`.

## 3. База `CRM.FDB` (Firebird 2.5.9)

- ODS 11.2, SQL-диалект 3, кодировка WIN1251, 1,8 ГБ.
- Версия структуры Гедымина: 361 (`FIN_VERSIONINFO`, 16.12.2025). Свежая платформа на старом движке: версия движка и версия структуры — независимые оси совместимости.
- Драйвер проекта (`node-firebird-driver-native`) подключается к серверу 2.5 без дополнительных настроек.
- CTE работают, оконные функции — нет (`Token unknown`).
- Есть все объекты учётного ядра из ТЗ: `AC_ACCOUNT`, `AC_COMPANYACCOUNT`, `AC_TRANSACTION`, `AC_TRRECORD`, `AC_RECORD`, `AC_ENTRY` (поля `ISSIMPLE`, `DEBITEQ`/`CREDITEQ`, `MASTERDOCKEY`, `TRANSACTIONKEY`, 24 аналитики `USR$`), `AC_QUANTITY`, `AC_ENTRY_BALANCE` + генератор `GD_G_ENTRY_BALANCE_DATE`, `AC_ACCT_CONFIG`, `AC_LEDGER_ACCOUNTS`, `AC_LEDGER_ENTRIES`, `GD_DOCUMENT`, `GD_DOCUMENTTYPE` (`HEADERRELKEY`, `LINERELKEY`, `HEADERFUNCTIONKEY`, `LINEFUNCTIONKEY`…), `GD_FUNCTION`, `RP_REPORTLIST`, `AT_*`.
- Процедуры: `AC_CIRCULATIONLIST_BAL`, `AC_ACCOUNTEXSALDO_BAL`, `AC_GETSIMPLEENTRY` (и старые варианты без `_BAL`).
  - `AC_CIRCULATIONLIST_BAL(DATEBEGIN, DATEEND, COMPANYKEY, ALLHOLDINGCOMPANIES, ACCOUNTKEY, CURRKEY, DONTINMOVE)` → `ALIAS, NAME, ID`, сальдо на начало, обороты и сальдо на конец в НДЕ, валюте и эквиваленте, `OFFBALANCE`.
  - `AC_ACCOUNTEXSALDO_BAL(DATEEND, ACCOUNTKEY, FIELDNAME, COMPANYKEY, ALLHOLDINGCOMPANIES, CURRKEY)` → развёрнутое сальдо Дт/Кт в трёх видах сумм.
- UDF: 56 функций модуля `gudf` и 2 функции `system_module`.

### Объёмы

| Что | Количество |
|---|---|
| Проводки `AC_ENTRY` / `AC_RECORD` | 336 304 / 184 861 (с 31.01.1996 по 30.10.2023) |
| Документы | 344 205 (последний — 21.01.2025) |
| Типы документов | 280 |
| Типовые операции / типовые проводки | 231 / 289 (у 286 есть код формирования) |
| Отчёты / сохранённые конфигурации бух. отчётов | 1 260 / 84 |
| Скрипт-функции `GD_FUNCTION` | 9 609 (EVENTS 3 510, METHOD 2 038, REPORTMAIN 1 506, ENTRY 451, MACROS 278…) |
| Счета и субсчета | 454 |
| Компании (`GD_COMPANY`) | 46 187 |
| Пользовательские таблицы / из них `USR$` | 976 / 764 |

Выводы:
- База знаний по проводкам — порядка 290 карточек.
- Данные заканчиваются в 2023 году: статистику «за последний год» считать от даты среза данных, а не от текущей даты.
- У нескольких компаний активны разные планы счетов (в т. ч. «Управление проектами»), параметр организации обязателен.

## 3а. Стенд Firebird 5.0.4 (`CRM_FB5.FDB`)

- Копия получена так: бэкап сервером 2.5 через service manager (`gbak -b -g -se localhost/3052:service_mgr`, 37 с, 1,1 ГБ) → восстановление на FB5 (`gbak -c -se localhost/3055:service_mgr`, 100 с). Оригинал `CRM.FDB` не изменялся.
- ODS 13. В журнале восстановления только 17 предупреждений «function … is not defined / module name or entrypoint could not be found» для функций `gudf`: 32-битную библиотеку x64-сервер не загрузит, к тому же в Firebird 4+ по умолчанию `UdfAccess = None`.
- Совпадает с 2.5: `COUNT(*)` по `AC_ENTRY` (336 304), `AC_RECORD` (184 861), `AC_ACCOUNT`, `GD_CONTACT`; суммы `DEBITNCU`/`CREDITNCU` по всем проводкам; ОСВ компании 146866007 («Амперсант ООО», план счетов 300001) за 01.01–31.10.2023 через `AC_CIRCULATIONLIST_BAL` — 41 счёт, сальдо на начало Дт 13 902 020,9715 / Кт 4 704 074,6901, обороты Дт 515 139,50 / Кт 168 102,50, сальдо на конец Дт 14 417 074,4715 / Кт 4 872 091,1901. Время — около 0,5 с на обоих серверах.
- `DONTINMOVE = 0` и `1` дали одинаковый результат: в этом периоде у компании нет внутренних проводок. Для теста правила D9 нужен другой пример.
- Обороты Дт и Кт в ОСВ не равны из-за забалансовых счетов (`008`, `ПЛАН`) с односторонними проводками. Ведомость должна показывать забалансовые счета отдельно (выход `OFFBALANCE`).
- `AC_ENTRY_BALANCE` пуста: сальдо считается по всей истории проводок.
- **Проблема 1.** На FB5 `SUM()` по `NUMERIC(15,4)` возвращает `INT128`; драйвер проекта отвечает «Data type unknown». Обход в запросе — `CAST(SUM(…) AS NUMERIC(18,4))`; системное решение — привязка типов на уровне соединения (D13).
- **Проблема 2.** Вычисляемые поля на UDF делают таблицу нечитаемой на FB5 без 64-битной `gudf`: даже `SELECT COUNT(*) FROM GD_DOCUMENT` падает с «function G_S_DELCHAR is not defined». Такие поля в базе:

| Таблица | Поле | Выражение |
|---|---|---|
| `GD_DOCUMENT` | `USR$SORTNUMBER` | `g_s_delchar(NUMBER)` |
| `MSG_MESSAGE` | `MSGSTARTMONTH` | `g_d_formatdatetime('yyyy.mm', msgstart)` |
| `USR$PD_CALCLINE` | `USR$NUMBER_I` | `g_s_delchar(USR$NUMBER)` |
| `WG_TBLCALDAY` | `WDURATION` | `G_M_ROUNDNN(…, 0.01)` |

`USR$SORTNUMBER` — пользовательская доработка этой базы, не ядро платформы. У других клиентов набор таких полей будет свой, поэтому проверка нужна в профиле совместимости (D14).

**Итог после настройки по §3б:** обе проблемы сняты. `GD_DOCUMENT` читается (344 205 записей, как на 2.5), все четыре вычисляемых поля и прямой вызов UDF работают, `SUM()` без приведения возвращает те же суммы, что на 2.5. Значит, у клиентов, перешедших на FB5 по инструкции, проблем не будет; у клиентов с отклонениями от инструкции их поймает профиль совместимости (D13, D14).

## 3б. Инструкция платформы «Инструкция по миграции на Firebird 5»

Источник: gsbelarus.com, раздел новостей, 05.05.2025 (ссылку дал владелец). Что важно для сервера:

- Обязательные настройки `firebird.conf`: `AuthServer = Srp256, Srp, Legacy_Auth`, `UserManager = Legacy_UserManager, Srp`, `WireCrypt = Enabled`, `UdfAccess = Restrict UDF`, `DataTypeCompatibility = 2.5`, `ServerMode = Classic`, `MaxParallelWorkers = 4`, `ParallelWorkers = 1`, `OuterJoinConversion = false`. Необязательные: `DefaultTimeZone`, `RemoteServicePort`.
- `gudf.dll` (64-битная) кладётся в папку `UDF` в каталоге Firebird.
- База переносится штатным бэкапом и восстановлением из Гедымина.
- Если при восстановлении есть предупреждения `function … is not defined`, платформа даёт утилиту, которая убирает из базы зависимости от UDF. Значит, у части клиентов вычисляемые поля на UDF заменены — профиль совместимости не должен предполагать их наличие.
- Для параллельного восстановления в папку Гедымина копируются 32-битные DLL Firebird 5 из ZIP-дистрибутива с удалением старых версий (`icudt30.dll` → `icudt63.dll` и т. д.). Значит, у клиентов на FB5 Гедымин использует клиентскую библиотеку FB5, а у клиентов на 2.5 — `fbembed.dll` 2.5; воркер должен иметь ту же библиотеку, что и основная установка.
- Стенд приведён к этим настройкам (план 0.2а). Отличие от инструкции: служба называется `Firebird_5_0`, а не `DefaultInstance`, потому что рядом работают 2.5 и 3.0.

## 4. Исходники платформы

- Используемая сборка собрана из `D:\Git\gedemin-private`, ветка `delphi7`: версия в `Gedemin/Gedemin/gedemin_ver.rc` — 2.9.7.13137, последний коммит 28.10.2026, 5 764 коммита. Относительно публичной версии изменено 3 483 файла. Ветка `master` этого репозитория остановилась на 01.07.2024.
- Публичный репозиторий `GoldenSoftwareLtd/gedemin` (раньше лежал в `D:\Git\gedemin`, сейчас удалён с диска), последний коммит 02.09.2022: версия exe 2.9.5.12288, структура БД примерно до 311. Больше не используется.
- Факты ниже проверены по `delphi7` (ссылки — файл:строка в этой ветке).
- Версии Firebird: `IsFirebirdConnect` (ODS ≥ 11), `IsFirebird25Connect`, `IsFirebird30Connect` (`IBX/IBDatabase.pas:1724–1739`). Отдельной поддержки 4.0/5.0, `INT128`, `DECFLOAT`, `SET BIND` в коде нет — работа на FB5 держится на `DataTypeCompatibility = 2.5` и `UdfAccess` в `firebird.conf` (§3б).
- Клиентская библиотека Firebird выбирается вне исходников Гедымина (скомпилированный IBX); в дистрибутиве — `fbembed.dll`.
- Утилиты удаления зависимостей от UDF из инструкции по миграции в исходниках нет.

### Пользователи и вход

- Пользователь — строка `GD_USER` (`SQL/gd_security.sql:42–67`) с обязательным контактом-человеком (`GD_CONTACT` + `GD_PEOPLE`) и организацией по умолчанию (`GD_USERCOMPANY`). Группы — битовая маска `INGROUP`, бит группы `1 shl (ID − 1)`: 1 — «Администраторы», 4 — «Пользователи» (`Component/GDC/gdcUser.pas:1588`). Опасный умолчательный `INGROUP DEFAULT 1` — администратор.
- У каждого пользователя свой пользователь Firebird со случайными 8-символьными `IBNAME`/`IBPASSWORD`; при создании Гедымин выполняет `CREATE USER` (используется первый плагин из `UserManager`) и `GRANT ADMINISTRATOR … WITH ADMIN OPTION` (`gdcUser.pas:404–449`). Пароль Гедымина (`PASSW`) хранится открытым текстом.
- Вход в две фазы (`Security/gd_security_body.pas:1417–1813`): подключение служебным `STARTUSER`/`startuser` → `SET_CONTEXT('USER_SESSION','ACCESS_VERSION','DESKTOP_1')` → `EXECUTE PROCEDURE GD_P_SEC_LOGINUSER(имя, пароль, подсистема)` → подключение под `IBNAME`/`IBPASSWORD` с ролью `ADMINISTRATOR`. Триггер `GD_DB_CONNECT` по `CURRENT_USER` ставит контекст `GD_USERKEY`, `GD_INGROUP`.
- Если на сервере нет `STARTUSER`, Гедымин создаёт его **интерактивно**, спрашивая пароль SYSDBA (`gd_security_body.pas:1240–1270`). Для воркера без интерфейса `STARTUSER` нужно завести заранее; на FB3+ ещё `GRANT ALTER ANY SEQUENCE TO STARTUSER`.
- **Уязвимость платформы (проверено на обоих стендах):** `GD_P_SEC_LOGINUSER` возвращает `IBNAME` и `IBPASSWORD` и при неверном пароле (`RESULT = -1004`). Пароль `STARTUSER` общеизвестен, поэтому любой, у кого есть сетевой доступ к порту Firebird, получает учётные данные Firebird любого пользователя (с ролью `ADMINISTRATOR`). Для сервера MCP это означает: порт Firebird не должен быть доступен за пределами доверенной сети. Сообщить автору платформы (исправление — возвращать учётные данные только при `RESULT = 1`).
- Права на объекты (`AVIEW`/`ACHAG`/`AFULL`) проверяются в клиенте и в части процедур через `G_SEC_TEST`/`BIN_AND` с маской группы.

### Командная строка `gedemin.exe` (`Security/gd_CmdLineParams_unit.pas:224–498`)

- База и вход: `/SN <база>`, `/USER <имя>`, `/PASSWORD <пароль>`.
- Без интерфейса: `/Q` (тихий режим), `/NS` (без заставки), `/RUN <RUID>` (выполнить функцию после входа), `/EXIT` (выйти после `/RUN`). `/AUTOTASK <id> <мин>` дополнительно включает `HideUI` и выход по времени; отдельного ключа `HideUI` нет.
- Веб-сервер ключом не включается — только `gedemin.ini`.

### Встроенный веб-сервер (`Component/gd_WebServerControl_unit.pas`)

- Настройка — `gedemin.ini`, секция `[WEB SERVER]`: `Active`, `Bindings` (`host:port` через запятую; порт по умолчанию 80), `RunOnlyOn` (имена компьютеров). Сервер стартует после входа пользователя (`GAdmin/dmLogin_unit.pas:313–332`); не стартует, если первый адрес `0.0.0.0`. Ошибка привязки порта — `MessageBox`. HTTPS нет.
- `RegisterOnGetEvent(Component, Token, FunctionName)` (`308–389`) — привязка адреса к скрипт-функции. Отдельной регистрации POST нет: тело POST передаётся обработчику пятым параметром. Сессия `/login` нигде не проверяется; у обработчика есть только необязательный параметр `token`.
- Все запросы, кроме `/relay/*`, выполняются по очереди в главном потоке (`Synchronize`, `586–595`).
- Журнал `gd_weblog`/`gd_weblogdata` пишется для `/query`, `/get_file`, `/get_blob`, `/send_error` и пользовательских обработчиков — воркеру нужна база с правом записи.
- Все текстовые ответы — `Windows-1251`, включая JSON OData. UTF-8 нет.
- Без авторизации: `/OData` (отдаёт все строки открытых наборов), `/query`, `/get_file`, `/get_files_list`, `/get_blob`, `/test` (позволяет перебирать пароли), `/send_error`, `/relay/*`. `/get_blob` подставляет параметры `table` и `field` в SQL конкатенацией (`1151–1155`) — SQL-инъекция.
- Рабочие примеры обработчиков: `D:\Git\gedemin-apps\Официант - найтрон\Официант в системе Naytron.API.yml`, «Управление проектами. Веб-интерфейс», «Зарплата / GDMN-Salary», Gdmn3m.

### Сериализация

- `Gedemin.Dataset2JSON(IgsIBSQL, Stream, Fields, SubObjects, SkipNulls, DateTimeInMs, TZ, WithMs, MakeArray, Name, Indent, UTF8)` (`Report/obj_Gedemin.pas:574–640`) — только для `IgsIBSQL`. Флаг `UTF8` перекодирует результат; у `Dataset2JSONByPortion` такого флага нет; параметр `TZ` не используется.
- Числа пишутся через `AsString` с точкой, `NULL` — `null`, даты — ISO-строкой или миллисекундами, текстовый BLOB — строкой, двоичный — ошибка (`Common/gd_DataSetToJSONConverter.pas:255–313`). `TgdJSONWriter.AddField` и OData пишут все поля строками.

### Бухгалтерские отчёты (`Transaction/gdvAcct*.pas`)

- `TgdvAcctBase` (`gdvAcctBase.pas:162–196`): `DateBegin`, `DateEnd`, `CompanyKey`, `AllHolding`, `WithSubAccounts`, `IncludeInternalMovement`, `UseEntryBalance`, `ShowInNCU/ShowInCurr/ShowInEQ/ShowInQuantity`, `AddAccount`, `AddCorrAccount`, `AddCondition`, `AddValue`, `LoadConfig`, `SaveConfig`, `BuildReport`, `Execute(ConfigID)`. Для VBScript классы зарегистрированы в `Property/obj_WrapperGSClasses.pas:20112–20116`. Построение без формы: создать объект, задать `Database`/`ReadTransaction` и параметры, вызвать `BuildReport`.
- Наследники: `TgdvAcctCirculationList` (ОСВ, `OnlyAccounts`), `TgdvAcctLedger` (журнал-ордер), `TgdvAcctAccCard` (карта счёта, `DoGroup`), `TgdvAcctAccReview` (анализ счёта, `CorrDebit`, `WithCorrSubAccounts`), `TgdvAcctGeneralLedger` (главная книга, субсчета включаются всегда).
- Диалоги, блокирующие воркер (все — в `gdvAcctBase.pas`, в наследниках диалогов нет):
  - `483`: SQL длиннее 65 535 символов (`EgsLargeSQLStatement`) — `MessageBox` **всегда**, без учёта `/Q`, затем **пустой отчёт** (`480–486`) — тул должен распознать это и вернуть ошибку, а не нули;
  - `400–403`: ошибка SQL у пользователя-администратора — `MessageBox` и SQL-редактор (у пользователя группы «Пользователи» не возникает);
  - `693–698`: ошибка `LoadConfig` — `ShowException` и `MessageBox`.
- При количественных показателях `AC_ENTRY_BALANCE` не используется (расчёт «старым методом»).

### Внутренние проводки (`Gedemin/SQL/ac_accounting.sql`)

`DONTINMOVE = 1` исключает:
1. стороны проводки на одном счёте с противоположной стороной и равной суммой внутри одной записи (`e_m.debitncu = e_cm.creditncu` и т. д.);
2. все проводки операций с `AC_TRANSACTION.ISINTERNAL = 1`.

ТЗ описывает только первый случай.

### Параметры отчётов (`Gedemin/Component/prm_ParamFunctions_unit.pas`)

`gd_function.enteredparams` — поток `TgsParamList` между маркерами `SLPR` / `FLPR`; каждый параметр — маркер и строки с 4-байтовым префиксом длины: `RealName`, `DisplayName`, `LinkTableName`, `LinkDisplayField`, `LinkPrimaryField`, `ParamType`, `LinkConditionFunction`, `LinkFunctionLanguage`, `Comment` (возможны дополнительные поля в новых версиях — проверить по `LoadFromStream`).

## 5. Прикладные решения `D:\Git\gedemin-apps`

Пакеты настроек в YAML (namespaces): «Бухгалтерия» (в т. ч. `Бух.отчеты.yml`), «Склад», «Зарплата», «Банк», CRM, Web-services и др. Второй источник кода для базы знаний (история в git); источник истины для конкретного клиента — `gd_function` в его базе, связь по RUID.

## 6. Вики платформы

`https://gsbelarus.com/gs/wiki/` — MediaWiki, около 824 статей. API (`api.php`) выключен, исходный текст страницы отдаётся через `index.php?title=<Страница>&action=raw`. Многие статьи 2009–2015 годов: при расхождении приоритет у кода и данных.

## 7. Стандарты для клиентов

- MCP, редакция 2026-07-28: stateless Streamable HTTP (без сессий и GET-потока), `server/discover`, расширения (MCP Apps `io.modelcontextprotocol/ui`, Skills over MCP `io.modelcontextprotocol/skills`).
- TypeScript SDK v2 (`@modelcontextprotocol/server` 2.4.0): `createMcpHandler` обслуживает и 2026-, и 2025-клиентов; `serveStdio` для stdio.
- Авторизация MCP: OAuth 2.1 + PKCE, Protected Resource Metadata (RFC 9728). Cursor поддерживает OAuth, tools, prompts, resources, elicitation, MCP Apps.
- Agent Skills (`SKILL.md`, agentskills.io) и `AGENTS.md` — общий формат инструкций для Cursor, Codex, Claude.

## 8. Полезные публичные скиллы

- `mcp-builder` (anthropics/skills) — обновлён под SDK v2.
- Скиллы разработки MCP Apps (ext-apps).
- `web-design-guidelines`, `vercel-react-best-practices` (vercel-labs/agent-skills) — для консоли.
