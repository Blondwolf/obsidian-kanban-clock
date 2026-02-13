/**
 * Clock Kanban plugin for Obsidian
 * Kanban board with automatic clock-in/clock-out via Day Planner
 */
import { App, Plugin, WorkspaceLeaf, TFile, moment, Notice } from 'obsidian';
import { KanbanView, VIEW_TYPE_CLOCK_KANBAN } from './KanbanView';
import { ClockKanbanSettings, ClockKanbanSettingTab, DEFAULT_SETTINGS } from './ClockKanbanSettings';
import type { KanbanTask, KanbanColumnType } from './types';

/** Main plugin class */
export default class ClockKanbanPlugin extends Plugin {
    settings: ClockKanbanSettings;
    private kanbanView: KanbanView | null = null;
    
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
        const existingLeaf = workspace.getLeavesOfType(VIEW_TYPE_CLOCK_KANBAN)[0];
        if (existingLeaf) {
            workspace.revealLeaf(existingLeaf);
            return;
        }

        // Create new leaf in main area
        const leaf = workspace.getRightLeaf(false);
        if (!leaf) {
            new Notice('Could not create Kanban view');
            return;
        }
        await leaf.setViewState({ type: VIEW_TYPE_CLOCK_KANBAN });
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
            if (!this.settings.dayPlannerIntegration) {
                return;
            }

            // Option 1: Use Day Planner commands
            if (this.settings.useDayPlannerCommands) {
                await this.executeDayPlannerCommand('clock-in');
            }
            else{
                // Option 2: Add timestamp to task
                await this.addTimestampToTask(task, 'start');
            }

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
            if (!this.settings.dayPlannerIntegration) {
                return;
            }

            // Option 1: Use Day Planner commands
            if (this.settings.useDayPlannerCommands) {
                await this.executeDayPlannerCommand('clock-out');
            }

            // Option 2: Add timestamp to task
            await this.addTimestampToTask(task, 'end');

            new Notice(`⏹️ Clock Out: ${task.description.substring(0, 40)}...`);
            console.log(`Clock-out for task: ${task.id}`);
        } catch (error) {
            console.error('Error during clock-out:', error);
            new Notice('Failed to clock out. Is Day Planner installed?');
        }
    }

    /**
     * Execute Day Planner command
     */
    private async executeDayPlannerCommand(command: 'clock-in' | 'clock-out'): Promise<void> {
        const appAny = this.app as any;

        // Attendre que le layout soit prêt
        await new Promise<void>(resolve => {
            if (this.app.workspace.layoutReady) {
                resolve();
            } else {
                this.app.workspace.onLayoutReady(() => resolve());
            }
        });

        // Vérifier que Day Planner est chargé
        const dayPlanner = appAny.plugins.getPlugin('obsidian-day-planner');
        if (!dayPlanner) {
            console.warn('Day Planner plugin not found');
            return;
        }

        const commandId = `obsidian-day-planner:${command}`;
        const success = appAny.commands.executeCommandById(commandId);

        if (!success) {
            console.warn(`Command ${commandId} not found or failed to execute`);
        } else {
            console.log(`Command ${commandId} executed successfully`);
        }
    }


    /**
     * Add timestamp to task in Day Planner format
     * Format: "- [ ] HH:mm Task description"
     */
    private async addTimestampToTask(task: KanbanTask, type: 'start' | 'end'): Promise<void> {
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
            const timestamp = moment().format(this.settings.timeFormat);

            // Check if timestamp already exists
            const timestampRegex = new RegExp(`^(- \[.\]) (\d{2}:\d{2}) `);
            
            let updatedLine: string;
            if (timestampRegex.test(line)) {
                // Replace existing timestamp
                if (type === 'end') {
                    // For clock-out, add range: "09:00-10:30"
                    const match = line.match(/^(- \[.\]) (\d{2}:\d{2}) /);
                    if (match) {
                        const startTime = match[2];
                        updatedLine = line.replace(timestampRegex, `$1 ${startTime}-${timestamp} `);
                    } else {
                        updatedLine = line;
                    }
                } else {
                    updatedLine = line.replace(timestampRegex, `$1 ${timestamp} `);
                }
            } else {
                // Add new timestamp
                updatedLine = line.replace(/^(- \[.\]) /, `$1 ${timestamp} `);
            }

            if (updatedLine !== line) {
                lines[task.lineNumber] = updatedLine;
                await this.app.vault.modify(file, lines.join('\n'));
            }
        } catch (error) {
            console.error('Error adding timestamp:', error);
        }
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
