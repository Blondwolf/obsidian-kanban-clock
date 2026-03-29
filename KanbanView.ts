/**
 * Custom Kanban view for Obsidian
 * Displays tasks in drag & drop columns
 */
import { ItemView, WorkspaceLeaf, TFile, TFolder, TAbstractFile, moment, Notice } from 'obsidian';
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
    columns: KanbanColumnConfig[] = [];
    draggedTaskId: string | null = null;
    draggedSourceColumn: KanbanColumnType | null = null;
    private isTodayFilterActive: boolean = false;

    private normalizePath(path: string): string {
        if (!path || path === '/') return '/';
        const p = path.startsWith('/') ? path : '/' + path;
        return p.replace(/\/+/g, '/');
    }

    private getFsPath(path: string): string {
        const normalized = this.normalizePath(path);
        return normalized.startsWith('/') ? normalized.substring(1) : normalized;
    }

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
        this.columns = this.plugin.settings.columns;
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

            // Second pass: check for active clocks in the vault to force into the clock column
            for (const task of this.tasks) {
                if (await this.plugin.checkIfTaskIsClockedIn(task)) {
                    task.isClockedIn = true;
                    task.column = this.plugin.settings.clockColumn;
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
        const columns = this.plugin.settings.columns;
        return rawTasks.map((task: any, index: number) => {
            // Get symbol from Tasks plugin task
            // The symbol is usually in task.status.symbol or task.status if it's a string
            const symbol = task.status?.symbol || (typeof task.status === 'string' ? task.status : ' ');

            // Find column matching the symbol
            const matchingCol = columns.find(c => c.symbol === symbol);

            // Default to the first column if no match found
            let column = matchingCol ? matchingCol.name : (columns[0]?.name || 'TODO');

            // If it's x but no matching column found, try to find a column named 'Done'
            if (!matchingCol && (symbol === 'x' || symbol === 'X')) {
                const doneCol = columns.find(c => c.name.toLowerCase() === 'done');
                if (doneCol) column = doneCol.name;
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
                isClockedIn: task.isClockedIn || column === this.plugin.settings.clockColumn,
                startTime: task.startTime,
                endTime: task.endTime,
            };
        }).filter((task: KanbanTask) => {
            // Today filter
            if (this.isTodayFilterActive) {
                if (!task.dueDate) return false;
                const today = moment().format('YYYY-MM-DD');
                return task.dueDate === today;
            }
            return true;
        }).filter((task: KanbanTask) => {
            // Folder exclusion
            const excludedFolders = this.plugin.settings.excludedFolders;
            if (excludedFolders && excludedFolders.length > 0) {
                for (const folder of excludedFolders) {
                    if (!folder) continue;
                    // Normalize folder: remove leading slash if present (Obsidian paths don't start with /)
                    const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
                    // Check if path starts with folder + / to ensure it's a sub-directory match, 
                    // or exact match if folder is the same as task source path (though tasks are in files)
                    if (task.sourcePath.startsWith(normalizedFolder)) {
                        return false;
                    }
                }
            }
            return true;
        }).filter((task: KanbanTask) => {
            // Folder filtering
            const folderFilter = this.plugin.settings.folderFilter;
            if (folderFilter && folderFilter !== '/') {
                const normalizedFilter = this.getFsPath(folderFilter);
                if (!task.sourcePath.startsWith(normalizedFilter)) {
                    return false;
                }
            }
            return true;
        }).filter((task: KanbanTask) => {
            // Filter completed tasks if option is disabled
            // Find if current column matches a 'done' symbol
            const colConfig = this.plugin.settings.columns.find(c => c.name === task.column);
            const isDone = colConfig?.symbol === 'x' || colConfig?.symbol === 'X';

            if (!this.plugin.settings.showCompletedTasks && isDone) {
                return false;
            }
            return true;
        });
    }

    /** Map Tasks plugin status to our status */
    mapStatus(tasksStatus: string | any): 'todo' | 'in_progress' | 'done' | 'cancelled' {
        // Handle both string and task objects
        const symbol = typeof tasksStatus === 'object' ? tasksStatus.symbol : String(tasksStatus);
        const status = symbol.toUpperCase();

        switch (status) {
            case 'X':
                return 'done';
            case '/': // Common in-progress symbol
                return 'in_progress';
            case '-':
                return 'cancelled';
            case ' ':
            default:
                // Check if symbol matches our working column
                const clockCol = this.plugin.settings.columns.find(c => c.name === this.plugin.settings.clockColumn);
                if (clockCol && symbol === clockCol.symbol) {
                    return 'in_progress';
                }
                return 'todo';
        }
    }

    /** Main Kanban render */
    render(): void {
        this.containerEl.empty();

        // Header with refresh button
        const header = this.containerEl.createDiv({ cls: 'clock-kanban-header' });
        header.createEl('h2', { text: 'Clock Kanban' });


        // Center: Refresh button
        const refreshBtn = header.createEl('button', {
            cls: 'clock-kanban-refresh',
            text: '🔄 Refresh'
        });
        refreshBtn.addEventListener('click', async () => {
            await this.loadTasks();
            this.render();
            if (this.plugin.settings.debugMessages) {
                new Notice('Kanban refreshed');
            }
        });

        // Right side: Grouped controls (Today + Filter)
        const rightControls = header.createDiv({ cls: 'clock-kanban-header-right' });

        // "Today" button (to the left of the filter)
        const todayBtn = rightControls.createEl('button', {
            cls: 'clock-kanban-today' + (this.isTodayFilterActive ? ' active' : ''),
            text: '📅 Today'
        });
        todayBtn.addEventListener('click', async () => {
            this.isTodayFilterActive = !this.isTodayFilterActive;
            await this.loadTasks();
            this.render();
        });

        // Folder filter input (Interactive Navigation)
        const filterContainer = rightControls.createDiv({ cls: 'clock-kanban-filter-container' });
        filterContainer.createSpan({ text: '📁' });

        const filterSelect = filterContainer.createEl('select');
        filterSelect.style.marginLeft = '5px';
        filterSelect.style.padding = '4px 8px';
        filterSelect.style.borderRadius = '4px';
        filterSelect.style.border = '1px solid var(--background-modifier-border)';

        this.plugin.settings.folderFilter = this.normalizePath(this.plugin.settings.folderFilter || '/');
        const currentPath = this.plugin.settings.folderFilter;
        const currentFile = this.app.vault.getAbstractFileByPath(this.getFsPath(currentPath));

        let navigationFolder: TFolder;
        if (currentFile instanceof TFile && currentFile.parent) {
            navigationFolder = currentFile.parent;
        } else if (currentFile instanceof TFolder) {
            navigationFolder = currentFile;
        } else {
            navigationFolder = this.app.vault.getRoot();
        }

        // 1. Current Full Path (Selected but hidden from dropdown list)
        const currentOption = filterSelect.createEl('option', {
            value: currentPath,
            text: currentPath
        });
        currentOption.selected = true;
        currentOption.style.display = 'none';

        // 2. Parent Navigation
        if (navigationFolder.path !== '' && navigationFolder.path !== '/') {
            const parentPath = navigationFolder.parent?.path || '';
            const normalizedParent = this.normalizePath(parentPath);

            filterSelect.createEl('option', {
                value: normalizedParent,
                text: `⤴️ .. (${navigationFolder.parent?.name || 'Root'})`
            });
        }

        // 3. Current Navigation Folder (Show if we are filtering a file within it)
        const navPath = this.normalizePath(navigationFolder.path);
        if (currentPath !== navPath) {
            filterSelect.createEl('option', {
                value: navPath,
                text: `📁 ${navigationFolder.name || '/ (Root)'}`
            });
        }

        // 4. Subfolders and Files
        try {
            const children = [...navigationFolder.children].sort((a, b) => a.name.localeCompare(b.name));

            children.forEach(child => {
                const childPath = this.normalizePath(child.path);
                if (child instanceof TFolder) {
                    // Check if folder is excluded
                    const isExcluded = this.plugin.settings.excludedFolders.some(folder => {
                        if (!folder) return false;
                        const normalizedFolder = folder.startsWith('/') ? folder : `/${folder}`;
                        return childPath === normalizedFolder || childPath.startsWith(normalizedFolder + '/');
                    });
                    if (isExcluded) return;

                    filterSelect.createEl('option', {
                        value: childPath,
                        text: `📁 ${child.name}`
                    });
                } else if (child instanceof TFile && child.extension === 'md') {
                    filterSelect.createEl('option', {
                        value: childPath,
                        text: `📄 ${child.name}`
                    });
                }
            });
        } catch (e) {
            console.warn('Could not list subfolders or files', e);
        }

        filterSelect.addEventListener('change', async (e) => {
            const val = (e.target as HTMLSelectElement).value;
            if (!val) return;
            this.isTodayFilterActive = false; // Disable today filter when specific folder is selected
            this.plugin.settings.folderFilter = this.normalizePath(val);
            await this.plugin.saveSettings();
            await this.loadTasks();
            this.render();
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

        // Highlight if it's the Auto-Clock column
        if (column.name === this.plugin.settings.clockColumn) {
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

        // 1. Clock-out if leaving the clock column
        if (sourceColumn === settings.clockColumn && targetColumn !== settings.clockColumn && settings.autoClockInOut) {
            await this.plugin.clockOut(task);
            task.isClockedIn = false;
            task.endTime = moment().format(settings.timeFormat);
        }

        // 2. Clock-in if entering the clock column
        if (targetColumn === settings.clockColumn && sourceColumn !== settings.clockColumn && settings.autoClockInOut) {
            await this.plugin.clockIn(task);
            task.isClockedIn = true;
            task.startTime = moment().format(settings.timeFormat);
        }

        // 3. Update task column
        task.column = targetColumn;

        // 4. Update status in source file
        await this.plugin.updateTaskStatus(task, targetColumn);

        // 5. Re-render
        this.render();

        // Notification
        if (this.plugin.settings.debugMessages) {
            new Notice(`Moved "${task.description.substring(0, 30)}..." to ${targetColumn}`);
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
        this.columns = this.plugin.settings.columns;
        await this.loadTasks();
        this.render();
    }
}
