/**
 * Clock Kanban plugin settings management
 */
import { App, PluginSettingTab, Setting, ToggleComponent, TextComponent, ButtonComponent } from 'obsidian';
import type ClockKanbanPlugin from './main';
import { DEFAULT_COLUMNS, KanbanColumnConfig } from './types';

/** Plugin settings interface */
export interface ClockKanbanSettings {
    /** Enable automatic clock-in/out */
    autoClockInOut: boolean;
    /** The column that triggers clock-in when entered and clock-out when exited */
    clockColumn: string;
    /** Show completed tasks */
    showCompletedTasks: boolean;
    /** Time format (Day Planner: HH:mm) */
    timeFormat: string;
    /** Use Day Planner command or modify task directly (Deprecated/Future API) */
    useDayPlannerCommands: boolean;
    /** Regex to identify task (default: checkbox markdown) */
    taskRegex: string;
    /** Folder filter for tasks (e.g. /toto) */
    folderFilter: string;
    /** Customizable columns */
    columns: KanbanColumnConfig[];
    /** Show non-essential notices (debug mode) */
    debugMessages: boolean;
}

/** Default settings */
export const DEFAULT_SETTINGS: ClockKanbanSettings = {
    autoClockInOut: true,
    clockColumn: 'Working',
    showCompletedTasks: false,
    timeFormat: 'HH:mm',
    useDayPlannerCommands: false,
    taskRegex: '- \\[([^\\t\\n\\r])\\]',
    folderFilter: '',
    columns: [...DEFAULT_COLUMNS],
    debugMessages: false,
};

/** Plugin settings tab */
export class ClockKanbanSettingTab extends PluginSettingTab {
    plugin: ClockKanbanPlugin;

    constructor(app: App, plugin: ClockKanbanPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Clock Kanban Settings' });

        // Section: Core Logic
        containerEl.createEl('h3', { text: 'Core Logic' });

        new Setting(containerEl)
            .setName('Auto Clock-in/Clock-out')
            .setDesc('Automatically clock in/out based on task movements')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.autoClockInOut)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.autoClockInOut = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-Clock Column')
            .setDesc('Select the column that should trigger clock-in')
            .addDropdown(dropdown => {
                this.plugin.settings.columns.forEach(col => {
                    dropdown.addOption(col.name, col.name);
                });
                dropdown.setValue(this.plugin.settings.clockColumn);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.clockColumn = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Use Day Planner Commands (Deprecated)')
            .setDesc('Once API available. Currently adding timestamps directly to tasks.')
            .setDisabled(true)
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(false)
                .onChange(async () => {
                    // Disabled
                }));

        // Section: Kanban Columns
        containerEl.createEl('h3', { text: 'Kanban Columns' });
        const columnContainer = containerEl.createDiv('kanban-column-settings');

        this.plugin.settings.columns.forEach((col, index) => {
            const colSetting = new Setting(columnContainer)
                .setName(`Column: ${col.name}`)
                .addText(text => text
                    .setPlaceholder('Column Name')
                    .setValue(col.name)
                    .onChange(async (val) => {
                        col.name = val;
                        col.type = val; // Sync type with name for simplicity
                        await this.plugin.saveSettings();
                    }))
                .addColorPicker(cp => cp
                    .setValue(col.color)
                    .onChange(async (val) => {
                        col.color = val;
                        await this.plugin.saveSettings();
                    }))
                .addText(text => text
                    .setPlaceholder('Symbol (e.g. x, -, /)')
                    .setValue(col.symbol)
                    .onChange(async (val) => {
                        col.symbol = val;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Remove Column')
                    .onClick(async () => {
                        this.plugin.settings.columns.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Add Column')
                .onClick(async () => {
                    this.plugin.settings.columns.push({
                        type: 'New Column',
                        name: 'New Column',
                        color: '#6b7280',
                        symbol: ' '
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Section: Display
        containerEl.createEl('h3', { text: 'Display' });

        new Setting(containerEl)
            .setName('Show Completed Tasks')
            .setDesc('Display tasks marked as done in the Done column')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.showCompletedTasks)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.showCompletedTasks = value;
                    await this.plugin.saveSettings();
                    // Refresh view if open
                    this.plugin.refreshKanbanView();
                }));

        new Setting(containerEl)
            .setName('Time Format')
            .setDesc('Format for timestamps (default: HH:mm for Day Planner compatibility)')
            .addText((text: TextComponent) => text
                .setPlaceholder('HH:mm')
                .setValue(this.plugin.settings.timeFormat)
                .onChange(async (value: string) => {
                    this.plugin.settings.timeFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug Messages')
            .setDesc('Show non-essential notices like "Kanban refreshed" or "Clock In/Out"')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.debugMessages)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.debugMessages = value;
                    await this.plugin.saveSettings();
                }));

        // Section: Advanced
        containerEl.createEl('h3', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Task Regex Pattern')
            .setDesc('Regex pattern to identify tasks (default: checkbox markdown)')
            .addText((text: TextComponent) => text
                .setPlaceholder('- \\[([^\\]])\\]')
                .setValue(this.plugin.settings.taskRegex)
                .onChange(async (value: string) => {
                    this.plugin.settings.taskRegex = value;
                    await this.plugin.saveSettings();
                }));

        // Required plugins info
        containerEl.createEl('h3', { text: 'Required Plugins' });
        const infoEl = containerEl.createEl('div', { cls: 'setting-item-info' });
        infoEl.createEl('div', {
            text: 'This plugin requires the following Obsidian plugins to be installed and enabled:',
            cls: 'setting-item-description'
        });
        const ul = infoEl.createEl('ul');
        ul.createEl('li', { text: 'obsidian-tasks-plugin - for task management' });
        ul.createEl('li', { text: 'obsidian-day-planner (optional) - for clock-in/out integration' });
    }
}
