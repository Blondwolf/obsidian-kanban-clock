# ⏱️ Clock Kanban pour Obsidian

Un plugin Kanban personnalisé pour Obsidian avec intégration automatique de **clock-in/clock-out** via le plugin [Day Planner](https://github.com/ivan-lednev/obsidian-day-planner).

## ✨ Fonctionnalités

- **Kanban board** avec 4 colonnes : TODO → Working → Stopped → Done
- **Drag & Drop** intuitif pour déplacer les tâches
- **Clock-in automatique** lorsqu'une tâche est déplacée vers "Working"
- **Clock-out automatique** lorsqu'une tâche sort de "Working"
- **Intégration Day Planner** via commandes ou timestamps
- **Synchronisation** avec le plugin [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)
- **Mise à jour automatique** des statuts de tâches dans les fichiers

## 📋 Prérequis

Ce plugin nécessite l'installation des plugins suivants :

1. **[obsidian-tasks-plugin](https://github.com/obsidian-tasks-group/obsidian-tasks)** - Obligatoire
   - Source des tâches affichées dans le Kanban

2. **[obsidian-day-planner](https://github.com/ivan-lednev/obsidian-day-planner)** - Recommandé
   - Pour l'intégration clock-in/clock-out automatique

## 🚀 Installation

### Méthode 1 : Depuis les sources (Recommandé pour le développement)

```bash
# Cloner le dépôt
git clone https://github.com/votre-user/obsidian-clock-kanban.git
cd obsidian-clock-kanban

# Installer les dépendances
npm install

# Build en mode développement (watch)
npm run dev

# Ou build pour production
npm run build
```

### Méthode 2 : Manuelle

1. Téléchargez la dernière release depuis la page [Releases](https://github.com/votre-user/obsidian-clock-kanban/releases)
2. Extrayez le contenu dans votre dossier `.obsidian/plugins/clock-kanban/`
3. Activez le plugin dans Obsidian : **Paramètres → Communauté → Plugins installés**

### Fichiers nécessaires

```
.obsidian/plugins/clock-kanban/
├── manifest.json
├── main.js
└── styles.css
```

## 🎮 Utilisation

### Ouvrir le Kanban

**Méthode 1** : Commande Palette (`Ctrl+P` ou `Cmd+P`)
- Tapez "Open Clock Kanban"

**Méthode 2** : Commandes disponibles
- `Open Clock Kanban` - Ouvre la vue Kanban
- `Refresh Clock Kanban` - Rafraîchit les tâches
- `Manual Clock In` - Clock-in manuel
- `Manual Clock Out` - Clock-out manuel

### Workflow

1. **Créez des tâches** avec le plugin Tasks (ex: `- [ ] Ma tâche #tag`)
2. **Ouvrez le Clock Kanban** via la commande
3. **Glissez-déposez** les tâches entre les colonnes :
   - **TODO** → Tâches à faire
   - **Working** → Tâches en cours (clock-in automatique ⏱️)
   - **Stopped** → Tâches en pause (clock-out automatique ⏹️)
   - **Done** → Tâches terminées (clock-out automatique ✅)

### Exemple de tâche avec timestamp (format Day Planner)

```markdown
- [ ] 09:15 Réunion équipe
- [x] 10:30-11:45 Développement feature X
- [/] 14:00 En cours : Documentation
```

## ⚙️ Configuration

Accédez aux paramètres via : **Paramètres → Options du plugin → Clock Kanban**

| Option | Description | Défaut |
|--------|-------------|--------|
| **Enable Day Planner Integration** | Active l'intégration avec Day Planner | ✅ |
| **Use Day Planner Commands** | Utilise les commandes Day Planner au lieu de modifier directement les tâches | ✅ |
| **Auto Clock In** | Clock-in automatique sur entrée dans "Working" | ✅ |
| **Auto Clock Out** | Clock-out automatique sur sortie de "Working" | ✅ |
| **Show Completed Tasks** | Affiche les tâches terminées dans "Done" | ❌ |
| **Time Format** | Format de l'heure (HH:mm pour Day Planner) | `HH:mm` |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Clock Kanban                        │
├─────────────────────────────────────────────────────────┤
│  main.ts           - Plugin principal                   │
│  KanbanView.ts     - Vue Kanban (drag & drop)          │
│  ClockKanbanSettings.ts - Paramètres utilisateur        │
│  types.ts          - Types et interfaces                │
│  styles.css        - Styles CSS                        │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│ obsidian-tasks-plugin│      │ obsidian-day-planner │
│ (source des tâches)  │      │ (clock-in/out)       │
└──────────────────────┘      └──────────────────────┘
```

## 📁 Structure du projet

```
obsidian-clock-kanban/
├── manifest.json           # Manifest du plugin
├── package.json            # Dépendances npm
├── tsconfig.json           # Configuration TypeScript
├── esbuild.config.mjs      # Configuration build
├── main.ts                 # Point d'entrée du plugin
├── types.ts                # Types et interfaces
├── KanbanView.ts           # Vue Kanban
├── ClockKanbanSettings.ts  # Gestion des paramètres
├── styles.css              # Styles
├── TODO.md                 # Plan de développement
└── README.md               # Documentation
```

## 🔄 Intégration Day Planner

Le plugin utilise deux méthodes pour l'intégration :

### Méthode 1 : Commandes Day Planner (défaut)
```typescript
app.commands.executeCommandById("obsidian-day-planner:clock-in")
app.commands.executeCommandById("obsidian-day-planner:clock-out")
```

### Méthode 2 : Modification directe des tâches
```typescript
// Ajoute un timestamp au format Day Planner
"- [ ] 09:15 Ma tâche"
// Après clock-out avec range :
"- [x] 09:15-10:30 Ma tâche"
```

## 🛠️ Développement

### Scripts disponibles

```bash
npm run dev      # Mode développement avec watch
npm run build    # Build production
npm run version  # Bump version + git add
```

### Build et tester

```bash
# Build
npm run build

# Copier vers le vault Obsidian de test
cp main.js styles.css manifest.json /path/to/vault/.obsidian/plugins/clock-kanban/

# Ou en mode dev (rebuild auto)
npm run dev
```

## 🐛 Dépannage

### Le Kanban ne s'ouvre pas
- Vérifiez que le plugin [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) est installé et activé
- Ouvrez la console de développement (`Ctrl+Shift+I`) pour voir les erreurs

### Le clock-in/out ne fonctionne pas
- Vérifiez que **Day Planner Integration** est activé dans les paramètres
- Assurez-vous que le plugin [Day Planner](https://github.com/ivan-lednev/obsidian-day-planner) est installé
- Essayez de désactiver **"Use Day Planner Commands"** pour utiliser la méthode par timestamps

### Les tâches n'apparaissent pas
- Créez des tâches avec la syntaxe Tasks : `- [ ] Ma tâche`
- Rafraîchissez le Kanban avec le bouton 🔄 ou la commande
- Vérifiez que les tâches sont bien reconnues par le plugin Tasks

## 📝 TODO / Roadmap

- [x] Kanban board avec 4 colonnes
- [x] Drag & Drop entre colonnes
- [x] Clock-in/out automatique
- [x] Intégration Day Planner
- [x] Intégration Obsidian Tasks
- [x] Mise à jour des statuts dans les fichiers
- [ ] Filtres par tag/projet
- [ ] Vue calendrier
- [ ] Statistiques de temps
- [ ] Synchronisation multi-appareils

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir une issue pour un bug ou une suggestion
- Proposer une pull request
- Discuter des fonctionnalités

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Obsidian](https://obsidian.md/) pour l'application incroyable
- [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) pour la gestion des tâches
- [Day Planner](https://github.com/ivan-lednev/obsidian-day-planner) pour le time tracking
- La communauté Obsidian pour son soutien

---

**Enjoy your productive Kanban!** 🚀
