# ✅ Clock Kanban Plugin - Plan de développement

## Objectif
Créer un plugin Obsidian avec un Kanban board personnalisé qui fait du "clock-in/clock-out" automatique via le plugin Day Planner lorsqu'on déplace des tâches vers/sort de la colonne "Working".

## Architecture

### 1. Colonnes du Kanban (standard)
- **TODO** - Tâches à faire
- **Working** - Tâches en cours (clock-in automatique)
- **Stopped** - Tâches en pause (clock-out automatique)
- **Done** - Tâches terminées (clock-out automatique)

### 2. Intégration plugins
- **obsidian-tasks-plugin** : Source des tâches
  ```typescript
  const tasks = this.app.plugins.plugins['obsidian-tasks-plugin'].getTasks();
  ```
- **obsidian-day-planner** : Clock-in/clock-out
  ```typescript
  app.commands.executeCommandById("obsidian-day-planner:clock-in")
  app.commands.executeCommandById("obsidian-day-planner:clock-out")
  ```

## ✅ Fichiers créés

### [x] 1. manifest.json
- Plugin Clock Kanban configuré

### [x] 2. package.json
- Plugin renommé avec dépendances

### [x] 3. main.ts
- Class `ClockKanbanPlugin` extends Plugin
- Gestion des settings
- Commandes (open, refresh, clock-in/out)
- Intégration Day Planner (commandes + timestamps)
- Méthodes `clockIn()` et `clockOut()`

### [x] 4. ClockKanbanSettings.ts
- Interface `ClockKanbanSettings`
- Paramètres: dayPlannerIntegration, autoClockIn, autoClockOut, showCompletedTasks, timeFormat, useDayPlannerCommands
- Onglet de configuration UI

### [x] 5. KanbanView.ts
- Vue personnalisée `KanbanView` extends ItemView
- Rendu HTML des 4 colonnes
- Gestion drag & drop native (HTML5)
- Chargement des tâches depuis obsidian-tasks-plugin
- Mise à jour des statuts dans les fichiers

### [x] 6. types.ts
- `KanbanColumnType`: 'TODO' | 'Working' | 'Stopped' | 'Done'
- `KanbanTask` interface complète
- `DEFAULT_COLUMNS` configuration
- Types pour drag & drop et résultats

### [x] 7. styles.css
- Container Kanban (flex)
- 4 colonnes avec couleurs distinctes
- Tâches draggable avec hover effects
- Highlight colonne Working (bleu)
- Indicateur clock-in (⏱️ animé)
- Responsive design
- Scrollbars personnalisées

### [x] 8. README.md
- Documentation complète
- Installation (npm + manuel)
- Utilisation et workflow
- Configuration des options
- Dépannage

## Logique métier implémentée

### ✅ Drag & Drop Events
1. **dragstart** sur une tâche → stocker l'id et colonne source
2. **dragover** sur une colonne → highlight visuel
3. **drop** sur une colonne →
   - Récupérer la tâche
   - Déterminer colonne source et cible
   - **SI source = Working** → clock-out automatique
   - **SI cible = Working** → clock-in automatique
   - Mettre à jour le statut dans le fichier
   - Re-render du Kanban

### ✅ Intégration Day Planner (2 méthodes)
```typescript
// Méthode 1: Commandes Day Planner
app.commands.executeCommandById("obsidian-day-planner:clock-in")
app.commands.executeCommandById("obsidian-day-planner:clock-out")

// Méthode 2: Timestamps dans les tâches
"- [ ] 09:15 Task name"          // clock-in
"- [x] 09:15-10:30 Task name"    // clock-out avec range
```

## Comment utiliser

### Installation
```bash
npm install
npm run build
```

Puis copier dans votre vault Obsidian:
```
cp main.js styles.css manifest.json /path/to/vault/.obsidian/plugins/clock-kanban/
```

### Utilisation
1. Activer le plugin dans Obsidian
2. Ouvrir la Command Palette (`Ctrl+P`)
3. Taper "Open Clock Kanban"
4. Glisser-déposer les tâches entre colonnes
5. Le clock-in/out se fait automatiquement !

## Build et test
- `npm run dev` pour le développement (watch)
- `npm run build` pour la production

## ✅ Fonctionnalités livrées
- [x] Kanban board 4 colonnes (TODO, Working, Stopped, Done)
- [x] Drag & Drop HTML5 natif
- [x] Intégration obsidian-tasks-plugin
- [x] Clock-in automatique sur entrée Working
- [x] Clock-out automatique sur sortie Working
- [x] Intégration Day Planner (commandes + timestamps)
- [x] Mise à jour des fichiers sources (statuts)
- [x] Paramètres configurables
- [x] Styles CSS modernes et responsives

## 📝 Prochaines améliorations possibles
- [ ] Filtres par tags/projet
- [ ] Vue calendrier
- [ ] Statistiques de temps
- [ ] Synchronisation multi-appareils
5. Le clock-in/out se fait automatiquement !

## Build et test
- `npm run dev` pour le développement (watch)
- `npm run build` pour la production

## ✅ Fonctionnalités livrées
- [x] Kanban board 4 colonnes (TODO, Working, Stopped, Done)
- [x] Drag & Drop HTML5 natif
- [x] Intégration obsidian-tasks-plugin
- [x] Clock-in automatique sur entrée Working
- [x] Clock-out automatique sur sortie Working
- [x] Intégration Day Planner (commandes + timestamps)
- [x] Mise à jour des fichiers sources (statuts)
- [x] Paramètres configurables
- [x] Styles CSS modernes et responsives

## 📝 Prochaines améliorations possibles
- [ ] Filtres par tags/projet
- [ ] Vue calendrier
- [ ] Statistiques de temps
- [ ] Synchronisation multi-appareils

