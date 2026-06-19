'use client';

import { Zap, ChevronDown, DatabaseZap } from "lucide-react";
import { useCallback, useState } from "react";
import ToolViewer from "./ToolViewer";
import { Tool } from "@/types";
import { GptFunctions } from "@/lib/openai/functions";
import { useTranslations } from "@/lib/i18n/use-translations";

interface ToolsPanelProps {
  tools: Tool[];
}

export default function ToolsPanel({ tools }: ToolsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const { t } = useTranslations();

  const handleCloseTool = () => setSelectedTool(null);

  const isOpenAiTool = useCallback((id: string) => GptFunctions.some(f => f.function.name === id), []);

  return (
    <div
      className={`shrink-0 bg-gray-900 border-r border-t border-gray-800 transition-all duration-300 ${
        isOpen ? "w-72" : "w-16"
      } overflow-hidden flex flex-col h-full`}
    >
      <div className={`flex items-center ${isOpen ? "justify-between" : "justify-center"} p-4 border-b border-gray-800`}>
        {isOpen && (
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <h2 className="text-sm font-bold text-white">{t('tools.title')}</h2>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              !isOpen ? "-rotate-90" : ""
            }`}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className="group"
            title={isOpen ? "" : tool.description}
          >
            <button
              onClick={() => setSelectedTool(tool)}
              className={`w-full p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-left ${
                !isOpen ? "flex items-center justify-center" : ""
              }`}
            >
              {isOpen ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2" title={isOpenAiTool(tool.name) ? t('tools.hostTool') : t('tools.mcpTool')}>
                    {isOpenAiTool(tool.name) ? <Zap className="w-4 h-4 text-yellow-500 shrink-0" /> : <DatabaseZap className="w-4 h-4 text-yellow-500 shrink-0" />}
                    <h3 className="text-xs font-semibold text-white truncate">
                      {tool.name}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              ) : (
                isOpenAiTool(tool.name) ? <Zap className="w-4 h-4 text-yellow-500" /> : <DatabaseZap className="w-4 h-4 text-yellow-500" />
              )}
            </button>
          </div>
        ))}

        {tools.length === 0 && isOpen && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">{t('tools.noTools')}</p>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="p-3 border-t border-gray-800 bg-gray-800/50">
          <p className="text-xs text-gray-400 text-center">
            {tools.length === 1
              ? t('tools.countOne', { count: tools.length })
              : t('tools.countMany', { count: tools.length })}
          </p>
        </div>
      )}

      {selectedTool && (
        <ToolViewer tool={selectedTool} onClose={handleCloseTool} />
      )}
    </div>
  );
}
