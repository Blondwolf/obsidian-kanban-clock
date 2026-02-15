/**
 * Clock Kanban plugin for Obsidian
 * Kanban board with automatic clock-in/clock-out via Day Planner
 */
import { Plugin, WorkspaceLeaf, TFile, moment, Notice, debounce, MarkdownView } from 'obsidian';
import { KanbanView, VIEW_TYPE_CLOCK_KANBAN } from './KanbanView';
import { ClockKanbanSettings, ClockKanbanSettingTab, DEFAULT_SETTINGS } from './ClockKanbanSettings';
import type { KanbanTask, KanbanColumnType } from './types';

/** Main plugin class */
export default class ClockKanbanPlugin extends Plugin {
    settings: ClockKanbanSettings;
    private kanbanView: KanbanView | null = null;
    private modificationQueue: Map<string, Promise<void>> = new Map();

    async onload(): Promise<void> {
        console.log('Loading Clock Kanban plugin');

        // Load settings
        await this.loadSettings();

        // Register Kanban view
        this.registerView(
            VIEW_TYPE_CLOCK_KANBAN,
            (leaf: WorkspaceLeaf) => {
                this.kanbanView = new KanbanView(leaf, this);
                return this.kanbanView;
            }
        );

        // Command to open Kanban
        this.addCommand({
            id: 'open-clock-kanban',
            name: 'Open Clock Kanban',
            callback: () => this.openKanbanView(),
        });

        // Add ribbon icon
        this.addRibbonIcon('kanban', 'Open Clock Kanban', () => {
            this.openKanbanView();
        });

        // Command to refresh Kanban
        this.addCommand({
            id: 'refresh-clock-kanban',
            name: 'Refresh Clock Kanban',
            callback: () => this.refreshKanbanView(),
        });

        // Manual clock-in command
        this.addCommand({
            id: 'manual-clock-in',
            name: 'Manual Clock In (Current Task)',
            callback: () => this.manualClockIn(),
        });

        // Manual clock-out command
        this.addCommand({
            id: 'manual-clock-out',
            name: 'Manual Clock Out (Current Task)',
            callback: () => this.manualClockOut(),
        });

        // Add settings tab
        this.addSettingTab(new ClockKanbanSettingTab(this.app, this));

        // Reopen view if it was open
        this.app.workspace.onLayoutReady(() => {
            this.checkAndReopenView();
        });

        // Auto-refresh when Kanban view becomes active
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && leaf.view.getViewType() === VIEW_TYPE_CLOCK_KANBAN) {
                    this.refreshKanbanView();
                }
            })
        );

        console.log('Clock Kanban plugin loaded');
    }

    onunload(): void {
        console.log('Unloading Clock Kanban plugin');
        this.kanbanView = null;
    }

    /** Load settings from storage */
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /** Save settings */
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /** Open Kanban view */
    async openKanbanView(): Promise<void> {
        const { workspace } = this.app;

        // Check if view already exists
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLOCK_KANBAN)[0];

        if (!leaf) {
            // Create new leaf in main area
            leaf = workspace.getLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_CLOCK_KANBAN });
        }

        workspace.revealLeaf(leaf);
    }

    /** Refresh Kanban view */
    async refreshKanbanView(): Promise<void> {
        if (this.kanbanView) {
            await this.kanbanView.refresh();
            new Notice('Clock Kanban refreshed');
        } else {
            // Try to find existing view
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLOCK_KANBAN);
            if (leaves.length > 0) {
                const view = leaves[0].view as KanbanView;
                await view.refresh();
                new Notice('Clock Kanban refreshed');
            }
        }
    }

    /** Check and reopen view if needed */
    private async checkAndReopenView(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLOCK_KANBAN);
        if (leaves.length > 0) {
            // View exists, update it
            const view = leaves[0].view as KanbanView;
            await view.refresh();
        }
    }

    /**
     * Perform clock-in for a task
     * Via Day Planner command or direct modification
     */
    async clockIn(task: KanbanTask): Promise<void> {
        try {
            if (!this.settings.autoClockInOut) {
                return;
            }

            // Perform clock-in via property
            await this.manageClockProperty(task, 'start');

            new Notice(`⏱️ Clock In: ${task.description.substring(0, 40)}...`);
            console.log(`Clock-in for task: ${task.id}`);
        } catch (error) {
            console.error('Error during clock-in:', error);
            new Notice('Failed to clock in. Is Day Planner installed?');
        }
    }

    /**
     * Perform clock-out for a task
     * Via Day Planner command or direct modification
     */
    async clockOut(task: KanbanTask): Promise<void> {
        try {
            if (!this.settings.autoClockInOut) {
                return;
            }

            // Perform clock-out via property
            await this.manageClockProperty(task, 'end');

            new Notice(`⏹️ Clock Out: ${task.description.substring(0, 40)}...`);
            console.log(`Clock-out for task: ${task.id}`);
        } catch (error) {
            console.error('Error during clock-out:', error);
            new Notice('Failed to clock out. Is Day Planner installed?');
        }
    }

    /**
     * Manage clock property [clock::...] on the line below the task
     */
    private async manageClockProperty(task: KanbanTask, type: 'start' | 'end'): Promise<void> {
        await this.queueFileAction(task.sourcePath, async () => {
            try {
                const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
                if (!(file instanceof TFile)) return;

                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                // Robust task identification: find current line number
                let currentLine = this.findTaskInLines(lines, task.description, task.lineNumber);
                if (currentLine === -1) {
                    console.warn(`Task not found in file: ${task.description}`);
                    return;
                }
                // Update memory status
                task.lineNumber = currentLine;

                const timestamp = moment().format('YYYY-MM-DDTHH:mm:ss');

                if (type === 'start') {
                    const newClock = `[clock::${timestamp}]`;
                    const indentation = '      '; // 6 spaces as requested

                    // Find where to insert: after the task and any existing clock lines
                    let insertIndex = currentLine + 1;
                    while (insertIndex < lines.length && /^\s*(\[clock::[^\]]+\]\s*)+$/.test(lines[insertIndex])) {
                        insertIndex++;
                    }

                    lines.splice(insertIndex, 0, `${indentation}${newClock}`);
                } else {
                    // Find the last open clock line below the task
                    let searchIndex = currentLine + 1;
                    let lastOpenClockIndex = -1;
                    const openClockRegex = /\[clock::((?:(?!\]|--).)+)\]/;

                    while (searchIndex < lines.length && /^\s*(\[clock::[^\]]+\]\s*)+$/.test(lines[searchIndex])) {
                        if (openClockRegex.test(lines[searchIndex])) {
                            lastOpenClockIndex = searchIndex;
                        }
                        searchIndex++;
                    }

                    if (lastOpenClockIndex !== -1) {
                        const line = lines[lastOpenClockIndex];
                        let match: RegExpExecArray | null;
                        let lastMatch: RegExpExecArray | null = null;
                        const regex = new RegExp(openClockRegex, 'g');
                        while ((match = regex.exec(line)) !== null) {
                            lastMatch = match;
                        }

                        if (lastMatch) {
                            const startTime = lastMatch[1];
                            const closedClock = `[clock::${startTime}--${timestamp}]`;
                            const before = line.substring(0, lastMatch.index);
                            const after = line.substring(lastMatch.index + lastMatch[0].length);
                            lines[lastOpenClockIndex] = before + closedClock + after;
                        }
                    }
                }

                await this.app.vault.modify(file, lines.join('\n'));
            } catch (error) {
                console.error('Error managing clock property:', error);
            }
        });
    }

    /** Update task status symbol in file */
    async updateTaskStatus(task: KanbanTask, column: string): Promise<void> {
        await this.queueFileAction(task.sourcePath, async () => {
            try {
                const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
                if (!(file instanceof TFile)) return;

                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                // Robust task identification
                let currentLine = this.findTaskInLines(lines, task.description, task.lineNumber);
                if (currentLine === -1) return;
                task.lineNumber = currentLine;

                const line = lines[currentLine];

                // Determine new status based on column config
                const colConfig = this.settings.columns.find(c => c.name === column);
                let newStatus = colConfig?.symbol || ' ';

                // Replace status in line
                const updatedLine = line.replace(/- \[([^\]])\]/, `- [${newStatus}]`);

                if (updatedLine !== line) {
                    lines[currentLine] = updatedLine;
                    await this.app.vault.modify(file, lines.join('\n'));
                }
            } catch (error) {
                console.error('Error updating task status:', error);
            }
        });
    }

    /** Helper to queue file actions sequentially */
    private async queueFileAction(path: string, action: () => Promise<void>): Promise<void> {
        const currentAction = this.modificationQueue.get(path) || Promise.resolve();
        const nextAction = currentAction.then(action).catch(err => {
            console.error(`Error in modification queue for ${path}:`, err);
        });
        this.modificationQueue.set(path, nextAction);
        return nextAction;
    }

    /** Helper to find task line in content precisely */
    private findTaskInLines(lines: string[], description: string, startIndex: number): number {
        // 1. Check if it's still at the original position
        if (startIndex >= 0 && startIndex < lines.length) {
            if (lines[startIndex].includes(description) && lines[startIndex].includes('- [')) {
                return startIndex;
            }
        }

        // 2. Scan file for a matching task line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(description) && lines[i].includes('- [')) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Check if a task has an open clock property below it
     */
    async checkIfTaskIsClockedIn(task: KanbanTask): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
            if (!(file instanceof TFile)) return false;

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            if (task.lineNumber < 0 || task.lineNumber >= lines.length) return false;

            let searchIndex = task.lineNumber + 1;
            const openClockRegex = /\[clock::((?:(?!\]|--).)+)\]/;

            while (searchIndex < lines.length && /^\s*(\[clock::[^\]]+\]\s*)+$/.test(lines[searchIndex])) {
                if (openClockRegex.test(lines[searchIndex])) {
                    return true;
                }
                searchIndex++;
            }
        } catch (error) {
            console.error('Error checking clock status:', error);
        }
        return false;
    }

    /** Manual clock-in for active task */
    private async manualClockIn(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        // Try to find task in Kanban view
        if (this.kanbanView) {
            const workingTasks = this.kanbanView.tasks.filter(t => t.column === 'Working');
            if (workingTasks.length > 0) {
                await this.clockIn(workingTasks[0]);
            } else {
                new Notice('No task in Working column');
            }
        }
    }

    /** Manual clock-out for active task */
    private async manualClockOut(): Promise<void> {
        if (this.kanbanView) {
            const workingTasks = this.kanbanView.tasks.filter(t => t.column === 'Working');
            if (workingTasks.length > 0) {
                await this.clockOut(workingTasks[0]);
            } else {
                new Notice('No task in Working column');
            }
        }
    }

    /**
     * Move task to specific column
     * Can be used by other plugins or commands
     */
    async moveTaskToColumn(taskId: string, column: KanbanColumnType): Promise<boolean> {
        if (!this.kanbanView) {
            return false;
        }

        const task = this.kanbanView.tasks.find(t => t.id === taskId);
        if (!task) {
            return false;
        }

        const sourceColumn = task.column;
        await this.kanbanView.handleTaskMove(task, sourceColumn, column);
        return true;
    }
}
