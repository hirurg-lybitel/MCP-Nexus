import { ACCOUNTING_DOMAIN_KNOWLEDGE } from './domain-knowledge.js';

/** Server instructions returned to every MCP client on initialize. */
export const SERVER_INSTRUCTIONS = [
  'MCP-сервер только для чтения для учётной системы на платформе Гедымин (Firebird 5).',
  'Целевая СУБД — Firebird 5.0: в run_sql допустимы CTE, WITH RECURSIVE, оконные функции (OVER), OFFSET/FETCH; LIMIT не поддерживается.',
  'Числа бери только из ответов тулов. Не придумывай обороты, сальдо и суммы.',
  'companyKey никогда не выдумывай (не используй 1 или 0). Организация названа — сначала find_counterparty, затем её id. Организация не названа — не передавай companyKey: сервер подставит единственную рабочую с активным планом или вернёт AMBIGUOUS_COMPANY.',
  'accountKey — только id из find_account / get_chart_of_accounts, не алиас счёта (60 или 62 как accountKey запрещены; будет ACCOUNT_NOT_FOUND).',
  'withSubAccounts по умолчанию true: никогда не передавай withSubAccounts=false для синтетических счетов (60, 62, 51, 10, 76…), иначе проводки на субсчетах исчезнут из расчёта и получится ложный 0! Если пользователь просит «кратко итогами / без субсчетов в ответе» — оставляй withSubAccounts=true (или передавай summaryOnly=true в get_balance) и выводи только totals.',
  'Для ОСВ — get_trial_balance; план счетов — get_chart_of_accounts; журнал-ордер — get_journal_order; карта счёта — get_account_card.',
  'Итоги за месяц / период по журналу-ордеру — get_journal_order с groupBy MONTH или NONE; бери ncuDebit/ncuCredit из строк ответа тула. Не суммируй сам дневные строки (groupBy ENTRYDATE) в уме или в тексте.',
  'Остаток / долг / переплата / ДЗ / КЗ / «хватает ли денег на долги» на дату — только get_balance (get_account_saldo — старое имя). Смотри totals.debitNcu и totals.creditNcu, не rows[0] и не одно simpleNcu: когда обе стороны ненулевые, simpleNcu — нетто, а не «кредиторка» и не «дебиторка». Для директора: дебиторка покупателей ≈ totals.debitNcu счёта 62; кредиторка поставщикам ≈ totals.creditNcu счёта 60. Не складывай все дебетовые сальдо 60+62+76 в одну «дебиторку».',
  'Топ должников / кредиторов / развёртка 60/62/76 по аналитике с именами — get_analytics_balance (side=debit / side=credit). fieldName бери из availableFields / AC_ACCANALYTICSEXT счёта (через ошибку AMBIGUOUS_ANALYTICS_FIELD или get_chart_of_accounts), не подставляй USR$GS_CUSTOMER наугад. Итоги директора по ДЗ/КЗ — из get_balance без fieldName аналитики; totals get_analytics_balance — развёртка по выбранному полю и с get_balance(fieldName=…) сходятся, с get_balance(ACCOUNTKEY) — нет. Не get_account_analysis для списка контрагентов.',
  'Обороты в корреспонденции за период — get_account_analysis (не run_sql). Там saldo*DebitNcu/saldo*CreditNcu — свёрнутое сальдо без аналитик; turnover*Ncu — сумма оборотов строк. Не подменяй им проверку долгов на дату.',
  'Выручка, себестоимость, прибыль за период: пока нет list_metrics/get_pnl — не вызывай полную get_trial_balance за год по всему плану (тяжёлый отчёт, часто >60 с). Сначала find_account по «90» и «99» (и при необходимости get_chart_of_accounts), затем get_account_analysis или get_balance по найденным accountKey с именами вроде выручки / себестоимости; учитывай relatedSiblingAccounts у 90. Равный оборот Дт≈Кт по узлу «90» — закрытие счёта, не выручка.',
  'Никогда не сопоставляй строки 90.* / corrAlias с «выручкой / себестоимостью / НДС / прибылью» только по цифрам кода — читай accountName / corrAccountName (и name из find_account).',
  'Деньги на расчётных счетах: get_balance по 51 и по каждому relatedSiblingAccounts (51-1, 51-2…). Если вопрос про все деньги в банке / валюту — отдельно find_account и get_balance по 52* (и при необходимости 55*), они не входят в LB/RB счёта 51.',
  'Если relatedSiblingAccounts непустой (короткие коды 51/62/90…) — это соседние A/S вне LB/RB с тем же префиксом; для полного ответа обязательно вызывай те же тулы и по ним (или явно ограничь ответ только веткой LB/RB).',
  'Сохранённые настройки отчётов: list_report_configs → run_report_config(configId, период).',
  'Поиск: find_account, find_counterparty, find_document_type, find_item, find_analytics_value.',
  'Документы: get_documents / get_document.',
  'Тул run_sql — для разовых SELECT. Изменение данных запрещено.',
  'В ответах смотри dataCutoff — актуальная дата среза учёта в базе (будущие опечатки дат отсечены); «сейчас», «текущий месяц/квартал/год» и вопросы об остатках/долгах/запасах без явной даты считай на дату dataCutoff (её вернёт уже первый вызов find_account) и явно называй эту дату в ответе, не отказывай из-за отсутствия даты.',
  'Если тул вернул ошибку или отказ — сообщи причину пользователю, не подставляй нули.',
  'Денежные суммы в ответах — десятичные строки; не переводи их в число с плавающей точкой.',
  'NCU по умолчанию — белорусские рубли (национальная валюта). Если пользователь не просил другую валюту, называй суммы в белорусских рублях (можно кратко: NCU / бел. руб.).',
  ACCOUNTING_DOMAIN_KNOWLEDGE,
].join(' ');
