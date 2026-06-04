import type { Components } from 'react-markdown';

export const chatMarkdownComponents: Components = {
  p: ({ children }) => <p className="text-sm mb-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="text-sm list-disc list-inside mb-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm list-decimal list-inside mb-2">{children}</ol>
  ),
  code: ({ children }) => (
    <code className="bg-gray-900 px-2 py-1 rounded text-xs font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 p-3 rounded mb-2 overflow-x-auto">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto max-w-full min-w-0 my-3 rounded-lg border border-gray-600/80 shadow-inner bg-gray-900/40">
      <table className="min-w-max text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-700/80">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2.5 font-semibold text-left text-gray-200 border-b border-gray-600 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-100 border-t border-gray-700/50 align-top whitespace-normal break-words max-w-md">
      {children}
    </td>
  ),
  tr: ({ children }) => <tr className="even:bg-gray-800/30">{children}</tr>,
};
