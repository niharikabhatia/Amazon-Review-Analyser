import React from 'react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  children,
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-[#ff9900] text-[#232f3e] hover:bg-[#db8a00] shadow-sm font-black uppercase tracking-widest',
    secondary: 'bg-[#146eb4] text-white hover:bg-[#0e5a96] shadow-sm font-black uppercase tracking-widest',
    outline: 'bg-transparent border-2 border-[#ff9900] text-[#232f3e] hover:bg-[#ff9900]/5 font-black uppercase tracking-widest',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 font-black uppercase tracking-widest',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm font-medium',
    lg: 'px-8 py-4 text-base font-medium',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};


export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('bg-white border border-zinc-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden', className)}>
    {children}
  </div>
);

export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider', className)}>
    {children}
  </span>
);
