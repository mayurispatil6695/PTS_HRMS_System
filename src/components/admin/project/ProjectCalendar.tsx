import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { update } from 'firebase/database';
import { database } from '../../../firebase';
import { ref } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { cn } from '../../../lib/utils';

interface Task {
  id: string;
  title: string;
  dueDate?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface ProjectCalendarProps {
  tasks: Task[];
  projectId: string;
  readOnly?: boolean;
  onTaskUpdate?: () => void;
}

const statusDot: Record<string, string> = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  not_started: 'bg-gray-400',
  review: 'bg-purple-500',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  not_started: 'Not Started',
  review: 'Review',
};

const isOverdue = (task: Task) =>
  task.status !== 'completed' && task.dueDate && new Date(task.dueDate).getTime() < Date.now();

const ProjectCalendar: React.FC<ProjectCalendarProps> = ({ 
  tasks, 
  projectId, 
  readOnly = false,
  onTaskUpdate 
}) => {
  const [cursor, setCursor] = useState(() => new Date());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), -i);
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), i), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return cells;
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const key = t.dueDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const onDrop = async (key: string) => {
    if (readOnly) return;
    if (!draggedId) return;
    const task = tasks.find(x => x.id === draggedId);
    if (!task || task.dueDate?.slice(0, 10) === key) {
      setDraggedId(null);
      setHoverKey(null);
      return;
    }
    try {
      await update(ref(database, `projects/${projectId}/tasks/${draggedId}`), {
        dueDate: key,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Due date updated');
      onTaskUpdate?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update due date');
    }
    setDraggedId(null);
    setHoverKey(null);
  };

  const todayKey = dateKey(new Date());

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-3 py-1 text-sm font-medium rounded-md hover:bg-secondary transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {Object.entries(statusDot).map(([s, color]) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn('w-3 h-3 rounded-full', color)} />
            <span>{statusLabel[s] || s}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>Overdue</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-secondary/40">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-sm font-medium text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(({ date, inMonth }, i) => {
            const key = dateKey(date);
            const dayTasks = tasksByDate.get(key) || [];
            const isToday = key === todayKey;
            const isHover = hoverKey === key;
            return (
              <div
                key={i}
                onDragOver={e => {
                  if (readOnly) return;
                  e.preventDefault();
                  if (hoverKey !== key) setHoverKey(key);
                }}
                onDragLeave={() => setHoverKey(prev => (prev === key ? null : prev))}
                onDrop={() => onDrop(key)}
                className={cn(
                  'min-h-[110px] p-2 border-b border-r last:border-r-0 transition-colors relative',
                  !inMonth && 'bg-secondary/20',
                  isHover && 'bg-primary/5 ring-1 ring-primary/30 ring-inset',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-sm inline-flex items-center justify-center w-6 h-6 rounded-full',
                      isToday && 'bg-primary text-primary-foreground font-semibold',
                      !isToday && inMonth && 'text-foreground',
                      !inMonth && 'text-muted-foreground/50',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-xs text-muted-foreground">{dayTasks.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map(t => {
                    const overdue = isOverdue(t);
                    const dotColor = overdue ? 'bg-red-500' : statusDot[t.status] || 'bg-gray-400';
                    return (
                      <div
                        key={t.id}
                        draggable={!readOnly}
                        onDragStart={() => !readOnly && setDraggedId(t.id)}
                        onDragEnd={() => {
                          if (!readOnly) {
                            setDraggedId(null);
                            setHoverKey(null);
                          }
                        }}
                        title={t.title}
                        className={cn(
                          'group flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-grab active:cursor-grabbing border truncate',
                          'bg-card hover:bg-secondary transition-colors',
                          overdue ? 'border-red-500/40' : 'border-border',
                          draggedId === t.id && 'opacity-40',
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-2">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          Tip: drag any task card onto a different day to reschedule it.
        </p>
      )}
    </div>
  );
};
export default ProjectCalendar;