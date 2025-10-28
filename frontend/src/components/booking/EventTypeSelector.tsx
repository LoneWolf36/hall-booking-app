/**
 * Event Type Selector Component
 * 
 * Grid of event type cards for user selection.
 * Displays icons and descriptions for each event type.
 */

'use client';

import { cn } from '@/lib/utils';
import type { EventType } from '@/stores';
import {
  HeartIcon,
  BriefcaseIcon,
  CakeIcon,
  PresentationIcon,
  PartyPopperIcon,
  CalendarIcon,
} from 'lucide-react';

const EVENT_TYPES: Array<{
  value: EventType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    value: 'wedding',
    label: 'Wedding',
    description: 'Wedding ceremony and reception',
    icon: HeartIcon,
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-950',
  },
  {
    value: 'corporate',
    label: 'Corporate Event',
    description: 'Business meetings and events',
    icon: BriefcaseIcon,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  },
  {
    value: 'birthday',
    label: 'Birthday Party',
    description: 'Birthday celebrations',
    icon: CakeIcon,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
  },
  {
    value: 'conference',
    label: 'Conference',
    description: 'Conferences and seminars',
    icon: PresentationIcon,
    color: 'text-green-600 bg-green-50 dark:bg-green-950',
  },
  {
    value: 'party',
    label: 'Party',
    description: 'Social gatherings and parties',
    icon: PartyPopperIcon,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other types of events',
    icon: CalendarIcon,
    color: 'text-gray-600 bg-gray-50 dark:bg-gray-950',
  },
];

export interface EventTypeSelectorProps {
  value: EventType | null;
  onChange: (value: EventType) => void;
  error?: string;
  className?: string;
}

/**
 * Event type selector with visual cards
 */
export function EventTypeSelector({
  value,
  onChange,
  error,
  className,
}: EventTypeSelectorProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {EVENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={cn(
                'relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all',
                'hover:border-primary/50 hover:shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                {
                  'border-primary bg-primary/5': isSelected,
                  'border-muted': !isSelected,
                  'border-destructive': error && !value,
                }
              )}
              aria-pressed={isSelected}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                  isSelected ? type.color : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              {/* Label */}
              <div className="text-center space-y-1">
                <p className={cn('font-medium text-sm', { 'text-primary': isSelected })}>
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {type.description}
                </p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3 w-3"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}
