/**
 * Clock Kanban plugin settings management
 */
import { App, PluginSettingTab, Setting, ToggleComponent, TextComponent } from 'obsidian';
import type ClockKanbanPlugin from './main';

/** Plugin settings interface */
export interface ClockKanbanSettings {
    /** Enable Day Planner integration */
    dayPlannerIntegration: boolean;
    /** Enable automatic clock-in */
    autoClockIn: boolean;
    /** Enable automatic clock-out */
    autoClockOut: boolean;
    /** Show completed tasks */
    showCompletedTasks: boolean;
    /** Time format (Day Planner: HH:mm) */
    timeFormat: string;
    /** Use Day Planner command or modify task directly */
    useDayPlannerCommands: boolean;
    /** Regex to identify task (default: checkbox markdown) */
    taskRegex: string;
}

/** Default settings */
export const DEFAULT_SETTINGS: ClockKanbanSettings = {
    dayPlannerIntegration: true,
    autoClockIn: true,
    autoClockOut: true,
    showCompletedTasks: false,
    timeFormat: 'HH:mm',
    useDayPlannerCommands: true,
    taskRegex: '- \\[([ xX-])\\]',
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

        // Section: Day Planner Integration
        containerEl.createEl('h3', { text: 'Day Planner Integration' });

        new Setting(containerEl)
            .setName('Enable Day Planner Integration')
            .setDesc('Automatically clock in/out when moving tasks to/from Working column')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.dayPlannerIntegration)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.dayPlannerIntegration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use Day Planner Commands')
            .setDesc('Use obsidian-day-planner commands for clock-in/out. If disabled, will add timestamps directly to tasks.')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.useDayPlannerCommands)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.useDayPlannerCommands = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Clock In')
            .setDesc('Automatically clock in when moving a task to Working column')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.autoClockIn)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.autoClockIn = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Clock Out')
            .setDesc('Automatically clock out when moving a task out of Working column')
            .addToggle((toggle: ToggleComponent) => toggle
                .setValue(this.plugin.settings.autoClockOut)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.autoClockOut = value;
                    await this.plugin.saveSettings();
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

        // Section: Advanced
        containerEl.createEl('h3', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Task Regex Pattern')
            .setDesc('Regex pattern to identify tasks (default: checkbox markdown)')
            .addText((text: TextComponent) => text
                .setPlaceholder('- \\[([ xX-])\\]')
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
