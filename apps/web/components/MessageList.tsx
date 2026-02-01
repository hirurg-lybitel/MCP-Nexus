import { useRef, useEffect } from "react";
import { Loader } from "lucide-react";
import MessageItem from "./MessageItem";
import { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
      {messages.length === 0 && !loading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="text-6xl">💬</div>
            <p className="text-gray-400 text-lg">
              Start a conversation with AI assistant
            </p>
            <p className="text-gray-500 text-sm">
              Ask anything and watch the AI use available tools
            </p>
          </div>
        </div>
      )}

      {messages.map((message, idx) => (
        <MessageItem key={`${message.id}_${idx}`} message={message} />
      ))}

      {loading && (
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
          <div className="bg-gray-800 rounded-lg px-4 py-3 max-w-md">
            <p className="text-gray-300 text-sm">Thinking...</p>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
