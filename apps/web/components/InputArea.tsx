import { Send, X } from "lucide-react";
import Button from "./basic/Button";

interface InputAreaProps {
  disabled?: boolean;
  input: string;
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onClearMessage: () => void;
}

export default function InputArea({
  input,
  loading,
  disabled = false,
  onChange,
  onKeyDown,
  onSendMessage,
  onClearMessage
}: InputAreaProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 shadow-lg">
      <div className="flex gap-3 items-end relative">
        <textarea
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message or / for commands... (Shift+Enter for new line)"
          disabled={disabled || loading}
          rows={4}
          className="flex-1 bg-gray-800 text-white px-4 py-3 pr-16 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder-gray-500 border border-gray-700"
        />

        <div className="absolute flex flex-col gap-3 right-4 bottom-4">
          <Button
            disabled={disabled || loading || !input.trim()}
            onClick={onClearMessage}
            variant="secondary"
            className="bg-transparent! shadow-none p-2.5! border-0! disabled:opacity-0!"
          >
            <X className="w-5 h-5" />                
          </Button>

          <Button
            disabled={disabled || loading || !input.trim()}
            onClick={onSendMessage}
            className="p-2.5! disabled:opacity-0!"
          >
            <Send className="w-5 h-5" />            
          </Button>
        </div>
        
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Tip: The AI can use available tools to answer your questions
      </div>
    </div>
  );
}
