import { Message } from "@/types";
import { Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";


interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-semibold">AI</span>
        </div>
      )}

      <div
        className={`max-w-2xl rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-800 text-gray-100 rounded-bl-none"
        }`}
      >
        {message.toolName && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-600">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400">
              Using: {message.toolName}
            </span>
          </div>
        )}

        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="text-sm mb-2">{children}</p>,
              ul: ({ children }) => (
                <ul className="text-sm list-disc list-inside mb-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="text-sm list-decimal list-inside mb-2">
                  {children}
                </ol>
              ),
              code: ({ children }) => (
                <code className="bg-gray-900 px-2 py-1 rounded text-xs font-mono">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-gray-900 p-3 rounded mb-2 overflow-x-auto">
                  {children}
                </pre>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        <span className="text-xs opacity-60 mt-2 block">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-semibold">You</span>
        </div>
      )}
    </div>
  );
}
