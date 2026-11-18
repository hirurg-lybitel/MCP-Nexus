import 'D:/Git/MCP-Nexus-v2/apps/web/load-env.ts';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { McpClientAdapter } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/mcp/client.ts';
import { buildSystemPrompt } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/chat/system-prompt.ts';
import { GptFunctions, GptFunctionName } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/openai/functions.ts';
import { isAgentTool } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/agent/tool-names.ts';
import { projectToolResultForModel } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/agent/agent-tool-projector.ts';
import { toolResultPayload } from 'D:/Git/MCP-Nexus-v2/apps/web/lib/chat/tool-result-payload.ts';
import { GPT_MODEL_GENERAL } from 'D:/Git/MCP-Nexus-v2/apps/web/constants/index.ts';

const WEB_ORIGIN = 'http://127.0.0.1:4004';
const MCP_KEY = process.env.MCP_API_KEY?.trim() || '';
const SECURITY_KEY =
  process.env.NEXT_PUBLIC_OPENAI_SECURITY_KEY?.trim() || '';

if (!MCP_KEY || !SECURITY_KEY) {
  console.error('Missing MCP_API_KEY or NEXT_PUBLIC_OPENAI_SECURITY_KEY');
  process.exit(1);
}

type QuestionSpec = {
  id: string;
  group: 'director' | 'accountant' | 'belgiss' | 'complex';
  prompt: string;
};

export const QUESTIONS: QuestionSpec[] = [
  // Director (6)
  {
    id: 'D1',
    group: 'director',
    prompt:
      'Сколько нам должны покупатели и сколько мы должны поставщикам на конец декабря 2025?',
  },
  {
    id: 'D2',
    group: 'director',
    prompt: 'Какая выручка и прибыль (убыток) за 2025 год?',
  },
  {
    id: 'D3',
    group: 'director',
    prompt: 'Кто из покупателей наши крупнейшие должники?',
  },
  {
    id: 'D4',
    group: 'director',
    prompt: 'Есть ли просроченная дебиторка / кому давно не платим?',
  },
  {
    id: 'D5',
    group: 'director',
    prompt:
      'Как изменились остатки денег на расчётных счетах за последний месяц / квартал?',
  },
  {
    id: 'D6',
    group: 'director',
    prompt: 'Где «заморожены» деньги: запасы, незавершёнка, авансы?',
  },

  // Chief Accountant (6)
  {
    id: 'A1',
    group: 'accountant',
    prompt:
      'Оборотно-сальдовая по организации за декабрь 2025 — сверка с привычной ОСВ.',
  },
  {
    id: 'A2',
    group: 'accountant',
    prompt:
      'Развёртка 62 / 60 на конец декабря 2025: долг vs авансы (кредитовое / дебетовое сальдо по клиентам).',
  },
  {
    id: 'A3',
    group: 'accountant',
    prompt:
      'Карта или анализ счёта 90 за 2025 год: выручка, НДС, себестоимость, расходы.',
  },
  {
    id: 'A4',
    group: 'accountant',
    prompt:
      'Журнал-ордер по 51 за декабрь 2025 — крупные поступления и списания.',
  },
  {
    id: 'A5',
    group: 'accountant',
    prompt:
      'Почему сальдо по покупателю X не сходится с актом сверки?',
  },
  {
    id: 'A6',
    group: 'accountant',
    prompt:
      'Какие сохранённые настройки отчётов есть по карте счёта / ОСВ — запусти «как в Гедымине» за декабрь 2025.',
  },

  // BelGISS good phrasings (5)
  {
    id: 'B1',
    group: 'belgiss',
    prompt:
      'Кратко для директора: дебиторка и кредиторка на 28.12.2025, без субсчетов в ответе — итогами.',
  },
  {
    id: 'B2',
    group: 'belgiss',
    prompt:
      'Сравни обороты по 62 за ноябрь и декабрь 2025: отгрузка vs оплаты.',
  },
  {
    id: 'B3',
    group: 'belgiss',
    prompt: 'Топ-10 должников по 62.1 на конец декабря 2025.',
  },
  {
    id: 'B4',
    group: 'belgiss',
    prompt:
      'По счёту 90 за 2025: выручка с НДС, себестоимость, финансовый результат.',
  },
  {
    id: 'B5',
    group: 'belgiss',
    prompt:
      'Покажи ОСВ за декабрь 2025 только по деньгам и расчётам (50–62), без забаланса.',
  },

  // Complex extra questions (2)
  {
    id: 'C1',
    group: 'complex',
    prompt:
      'Сколько затрат в декабре 2025 и как их уменьшить?',
  },
  {
    id: 'C2',
    group: 'complex',
    prompt:
      'Хватает ли денег на расчётных счетах на 31.12.2025, чтобы закрыть все текущие долги поставщикам и по налогам/расчётам с бюджетом?',
  },
];

function extractMcpText(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const content = (response as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      return r.type === 'text' && typeof r.text === 'string' ? r.text : null;
    })
    .filter((p): p is string => Boolean(p));
  return parts.length ? parts.join('\n') : null;
}

async function runAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'create_query_plan') {
    const summary = String(toolInput.summary ?? '').trim();
    if (!summary) return JSON.stringify({ error: 'summary is required', code: 'INVALID_PLAN' });
    return JSON.stringify({
      userIntent: String(toolInput.userIntent ?? ''),
      summary,
      discoverySteps: Array.isArray(toolInput.discoverySteps) ? toolInput.discoverySteps : [],
      tables: Array.isArray(toolInput.tables) ? toolInput.tables : [],
      sqlStrategy: String(toolInput.sqlStrategy ?? ''),
      notes: typeof toolInput.notes === 'string' ? toolInput.notes : undefined,
    });
  }
  if (toolName === 'present_query_result') {
    const res = await fetch(`${WEB_ORIGIN}/api/agent/present-query-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: WEB_ORIGIN,
        Referer: `${WEB_ORIGIN}/chat`,
        Authorization: `Bearer ${MCP_KEY}`,
      },
      body: JSON.stringify(toolInput),
    });
    const text = await res.text();
    return text || JSON.stringify({ error: `HTTP ${res.status}`, code: 'PRESENT_API' });
  }
  return JSON.stringify({ error: `Unknown agent tool ${toolName}` });
}

async function main() {
  const onlyIds = process.argv.slice(2);
  const selected = onlyIds.length
    ? QUESTIONS.filter((q) => onlyIds.includes(q.id))
    : QUESTIONS;

  const client = new McpClientAdapter(`${WEB_ORIGIN}/api/mcp`, {
    authToken: MCP_KEY,
  });
  await client.connect();
  const toolsResult = await client.listTools();
  let serverInstructions = client.getInstructions() ?? null;
  if (!serverInstructions) {
    const ir = await fetch(`${WEB_ORIGIN}/api/mcp/instructions`, {
      headers: { Authorization: `Bearer ${MCP_KEY}` },
    });
    const ib = (await ir.json()) as { instructions?: string };
    serverInstructions = ib.instructions ?? null;
  }

  const mcpTools = toolsResult.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const systemPrompt = buildSystemPrompt({
    locale: 'ru',
    serverInstructions,
  });

  const outPath =
    process.env.PILOT_OUT || 'D:/Git/MCP-Nexus-v2/apps/web/scripts/pilot-eval-results.json';

  const existing: Record<string, Record<string, unknown>> = {};
  if (existsSync(outPath)) {
    try {
      for (const item of JSON.parse(readFileSync(outPath, 'utf8'))) {
        if (item?.id) existing[String(item.id)] = item;
      }
    } catch {
      // ignore
    }
  }

  for (const q of selected) {
    const started = Date.now();
    console.log(`\n=== [${q.id}] ${q.prompt} ===`);
    const toolTrace: Array<{
      name: string;
      args: unknown;
      durationMs: number;
      isError: boolean;
      resultPreview: string;
    }> = [];

    const conversationMessages: Array<Record<string, unknown>> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: q.prompt },
    ];

    let finalAnswer = '';
    let turnError: string | null = null;
    let steps = 0;

    try {
      const callOpenAi = async () => {
        const res = await fetch(`${WEB_ORIGIN}/api/openai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: WEB_ORIGIN,
            Referer: `${WEB_ORIGIN}/chat`,
          },
          body: JSON.stringify({
            ...GPT_MODEL_GENERAL,
            tools: [...GptFunctions, ...mcpTools],
            messages: conversationMessages,
            security_key: SECURITY_KEY,
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`);
        }
        return JSON.parse(text);
      };

      let data = await callOpenAi();

      while (
        data.choices?.[0]?.finish_reason === 'tool_calls' &&
        data.choices[0].message?.tool_calls &&
        steps < 14
      ) {
        steps += 1;
        const toolCalls = data.choices[0].message.tool_calls;
        conversationMessages.push({
          role: 'assistant',
          content: data.choices[0].message.content || 'Вызов инструментов...',
          tool_calls: toolCalls.map((tc: any) => ({
            type: 'function',
            id: tc.id,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });

        for (const tc of toolCalls) {
          const tStart = Date.now();
          const toolName: string = tc.function.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }

          let payloadStr = '';
          let isErr = false;

          try {
            if (toolName === GptFunctionName.Horoscope) {
              payloadStr = JSON.stringify({ horoscope: 'n/a' });
            } else if (isAgentTool(toolName)) {
              payloadStr = await runAgentTool(toolName, args);
              if (payloadStr.includes('"error"')) isErr = true;
            } else {
              const resp = await client.callTool(toolName, args);
              const rec = resp as Record<string, unknown>;
              if (rec?.isError) {
                isErr = true;
                const errTxt = extractMcpText(resp) ?? 'unknown';
                payloadStr = JSON.stringify({
                  error: `Tool execution failed. ${errTxt}`,
                });
              } else {
                payloadStr = toolResultPayload(resp);
              }
            }
          } catch (err: any) {
            isErr = true;
            payloadStr = JSON.stringify({
              error: `Tool execution failed. ${err?.message ?? String(err)}`,
            });
          }

          const dMs = Date.now() - tStart;
          console.log(
            `  -> ${toolName}(${JSON.stringify(args).slice(0, 120)}) [${dMs}ms] err=${isErr}`
          );
          toolTrace.push({
            name: toolName,
            args,
            durationMs: dMs,
            isError: isErr,
            resultPreview: payloadStr.slice(0, 800),
          });

          conversationMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: projectToolResultForModel(toolName, payloadStr),
          });
        }

        data = await callOpenAi();
      }

      finalAnswer = String(data.choices?.[0]?.message?.content ?? '');
    } catch (err: any) {
      turnError = err?.message ?? String(err);
      console.error(`  [ERROR] ${turnError}`);
    }

    const totalMs = Date.now() - started;
    console.log(`  <= [${totalMs}ms] ${finalAnswer.slice(0, 220).replace(/\s+/g, ' ')}`);

    existing[q.id] = {
      ...q,
      totalMs,
      turnError,
      steps,
      toolTrace,
      finalAnswer,
    };

    writeFileSync(
      outPath,
      JSON.stringify(
        QUESTIONS.map((item) => existing[item.id]).filter(Boolean),
        null,
        2
      ),
      'utf8'
    );
  }

  await client.disconnect();
  console.log(`\nSaved results to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

