/**
 * Build Excel and CSV copies of knowledge-questionnaire.md tables.
 * Run: node build-questionnaire-workbook.mjs
 */
import { writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const howTo = [
  ['Опросник для базы знаний учётного модуля'],
  [''],
  ['Кому', 'Бухгалтеру и главному разработчику платформы Гедымин'],
  [
    'Зачем',
    'Сервер отвечает по базе любого клиента. Структуру таблиц он читает сам. Ему не хватает правил: что означает счёт, аналитика и сумма, если коды плана счетов у клиентов разные.',
  ],
  [''],
  ['Как отвечать'],
  ['1', 'Пишите правило модуля, а не коды одной базы.'],
  ['2', 'Если так устроено не у всех клиентов, ответ: «только настройка базы».'],
  [
    '3',
    'Если правило есть, но сервер должен прочитать его из данных, укажите поле или отчёт.',
  ],
  ['4', 'Короткой правки достаточно. Пустая клетка «Ответ» значит, что вопрос ещё открыт.'],
  [''],
  [
    'Почему без номеров счетов',
    'Две базы уже расходятся: в одной покупатели на 62.00 и 62.07, в другой долг на 62.1, авансы на 62.4. Номер счёта в базу знаний не зашиваем.',
  ],
  [''],
  ['Листы', 'Бухгалтеру — смысл показателей. Разработчику платформы — правила любой базы.'],
];

const accountant = [
  ['№', 'Вопрос', 'Зачем это серверу', 'Ответ'],
  [
    'А1',
    'Когда говорят «задолженность покупателей» и не называют счёт, по какому признаку его узнать в незнакомом плане: по названию, по типу счёта, по отдельной пометке в описании или только после ручной привязки?',
    'Без этого сервер не имеет права выбирать 62, 62.1 или 62.00 сам',
    '',
  ],
  [
    'А2',
    'Дебет расчётов с покупателем — это всегда начисление (услуги, товары), кредит — всегда оплата, сальдо — дебет минус кредит? Для авансов это то же правило или аванс живёт на отдельном субсчёте?',
    'Иначе сервер перенесёт правило одной базы на все',
    '',
  ],
  [
    'А3',
    'Аванс покупателя — это кредитовое сальдо того же счёта, развёрнутое по контрагенту, или всегда отдельная ветка счетов?',
    'От этого зависит, сворачивать сальдо или показывать две суммы',
    '',
  ],
  [
    'А4',
    'То же для поставщиков: дебет — оплата или аванс, кредит — поступление? Аванс выданный отделяется от долга так же, как у покупателей?',
    'Симметрия 60 и 62 в незнакомом плане неочевидна',
    '',
  ],
  [
    'А5',
    '«Выручка», «себестоимость», «НДС», «прибыль» можно узнать по словам в названии счёта или только по привязке, которую бухгалтер задаёт явно? Какие слова в названии считать надёжными?',
    'Названия субсчетов 90 в разных базах значат разное',
    '',
  ],
  [
    'А6',
    'Фраза «выручка» по умолчанию с НДС или без? Если без, какие суммы вычитать и как они называются в учёте, без привязки к номеру субсчёта?',
    'Сервер не должен вычитать «похожий» субсчёт',
    '',
  ],
  [
    'А7',
    'Забалансовые счета входят в обычный ответ про обороты и сальдо или только если о них спросили прямо?',
    'Иначе итог не сойдётся со штатной ведомостью',
    '',
  ],
  [
    'А8',
    'Внутренние проводки и закрытие периода: в обычном обороте их нет, в сальдо они есть. Это правило для любого клиента? Операция «проводки за прошлые года» — штатный приём или местная настройка, и что она меняет в цифрах?',
    'Сервер уже умеет исключать внутренние проводки, но не знает, когда бухгалтер ждёт другой цифры',
    '',
  ],
  [
    'А9',
    'Сальдо на дату и оборот за период всегда считаем как штатная ОСВ, карточка и анализ счёта? В каких вопросах бухгалтер ждёт другую цифру, чем эти отчёты?',
    'Главное правило продукта: неверное правдоподобное число хуже отказа',
    '',
  ],
  [
    'А10',
    'Если на счёте несколько аналитик, без какой из них сумму называть нельзя? Пример: покупатель без договора, товар без склада',
    'Сервер должен либо показать разрез, либо сказать, чего не хватает',
    '',
  ],
  [
    'А11',
    'Валютный ответ: когда показывать национальную сумму, когда валюту договора, когда эквивалент? Если пользователь не сказал, какая сумма основная?',
    'В проводке три пары сумм, и неясно, какую озвучивать',
    '',
  ],
  [
    'А12',
    'Количество (штуки, кг) нужно вместе с деньгами только для счетов запасов и реализации или ещё где-то?',
    'Иначе сервер будет тащить количество в денежный ответ',
    '',
  ],
  [
    'А13',
    '«Счёт 62» без уточнения — это вся ветка с субсчетами или только сам счёт, без детей?',
    'От этого меняется и оборот, и сальдо',
    '',
  ],
  [
    'А14',
    'В базе несколько организаций. Вопрос без названия фирмы относится к организации по умолчанию или сервер обязан переспросить?',
    'Иначе оборот будет по чужой компании',
    '',
  ],
  [
    'А15',
    'Что серверу запрещено решать самому даже приблизительно: классификацию счёта, знак суммы, включение НДС, выбор аналитики?',
    'Граница между «знаем из платформы» и «спрашиваем человека»',
    '',
  ],
];

const platform = [
  ['№', 'Вопрос', 'Зачем это серверу', 'Ответ'],
  [
    'Б1',
    'Активный план организации — всегда одна строка AC_COMPANYACCOUNT с ISACTIVE = 1? Может ли их быть две? Штатная ОСВ берёт только этот план?',
    'В одной базе рядом лежат бухгалтерский и управленческий планы с похожими кодами',
    '',
  ],
  [
    'Б2',
    'Управленческий план — такое же дерево AC_ACCOUNT с типом корня C или другой механизм? Как отчёт отличает его от бухгалтерского, если оба активны у разных организаций?',
    'Сервер не должен смешивать ветки',
    '',
  ],
  [
    'Б3',
    'ACCOUNTTYPE: C план, F группа, A счёт, S субсчёт. Это полный набор и он стабилен? Группа входит в обороты или это только папка?',
    'Иначе в ведомость попадёт промежуточный узел',
    '',
  ],
  [
    'Б4',
    'ACTIVITY A / P / B — всегда активно / пассивно / активно-пассивное с разворотом сальдо? Разворот идёт по полю ANALYTICALFIELD? Меняет ли тип знак дебета и кредита?',
    'Сервер не сворачивает сальдо сам, пока это не подтверждено',
    '',
  ],
  [
    'Б5',
    'Субсчета — это всегда вложенный интервал LB/RB родителя, включая границы? Бывает ли субсчёт вне этого интервала?',
    'Так сервер понимает «счёт со всеми субсчетами»',
    '',
  ],
  [
    'Б6',
    'OFFBALANCE и MULTYCURR на счёте достаточны, чтобы отличить забаланс и валютный учёт? Отчёт смотрит ещё какой-нибудь признак?',
    'Эти флаги уже есть в данных, но неясно, полные ли они',
    '',
  ],
  [
    'Б7',
    'Аналитика счёта — только колонка USR$, которая есть и в AC_ENTRY (значение), и в AC_ACCOUNT (флаг)? Так ли делает AcctUtils для всех решений, включая заказные?',
    'Сервер должен сам перечислить субконто базы, не держа их список',
    '',
  ],
  [
    'Б8',
    'Имена USR$GS_* обязательны в типовом контуре или клиент может удалить USR$GS_CUSTOMER и завести покупателя другой колонкой? Подпись и справочник всегда в AT_RELATION_FIELDS / AT_FIELDS.REFTABLE?',
    'Одинаковое имя в двух базах ещё не значит, что оно есть в третьей',
    '',
  ],
  [
    'Б9',
    'Пустой REFTABLE у аналитики — это свободное значение (текст, дата, число) или ошибка метаданных? Как такое значение показывает карточка счёта?',
    'Иначе сервер либо спрячет поле, либо выдумает справочник',
    '',
  ],
  [
    'Б10',
    'Порядок аналитик в карточке и журнале-ордере задаёт сохранённая настройка отчёта или он записан на счёте? Где лежат сохранённые конфигурации отчётов?',
    'Без этого сервер не повторит «наш обычный журнал-ордер»',
    '',
  ],
  [
    'Б11',
    'DEBITNCU/CREDITNCU — всегда национальная валюта учёта? Где в базе задана эта валюта? CURR заполняется только при ненулевом CURRKEY? EQ заполняется всегда или только при включённом эквиваленте?',
    'Три суммы нельзя складывать между собой',
    '',
  ],
  [
    'Б12',
    'ACCOUNTPART принимает только D и C? Бывает ли строка, где заполнены и дебет, и кредит?',
    'От этого зависит чтение одной стороны проводки',
    '',
  ],
  [
    'Б13',
    'Правило ISSIMPLE всё ещё такое: проводка только 1:1, 1:N или N:1, сумма корреспонденции берётся со стороны «многих», как в AC_GETSIMPLEENTRY?',
    'Иначе самодельный SQL задваивает сумму',
    '',
  ],
  [
    'Б14',
    'Внутренняя проводка для отчётов — это и пара с равными суммами на одном счёте (DONTINMOVE), и операция с ISINTERNAL = 1? Они не входят в оборот, но входят в сальдо?',
    'Так сервер уже сверял ОСВ, нужно подтверждение, что правило полное',
    '',
  ],
  [
    'Б15',
    'Сальдо штатных процедур считается от кэша AC_ENTRY_BALANCE плюс проводки после даты в GD_G_ENTRY_BALANCE_DATE? Если кэш пуст, процедуры сами проходят всю историю?',
    'Сервер не должен суммировать AC_ENTRY с начала времён',
    '',
  ],
  [
    'Б16',
    'DOCUMENTKEY — документ проводки, в том числе позиция, MASTERDOCKEY — шапка. Оба всегда ссылки на GD_DOCUMENT? Удаление документа всегда удаляет его проводки?',
    'Иначе «покажи документ проводки» найдёт не ту запись',
    '',
  ],
  [
    'Б17',
    'Тип документа — всегда GD_DOCUMENTTYPE, таблицы шапки и строк — HEADERRELKEY и LINERELKEY? Проведение всегда идёт через AC_TRANSACTION → AC_TRRECORD → GD_FUNCTION, или документ можно провести в обход?',
    'Сервер будет объяснять проводки по этому пути',
    '',
  ],
  [
    'Б18',
    'Классы отчётов TgdvAcctCirculationList, TgdvAcctAccCard, TgdvAcctAccReview, TgdvAcctLedger есть у каждого клиента этой линейки и принимают те же параметры? Журнал-ордер по-прежнему строится на TgdvAcctLedger?',
    'Числа сервера должны совпадать с этими отчётами, а не с собственным SQL',
    '',
  ],
  [
    'Б19',
    'Организация в параметрах отчёта — это GD_CONTACT.ID нашей фирмы из GD_OURCOMPANY? Холдинг включается отдельным флагом отчёта, не отдельным планом счетов?',
    'Путаница здесь меняет все цифры',
    '',
  ],
  [
    'Б20',
    'Что платформа гарантирует на любой базе, а что появляется только если установлен прикладной модуль (зарплата, ОС, склад, сертификаты)?',
    'База знаний делится на «ядро» и «может отсутствовать»',
    '',
  ],
];

const excluded = [
  ['Что не кладём в базу знаний, пока ответ не «так у всех»'],
  [''],
  ['Номера субсчетов покупателей, авансов, выручки и себестоимости'],
  ['Состав аналитик конкретного клиента'],
  ['Местные имена операций вроде «проводки за прошлые года»'],
  ['Сохранённые варианты отчётов одной организации'],
  [''],
  [
    'Пока ответов нет, сервер ищет счёт по названию в активном плане и аналитику по метаданным. Если признака нет, он говорит, что не знает, а не подставляет чужой код.',
  ],
];

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(name, rows) {
  const body = rows.map((row) => row.map(csvEscape).join(';')).join('\r\n');
  writeFileSync(join(dir, name), `\uFEFF${body}\r\n`, 'utf8');
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function colName(index) {
  let n = index;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows, widths) {
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const maxCols = Math.max(...rows.map((row) => row.length), 1);
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const style = r === 0 && row.length > 1 ? 1 : 2;
          return `<c r="${colName(c + 1)}${r + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join('');
      const height = r === 0 ? 22 : 48;
      return `<row r="${r + 1}" ht="${height}" customHeight="1">${cells}</row>`;
    })
    .join('');
  const last = `${colName(maxCols)}${rows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${last}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function workbookXml(sheets) {
  const items = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${items}</sheets>
</workbook>`;
}

function workbookRels(sheets) {
  const items = sheets
    .map(
      (sheet, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
</styleSheet>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.data);
    const compressed = deflateRawSync(data);
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, payload);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += local.length + name.length + payload.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, end]);
}

const sheets = [
  { name: 'Как отвечать', rows: howTo, widths: [28, 110] },
  { name: 'Бухгалтеру', rows: accountant, widths: [8, 78, 42, 36] },
  { name: 'Разработчику', rows: platform, widths: [8, 78, 42, 36] },
  { name: 'Не кладём в знания', rows: excluded, widths: [110] },
];

const files = [
  { name: '[Content_Types].xml', data: contentTypes },
  { name: '_rels/.rels', data: rootRels },
  { name: 'xl/workbook.xml', data: workbookXml(sheets) },
  { name: 'xl/_rels/workbook.xml.rels', data: workbookRels(sheets) },
  { name: 'xl/styles.xml', data: styles },
  ...sheets.map((sheet, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    data: sheetXml(sheet.rows, sheet.widths),
  })),
];

writeFileSync(join(dir, 'knowledge-questionnaire.xlsx'), zipStore(files));
writeCsv('knowledge-questionnaire-accountant.csv', accountant);
writeCsv('knowledge-questionnaire-platform.csv', platform);
console.log('wrote xlsx and csv');
