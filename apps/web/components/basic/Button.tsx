'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'sm' | 'md'
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-all duration-300 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950';
  
  const variants = {
    primary: 'bg-blue-600 text-gray-300 hover:bg-blue-500 focus:ring-white shadow-lg shadow-white/5',
    secondary: 'bg-blue-600/5 text-gray-300 border border-white/10 hover:bg-blue-600/10 hover:text-white focus:ring-gray-500',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white focus:ring-red-500',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-4 text-base tracking-wide',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
