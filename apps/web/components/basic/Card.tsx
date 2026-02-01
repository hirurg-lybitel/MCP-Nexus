interface CardProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
  }

export default function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`bg-gray-900/40 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl ${className}`}>
      {title && (
        <h3 className="text-xl font-bold mb-4 text-white tracking-tight">
          {title}
        </h3>
      )}
      <div className="text-gray-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}