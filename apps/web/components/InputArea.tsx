import { Send, X } from "lucide-react";
import Button from "./basic/Button";

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  onSendMessage: () => void;
  onClearMessage: () => void;
}

export default function InputArea({
  input,
  setInput,
  loading,
  onSendMessage,
  onClearMessage
}: InputAreaProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 shadow-lg">
      <div className="flex gap-3 items-end relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Shift+Enter for new line)"
          disabled={loading}
          rows={4}
          className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder-gray-500 border border-gray-700"
        />

        <div className="absolute flex flex-col gap-3 right-4 bottom-4">
          <Button
            disabled={loading || !input.trim()}
            onClick={onClearMessage}
            variant="secondary"
            className="bg-transparent! shadow-none p-2.5! border-0! disabled:opacity-0 disabled:pointer-events-none"
          >
            <X className="w-5 h-5" />                
          </Button>

          <Button
            disabled={loading || !input.trim()}
            onClick={onSendMessage}
            className="p-2.5! disabled:opacity-0 disabled:pointer-events-none"
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
