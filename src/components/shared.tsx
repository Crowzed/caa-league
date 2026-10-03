'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'gold' | 'default';
}

export function StatCard({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  trend,
  trendValue,
  className,
  color = 'default',
}: StatCardProps) {
  const displaySub = subtitle || description;
  const colorClasses = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    green: 'border-green-500/30 bg-green-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    gold: 'border-amber-500/30 bg-amber-500/5',
    default: 'border-zinc-800 bg-zinc-900/50',
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    gold: 'text-amber-400',
    default: 'text-zinc-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-lg border backdrop-blur p-4',
        colorClasses[color],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {displaySub && (
            <p className="text-sm text-zinc-500 mt-0.5">{displaySub}</p>
          )}
          {trend && trendValue && (
            <p className={cn(
              'text-xs mt-1 flex items-center gap-1',
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-zinc-400'
            )}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              {trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'p-2 rounded-lg bg-zinc-800/50',
            iconColorClasses[color]
          )}>
            {React.isValidElement(Icon) ? (
              Icon
            ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon) ? (
              React.createElement(Icon as React.ElementType, { className: "h-5 w-5" })
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, description, action, className }: SectionHeaderProps) {
  const displaySub = subtitle || description;
  return (
    <div className={cn('flex items-end justify-between mb-6', className)}>
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {displaySub && (
          <p className="text-sm text-zinc-400 mt-1">{displaySub}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, description, breadcrumbs, action }: PageHeaderProps) {
  const displaySub = subtitle || description;
  return (
    <div className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur">
      <div className="container mx-auto px-4 py-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-blue-400 transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-zinc-300">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-end justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-4xl font-bold text-white"
            >
              {title}
            </motion.h1>
            {displaySub && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-zinc-400 mt-2"
              >
                {displaySub}
              </motion.p>
            )}
          </div>
          {action && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {action}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
          {React.isValidElement(Icon) ? (
            Icon
          ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon) ? (
            React.createElement(Icon as React.ElementType, { className: "h-8 w-8 text-zinc-500" })
          ) : null}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-400 mt-1 max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
