// import React, { useMemo, useState, useEffect } from 'react';
// import { Plus, X, GripVertical, Calendar, Flag } from 'lucide-react';
// import { update } from 'firebase/database';
// import { database } from '../../../firebase';
// import { ref } from 'firebase/database';
// import { toast } from 'react-hot-toast';
// import { cn } from '../../../lib/utils';
// import { exportReport } from '@/utils/reportUtils';

// interface Task {
//   id: string;
//   title: string;
//   status: string;
//   priority: string;
//   dueDate?: string;
//   assignedTo?: string;
//   assignedToName?: string;
//   sprint?: string;
// }

// interface SprintBoardProps {
//   tasks: Task[];
//   projectId: string;
//   readOnly?: boolean;
//   onTaskUpdate?: () => void;
// }

// const DEFAULT_SPRINTS = ['Backlog', 'Sprint 1', 'Sprint 2', 'Completed'];

// const priorityColor: Record<string, string> = {
//   urgent: 'bg-red-100 text-red-700 border-red-200',
//   high: 'bg-orange-100 text-orange-700 border-orange-200',
//   medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
//   low: 'bg-green-100 text-green-700 border-green-200',
// };

// const statusBadge: Record<string, string> = {
//   pending: 'bg-gray-100 text-gray-700',
//   in_progress: 'bg-blue-100 text-blue-700',
//   completed: 'bg-green-100 text-green-700',
//   review: 'bg-purple-100 text-purple-700',
//   not_started: 'bg-gray-100 text-gray-500',
// };

//  const SprintBoard: React.FC<SprintBoardProps> = ({ 
//   tasks, 
//   projectId, 
//   readOnly = false,
//   onTaskUpdate 
// }) => {
//   const [customSprints, setCustomSprints] = useState<string[]>([]);
//   const [newSprint, setNewSprint] = useState('');
//   const [adding, setAdding] = useState(false);
//   const [draggedId, setDraggedId] = useState<string | null>(null);
//   const [hoverSprint, setHoverSprint] = useState<string | null>(null);
//   const [localTasks, setLocalTasks] = useState<Task[]>([]);

//   useEffect(() => {
//     setLocalTasks(tasks);
//   }, [tasks]);

//   const allSprints = useMemo(
//     () => [...DEFAULT_SPRINTS.slice(0, 3), ...customSprints, 'Completed'],
//     [customSprints],
//   );

//   const grouped = useMemo(() => {
//     const map: Record<string, Task[]> = {};
//     allSprints.forEach(s => (map[s] = []));
//     localTasks.forEach(t => {
//       const sprint = t.sprint || 'Backlog';
//       const key = allSprints.includes(sprint) ? sprint : 'Backlog';
//       map[key].push(t);
//     });
//     return map;
//   }, [localTasks, allSprints]);

//   const addSprint = () => {
//     const name = newSprint.trim();
//     if (!name) return;
//     if (allSprints.some(s => s.toLowerCase() === name.toLowerCase())) {
//       toast.error('Sprint already exists');
//       return;
//     }
//     setCustomSprints(prev => [...prev, name]);
//     setNewSprint('');
//     setAdding(false);
//     toast.success(`"${name}" sprint created`);
//   };

//   const removeSprint = (name: string) => {
//     if (DEFAULT_SPRINTS.includes(name)) {
//       toast.error('Default sprints cannot be removed');
//       return;
//     }
//     if ((grouped[name] || []).length > 0) {
//       toast.error('Move tasks out before removing this sprint');
//       return;
//     }
//     setCustomSprints(prev => prev.filter(s => s !== name));
//     toast.success(`"${name}" removed`);
//   };

//   const onDrop = async (sprint: string) => {
//     if (readOnly) return;
//     if (!draggedId) return;
//     const task = localTasks.find(x => x.id === draggedId);
//     if (!task || (task.sprint || 'Backlog') === sprint) {
//       setDraggedId(null);
//       setHoverSprint(null);
//       return;
//     }
//     setLocalTasks(prev =>
//       prev.map(x =>
//         x.id === draggedId
//           ? {
//               ...x,
//               sprint: sprint === 'Backlog' ? undefined : sprint,
//               status: sprint === 'Completed' ? 'completed' : x.status,
//             }
//           : x,
//       ),
//     );
//     try {
//       await update(ref(database, `projects/${projectId}/tasks/${draggedId}`), {
//         sprint: sprint === 'Backlog' ? null : sprint,
//         status: sprint === 'Completed' ? 'completed' : task.status,
//         updatedAt: new Date().toISOString(),
//       });
//       toast.success(`Task moved to ${sprint}`);
//       onTaskUpdate?.();
//     } catch (error) {
//       console.error(error);
//       toast.error('Failed to move task');
//       setLocalTasks(tasks);
//     }
//     setDraggedId(null);
//     setHoverSprint(null);
//   };

//   const getInitials = (name?: string) => {
//     if (!name) return '?';
//     return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
//   };

//   return (
//     <div className="space-y-4 animate-fade-in">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-xl font-semibold">Sprint Planning</h2>
//           <p className="text-sm text-muted-foreground mt-0.5">
//             Drag tasks between sprints to plan iterations
//           </p>
//         </div>
//         {!readOnly && (
//           adding ? (
//             <div className="flex items-center gap-2">
//               <input
//                 autoFocus
//                 value={newSprint}
//                 onChange={e => setNewSprint(e.target.value)}
//                 onKeyDown={e => {
//                   if (e.key === 'Enter') addSprint();
//                   if (e.key === 'Escape') {
//                     setAdding(false);
//                     setNewSprint('');
//                   }
//                 }}
//                 placeholder="Sprint name"
//                 className="px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
//               />
//               <button
//                 onClick={addSprint}
//                 className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
//               >
//                 Add
//               </button>
//               <button
//                 onClick={() => {
//                   setAdding(false);
//                   setNewSprint('');
//                 }}
//                 className="p-1.5 rounded-md hover:bg-secondary"
//               >
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//           ) : (
//             <button
//               onClick={() => setAdding(true)}
//               className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-secondary transition-colors"
//             >
//               <Plus className="w-4 h-4" />
//               Add Sprint
//             </button>
//           )
//         )}
//       </div>

//       {/* Sprint columns */}
//       <div className="flex gap-4 overflow-x-auto pb-2">
//         {allSprints.map(sprint => {
//           const items = grouped[sprint] || [];
//           const removable = !DEFAULT_SPRINTS.includes(sprint);
//           const isHover = hoverSprint === sprint;
//           return (
//             <div
//               key={sprint}
//               onDragOver={e => {
//                 if (readOnly) return;
//                 e.preventDefault();
//                 if (hoverSprint !== sprint) setHoverSprint(sprint);
//               }}
//               onDragLeave={() => setHoverSprint(prev => (prev === sprint ? null : prev))}
//               onDrop={() => onDrop(sprint)}
//               className={cn(
//                 'w-80 shrink-0 rounded-xl border bg-secondary/30 flex flex-col transition-colors',
//                 isHover && 'bg-primary/5 ring-1 ring-primary/40',
//               )}
//             >
//               <div className="flex items-center justify-between px-3 py-2.5 border-b bg-card rounded-t-xl">
//                 <div className="flex items-center gap-2">
//                   <span className="text-base font-semibold">{sprint}</span>
//                   <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
//                     {items.length}
//                   </span>
//                 </div>
//                 {!readOnly && removable && (
//                   <button
//                     onClick={() => removeSprint(sprint)}
//                     className="p-1 rounded hover:bg-secondary text-muted-foreground"
//                     aria-label="Remove sprint"
//                   >
//                     <X className="w-4 h-4" />
//                   </button>
//                 )}
//               </div>

//               <div className="p-3 space-y-2 flex-1 min-h-[160px]">
//                 {items.length === 0 && (
//                   <div className="h-28 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
//                     Drop tasks here
//                   </div>
//                 )}
//                 {items.map(t => (
//                   <div
//                     key={t.id}
//                     draggable={!readOnly}
//                     onDragStart={() => !readOnly && setDraggedId(t.id)}
//                     onDragEnd={() => {
//                       if (!readOnly) {
//                         setDraggedId(null);
//                         setHoverSprint(null);
//                       }
//                     }}
//                     className={cn(
//                       'group p-3 rounded-lg bg-card border hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
//                       draggedId === t.id && 'opacity-40 rotate-1',
//                     )}
//                   >
//                     <div className="flex items-start justify-between gap-2 mb-2">
//                       <div className="flex items-start gap-2 flex-1 min-w-0">
//                         <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
//                         <p className="text-sm font-medium leading-snug break-words">{t.title}</p>
//                       </div>
//                     </div>

//                     <div className="flex flex-wrap items-center gap-2 mb-2">
//                       <span
//                         className={cn(
//                           'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium',
//                           priorityColor[t.priority] || 'bg-gray-100',
//                         )}
//                       >
//                         <Flag className="w-3 h-3" />
//                         {t.priority}
//                       </span>
//                       <span
//                         className={cn(
//                           'text-xs px-2 py-0.5 rounded-full font-medium',
//                           statusBadge[t.status] || 'bg-gray-100',
//                         )}
//                       >
//                         {t.status?.replace('_', ' ') || 'pending'}
//                       </span>
//                     </div>

//                     <div className="flex items-center justify-between text-xs text-muted-foreground">
//                       <div className="flex items-center gap-1.5">
//                         <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold">
//                           {getInitials(t.assignedToName)}
//                         </div>
//                         <span className="truncate max-w-[90px]">{t.assignedToName || 'Unassigned'}</span>
//                       </div>
//                       {t.dueDate && (
//                         <div className="flex items-center gap-1">
//                           <Calendar className="w-3 h-3" />
//                           {new Date(t.dueDate).toLocaleDateString('en-US', {
//                             month: 'short',
//                             day: 'numeric',
//                           })}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// };
// export default SprintBoard;