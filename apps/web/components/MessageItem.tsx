'use client';

import { TODO_MESSAGE_ID } from "@/constants";
import { ExecutionStep, Message } from "@/types";
import { ListTodo, Loader, Square, SquareCheckBig } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DataTableView from "./DataTableView";
import QueryPlanView from "./QueryPlanView";
import ToolCallPanel from "./ToolCallPanel";
import { chatMarkdownComponents } from "@/lib/chat/markdown-components";
import { stripMarkdownTables } from "@/lib/chat/strip-markdown-tables";
import TurnUsageFooter from "./TurnUsageFooter";
import { useLocaleStore } from "@/stores/useLocaleStore";
import { localeToBcp47 } from "@/lib/i18n/types";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useDeveloperModeStore } from "@/stores/useDeveloperModeStore";


interface MessageItemProps {
  message: Message;
  /** Hide GFM tables when data was already shown via present_query_result. */
  stripMarkdownTables?: boolean;
}

export default function MessageItem({
  message,
  stripMarkdownTables: stripTables = false,
}: MessageItemProps) {
  const isUser = message.role === "user";
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useTranslations();
  const developerMode = useDeveloperModeStore((s) => s.developerMode);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(localeToBcp47(locale), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const isToolPanel = Boolean(message.toolName);
  const markdownContent =
    stripTables && message.content.trim()
      ? stripMarkdownTables(message.content, locale)
      : message.content;
  const hasBody =
    Boolean(message.tableData) ||
    Boolean(message.planData) ||
    message.id === TODO_MESSAGE_ID ||
    message.content.trim().length > 0 ||
    isToolPanel;

  return (
    <div
      aria-label="Message Item"
      className={`flex gap-3 min-w-0 w-full ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-semibold">{t('message.ai')}</span>
        </div>
      )}

      <div
        className={`rounded-lg px-4 min-w-0 ${
          hasBody ? "py-3" : "py-2"
        } ${message.tableData || message.planData || isToolPanel ? "max-w-full flex-1" : "max-w-2xl"} ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-800 text-gray-100 rounded-bl-none"
        }`}
      >
        {isToolPanel ? (
          <ToolCallPanel
            toolName={message.toolName!}
            toolInput={message.toolInput}
            toolResult={message.toolResult}
            developerMode={developerMode}
          />
        ) : message.planData ? (
          <QueryPlanView data={message.planData} />
        ) : message.tableData ? (
          <DataTableView data={message.tableData} />
        ) : message.id === TODO_MESSAGE_ID
          ? ((() => {
            let steps: ExecutionStep[] | undefined;
            try {
              steps = JSON.parse(message.content)?.steps;
            } catch (err) {
              console.error(`Failed to parse message content: ${err}`);
            }

            return (
              <div className="rounded-lg my-2 space-y-2">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-yellow-400" />
                  <h4 className="text-sm font-medium text-yellow-400">{t('plan.todo')}</h4>
                  <span className="text-xs opacity-60">{steps?.length}</span>
                </div>
                {steps?.map((step: ExecutionStep) => (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    {step.status === 'running' && <Loader className="w-4 h-4 animate-spin" />}
                    {step.status === 'completed' && <SquareCheckBig className="w-4 h-4" />}
                    {step.status === 'pending' && <Square className="w-4 h-4" />}
                    <span className={step.status === 'completed' ? 'line-through text-slate-400' : ''}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()
            
          )
          : hasBody ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={chatMarkdownComponents}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          ) : null}

        

        {!isToolPanel && (
          <>
            {message.usageMeta && !isUser && (
              <TurnUsageFooter meta={message.usageMeta} />
            )}
            <span className="text-xs opacity-60 mt-2 block">
              {formatTime(message.timestamp)}
            </span>
          </>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-semibold">{t('message.you')}</span>
        </div>
      )}
    </div>
  );
}
