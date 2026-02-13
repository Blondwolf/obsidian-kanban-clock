/**
 * Custom Kanban view for Obsidian
 * Displays tasks in drag & drop columns
 */
import { ItemView, WorkspaceLeaf, TFile, moment, Notice } from 'obsidian';
import type ClockKanbanPlugin from './main';
import type { KanbanTask, KanbanColumnType, KanbanColumnConfig } from './types';
import { DEFAULT_COLUMNS } from './types';

/** Unique view identifier */
export const VIEW_TYPE_CLOCK_KANBAN = 'clock-kanban-view';

/** Custom Kanban view */
export class KanbanView extends ItemView {
    plugin: ClockKanbanPlugin;
    containerEl: HTMLElement;
    tasks: KanbanTask[] = [];
    columns: KanbanColumnConfig[] = DEFAULT_COLUMNS;
    draggedTaskId: string | null = null;
    draggedSourceColumn: KanbanColumnType | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ClockKanbanPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CLOCK_KANBAN;
    }

    getDisplayText(): string {
        return 'Clock Kanban';
    }

    getIcon(): string {
        return 'kanban'; // Obsidian Kanban icon
    }

    async onOpen(): Promise<void> {
        this.containerEl = this.contentEl.createDiv({ cls: 'clock-kanban-container' });
        await this.loadTasks();
        this.render();
    }

    async onClose(): Promise<void> {
        // Cleanup if needed
        return Promise.resolve();
    }

    /** Load tasks from obsidian-tasks-plugin */
    async loadTasks(): Promise<void> {
        try {
            const appAny = this.app as any;
            const tasksPlugin = appAny.plugins?.plugins?.['obsidian-tasks-plugin'];
            if (!tasksPlugin) {
                new Notice('Tasks plugin not found. Please install obsidian-tasks-plugin.');
                this.tasks = [];
                return;
            }

            const rawTasks = tasksPlugin.getTasks?.() || [];
            this.tasks = this.parseTasks(rawTasks);

            // Second pass: check for active clocks in the vault to force Working column
            for (const task of this.tasks) {
                if (await this.plugin.checkIfTaskIsClockedIn(task)) {
                    task.isClockedIn = true;
                    task.column = 'Working';
                }
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            new Notice('Error loading tasks from Tasks plugin');
            this.tasks = [];
        }
    }

    /** Parse Tasks plugin tasks to Kanban format */
    parseTasks(rawTasks: any[]): KanbanTask[] {
        return rawTasks.map((task: any, index: number) => {
            // Determine column based on status
            let column: KanbanColumnType = 'TODO';
            const status = task.status?.type || task.status || 'TODO';

            // Map Tasks status to columns
            if (status === 'DONE' || status === 'done' || status === 'x' || status === 'X') {
                column = 'Done';
            } else if (status === 'IN_PROGRESS' || status === 'in_progress' || task.isClockedIn) {
                column = 'Working';
            } else if (status === 'CANCELLED' || status === 'cancelled' || status === '-') {
                column = 'Stopped';
            }

            return {
                id: task.id || `${task.path}-${task.lineNumber || index}`,
                description: task.description || task.text || 'Untitled Task',
                column: column,
                status: this.mapStatus(status),
                sourcePath: task.path || task.sourcePath || '',
                lineNumber: task.lineNumber || 0,
                priority: task.priority,
                tags: task.tags || [],
                dueDate: task.dueDate,
                isClockedIn: task.isClockedIn || column === 'Working',
                startTime: task.startTime,
                endTime: task.endTime,
            };
        }).filter((task: KanbanTask) => {
            // Filter completed tasks if option is disabled
            if (!this.plugin.settings.showCompletedTasks && task.column === 'Done') {
                return false;
            }
            return true;
        });
    }

    /** Map Tasks plugin status to our status */
    mapStatus(tasksStatus: string): 'todo' | 'in_progress' | 'done' | 'cancelled' {
        const status = String(tasksStatus).toUpperCase();
        switch (status) {
            case 'DONE':
            case 'X':
                return 'done';
            case 'IN_PROGRESS':
                return 'in_progress';
            case 'CANCELLED':
            case '-':
                return 'cancelled';
            case 'TODO':
            case ' ':
            default:
                return 'todo';
        }
    }

    /** Main Kanban render */
    render(): void {
        this.containerEl.empty();

        // Header with refresh button
        const header = this.containerEl.createDiv({ cls: 'clock-kanban-header' });
        header.createEl('h2', { text: 'Clock Kanban' });

        const refreshBtn = header.createEl('button', {
            cls: 'clock-kanban-refresh',
            text: '🔄 Refresh'
        });
        refreshBtn.addEventListener('click', async () => {
            await this.loadTasks();
            this.render();
            new Notice('Kanban refreshed');
        });

        // Columns container
        const board = this.containerEl.createDiv({ cls: 'clock-kanban-board' });

        this.columns.forEach(column => {
            this.renderColumn(board, column);
        });
    }

    /** Render a column */
    renderColumn(container: HTMLElement, column: KanbanColumnConfig): void {
        const columnEl = container.createDiv({
            cls: 'clock-kanban-column',
            attr: { 'data-column': column.type }
        });

        // Column header
        const header = columnEl.createDiv({ cls: 'clock-kanban-column-header' });
        header.style.borderTop = `3px solid ${column.color}`;

        const titleEl = header.createEl('h3', { text: column.name });

        // Task counter
        const columnTasks = this.tasks.filter(t => t.column === column.type);
        const counter = header.createSpan({
            cls: 'clock-kanban-counter',
            text: `(${columnTasks.length})`
        });

        // Highlight if Working
        if (column.type === 'Working') {
            columnEl.addClass('clock-kanban-working-column');
        }

        // Tasks container
        const tasksContainer = columnEl.createDiv({
            cls: 'clock-kanban-tasks-container'
        });

        // Add tasks to this column
        columnTasks.forEach(task => {
            this.renderTask(tasksContainer, task);
        });

        // Drag & drop events on column
        this.setupColumnDragEvents(columnEl, column.type);
    }

    /** Render a task */
    renderTask(container: HTMLElement, task: KanbanTask): void {
        const taskEl = container.createDiv({
            cls: 'clock-kanban-task',
            attr: { 'data-task-id': task.id, 'draggable': 'true' }
        });

        // Clock-in indicator
        if (task.isClockedIn) {
            taskEl.addClass('clock-kanban-task-active');
            const indicator = taskEl.createDiv({ cls: 'clock-kanban-indicator' });
            indicator.setText('⏱️');
        }

        // Task content
        const content = taskEl.createDiv({ cls: 'clock-kanban-task-content' });

        // Task text
        const desc = content.createDiv({ cls: 'clock-kanban-task-desc' });
        desc.setText(task.description);

        // Metadata
        const meta = content.createDiv({ cls: 'clock-kanban-task-meta' });

        // Tags
        if (task.tags && task.tags.length > 0) {
            const tagsEl = meta.createDiv({ cls: 'clock-kanban-task-tags' });
            task.tags.forEach(tag => {
                tagsEl.createSpan({ cls: 'clock-kanban-tag', text: tag });
            });
        }

        // Priority
        if (task.priority && task.priority !== 'none' as any && task.priority !== '3' as any) {
            const priorityColors: Record<string, string> = {
                low: '#6b7280',
                medium: '#f59e0b',
                high: '#ef4444'
            };
            const priorityEl = meta.createSpan({
                cls: 'clock-kanban-priority',
                text: `!${task.priority.charAt(0).toUpperCase()}`
            });
            priorityEl.style.color = priorityColors[task.priority] || '#6b7280';
        }

        // Due date
        if (task.dueDate) {
            const dueEl = meta.createSpan({ cls: 'clock-kanban-due' });
            dueEl.setText(`📅 ${task.dueDate}`);
        }

        // Drag & drop events
        this.setupTaskDragEvents(taskEl, task);

        // Double-click to open task
        taskEl.addEventListener('dblclick', () => {
            this.openTask(task);
        });
    }

    /** Setup drag events on a task */
    setupTaskDragEvents(taskEl: HTMLElement, task: KanbanTask): void {
        taskEl.addEventListener('dragstart', (e: DragEvent) => {
            this.draggedTaskId = task.id;
            this.draggedSourceColumn = task.column;
            taskEl.addClass('clock-kanban-dragging');

            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
            }
        });

        taskEl.addEventListener('dragend', () => {
            taskEl.removeClass('clock-kanban-dragging');
            this.draggedTaskId = null;
            this.draggedSourceColumn = null;

            // Clean up highlights
            document.querySelectorAll('.clock-kanban-column-dragover').forEach(el => {
                el.removeClass('clock-kanban-column-dragover');
            });
        });
    }

    /** Setup drag events on a column */
    setupColumnDragEvents(columnEl: HTMLElement, columnType: KanbanColumnType): void {
        columnEl.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            columnEl.addClass('clock-kanban-column-dragover');
        });

        columnEl.addEventListener('dragleave', () => {
            columnEl.removeClass('clock-kanban-column-dragover');
        });

        columnEl.addEventListener('drop', async (e: DragEvent) => {
            e.preventDefault();
            columnEl.removeClass('clock-kanban-column-dragover');

            if (!this.draggedTaskId || !this.draggedSourceColumn) {
                return;
            }

            // Prevent drop on same column
            if (this.draggedSourceColumn === columnType) {
                return;
            }

            // Find task
            const task = this.tasks.find(t => t.id === this.draggedTaskId);
            if (!task) {
                return;
            }

            // Handle move
            await this.handleTaskMove(task, this.draggedSourceColumn, columnType);
        });
    }

    /** Handle moving a task between columns */
    async handleTaskMove(
        task: KanbanTask,
        sourceColumn: KanbanColumnType,
        targetColumn: KanbanColumnType
    ): Promise<void> {
        const settings = this.plugin.settings;

        // 1. Clock-out if leaving Working
        if (sourceColumn === 'Working' && settings.autoClockOut && settings.dayPlannerIntegration) {
            await this.plugin.clockOut(task);
            task.isClockedIn = false;
            task.endTime = moment().format(settings.timeFormat);
        }

        // 2. Clock-in if entering Working
        if (targetColumn === 'Working' && settings.autoClockIn && settings.dayPlannerIntegration) {
            await this.plugin.clockIn(task);
            task.isClockedIn = true;
            task.startTime = moment().format(settings.timeFormat);
        }

        // 3. Update task column
        task.column = targetColumn;

        // 4. Update status in source file
        await this.updateTaskStatus(task, targetColumn);

        // 5. Re-render
        this.render();

        // Notification
        new Notice(`Moved "${task.description.substring(0, 30)}..." to ${targetColumn}`);
    }

    /** Update task status in source file */
    async updateTaskStatus(task: KanbanTask, column: KanbanColumnType): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
            if (!(file instanceof TFile)) {
                return;
            }

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            if (task.lineNumber < 0 || task.lineNumber >= lines.length) {
                return;
            }

            const line = lines[task.lineNumber];

            // Determine new status
            let newStatus = ' ';
            if (column === 'Done') {
                newStatus = 'x';
            } else if (column === 'Stopped') {
                newStatus = '-';
            } else if (column === 'Working' || column === 'TODO') {
                newStatus = ' ';
            }

            // Replace status in line
            const updatedLine = line.replace(/- \[([ xX/-])\]/, `- [${newStatus}]`);

            if (updatedLine !== line) {
                lines[task.lineNumber] = updatedLine;
                await this.app.vault.modify(file, lines.join('\n'));
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            new Notice('Failed to update task status in file');
        }
    }

    /** Open task in its source file */
    openTask(task: KanbanTask): void {
        const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
        if (file instanceof TFile) {
            this.app.workspace.openLinkText(file.path, '', false);
        }
    }

    /** Refresh view */
    async refresh(): Promise<void> {
        await this.loadTasks();
        this.render();
    }
}
