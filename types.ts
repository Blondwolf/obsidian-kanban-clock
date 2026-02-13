/**
 * Types and interfaces for Clock Kanban plugin
 */

/** Kanban column types */
export type KanbanColumnType = string;

/** Kanban task interface */
export interface KanbanTask {
    /** Unique task identifier */
    id: string;
    /** Task description/text */
    description: string;
    /** Current task column */
    column: KanbanColumnType;
    /** Task status (from Tasks plugin) */
    status: TaskStatus;
    /** Start time (if clock-in performed) */
    startTime?: string;
    /** End time (if clock-out performed) */
    endTime?: string;
    /** Source file path */
    sourcePath: string;
    /** Line number in source file */
    lineNumber: number;
    /** Priority (optional, from Tasks plugin) */
    priority?: 'low' | 'medium' | 'high';
    /** Associated tags */
    tags: string[];
    /** Due date (optional) */
    dueDate?: string;
    /** Indicates if task has active clock-in */
    isClockedIn: boolean;
}

/** Possible task statuses */
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

/** Kanban column configuration */
export interface KanbanColumnConfig {
    type: string;
    name: string;
    color: string;
    symbol: string;
}

/** Default columns configuration */
export const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
    { type: 'TODO', name: 'TODO', color: '#6b7280', symbol: ' ' },
    { type: 'Working', name: 'Working', color: '#3b82f6', symbol: ' ' },
    { type: 'Stopped', name: 'Stopped', color: '#f59e0b', symbol: '-' },
    { type: 'Done', name: 'Done', color: '#10b981', symbol: 'x' },
];

/** Drag & drop event */
export interface DragDropEvent {
    taskId: string;
    sourceColumn: KanbanColumnType;
    targetColumn: KanbanColumnType;
    timestamp: Date;
}

/** Clock-in/clock-out operation result */
export interface ClockOperationResult {
    success: boolean;
    taskId: string;
    operation: 'clock-in' | 'clock-out';
    timestamp: string;
    error?: string;
}
