import { Tool } from "@/types";
import { X, Zap } from "lucide-react";
import Button from "./basic/Button";

function SchemaViewer({ schema }: { schema: Record<string, unknown> }) {
  const properties = schema.properties as Record<string, any> || {};
  const required = schema.required as string[] || [];

  return (
    <div className="space-y-3 text-xs">
      {Object.entries(properties).length === 0 ? (
        <p className="text-gray-400 italic">No parameters required</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(properties).map(([key, prop]) => (
            <div key={key} className="bg-gray-700/50 rounded p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-300">{key}</span>
                <span className="text-gray-400">
                  {prop.type}
                </span>
                {required.includes(key) && (
                  <span className="px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">
                    Required
                  </span>
                )}
              </div>
              {prop.description && (
                <p className="text-gray-300">{prop.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function ToolViewer({ tool, onClose }: { tool: Tool, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full max-h-96 flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-white">
              {tool.name}
            </h2>
          </div>
          <button
            onClick={() => onClose()}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Description
            </h3>
            <p className="text-sm text-gray-300">
              {tool.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Parameters
            </h3>
            <SchemaViewer schema={tool.inputSchema} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50">
          <Button
            onClick={() => onClose()}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}


