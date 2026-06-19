'use client';

import { useRef, useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import MessageItem from "./MessageItem";
import { CHAT_CONTENT_MAX_WIDTH } from "@/constants";
import { Message } from "@/types";
import { shouldStripTablesAfterPresentation } from "@/lib/chat/strip-markdown-tables";
import { isToolCallPanelMessage, isToolPanelVisible } from "@/lib/chat/tool-ui";
import { useDeveloperModeStore } from "@/stores/useDeveloperModeStore";
import { useTranslations } from "@/lib/i18n/use-translations";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const developerMode = useDeveloperModeStore((s) => s.developerMode);
  const { t } = useTranslations();

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !isToolCallPanelMessage(message) ||
          isToolPanelVisible(message.toolName!, developerMode)
      ),
    [developerMode, messages]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, loading]);

  return (
    <div className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden py-6 h-full flex justify-center">
      <div
        className={`w-full ${CHAT_CONTENT_MAX_WIDTH} min-w-0 px-6 space-y-4 mx-auto`}
      >
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center min-h-[12rem] mb-0">
            <div className="text-center space-y-4">
              <div className="text-6xl">💬</div>
              <p className="text-gray-400 text-lg">
                {t('chat.emptyTitle')}
              </p>
              <p className="text-gray-500 text-sm">
                {t('chat.emptySubtitle')}
              </p>
            </div>
          </div>
        )}

        {visibleMessages.map((message, idx) => (
          <MessageItem
            key={`${message.id}_${idx}`}
            message={message}
            stripMarkdownTables={shouldStripTablesAfterPresentation(
              visibleMessages,
              idx
            )}
          />
        ))}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Loader className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-3 max-w-md">
              <p className="text-gray-300 text-sm">{t('chat.thinking')}</p>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
