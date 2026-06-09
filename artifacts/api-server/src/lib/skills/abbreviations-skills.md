---
name: rapportai-abbreviations
description: >
  Base de connaissances pour l'agent Abréviations : liste de sigles courants par domaine
  dans les PFE marocains, règles d'extraction, et format de sortie JSON.
  Lis ce fichier AVANT d'extraire les abréviations.
allowed-tools:
  - Read
  - Write
  - Glob
---

# RapportAI — Abréviations : base de connaissances

---

## ═══ RÈGLE D'OR ═══

1. **Jamais inventer** une signification — utilise `[À COMPLÉTER]` si incertain.
2. **JSON uniquement** — la sortie doit être un tableau JSON valide, rien d'autre.
3. **Déduplique** — chaque sigle une seule occurrence, même s'il apparaît 50 fois dans le texte.
4. **Ordre alphabétique** par `abbr`.
5. **Longueur** — 2 lettres minimum. Ne pas inclure les abréviations standard (p., n°, etc.).

---

## Sigles fréquents par domaine

### Finance & Marchés de capitaux (ENCG, ISCAE, HEM…)

| Sigle | Signification |
|-------|--------------|
| AMMC | Autorité Marocaine du Marché des Capitaux |
| BAM | Bank Al-Maghrib |
| BFR | Besoin en Fonds de Roulement |
| CAF | Capacité d'Autofinancement |
| CDVM | Conseil Déontologique des Valeurs Mobilières (remplacé par AMMC) |
| DCF | Discounted Cash Flow (Flux de Trésorerie Actualisés) |
| EBE | Excédent Brut d'Exploitation |
| EBITDA | Earnings Before Interest, Taxes, Depreciation and Amortization |
| MASI | Moroccan All Shares Index |
| OPCVM | Organismes de Placement Collectif en Valeurs Mobilières |
| ROE | Return on Equity |
| ROI | Return on Investment |
| TRI | Taux de Rentabilité Interne |
| VAN | Valeur Actuelle Nette |
| WACC | Weighted Average Cost of Capital |

### Informatique & Systèmes d'information

| Sigle | Signification |
|-------|--------------|
| API | Application Programming Interface |
| BI | Business Intelligence |
| CRM | Customer Relationship Management |
| DSI | Direction des Systèmes d'Information |
| ERP | Enterprise Resource Planning |
| IA | Intelligence Artificielle |
| IoT | Internet of Things |
| KPI | Key Performance Indicator |
| ML | Machine Learning |
| RPA | Robotic Process Automation |
| SaaS | Software as a Service |
| SI | Système d'Information |
| SQL | Structured Query Language |
| UML | Unified Modeling Language |

### Audit & Contrôle de gestion

| Sigle | Signification |
|-------|--------------|
| CAC | Commissaire aux Comptes |
| COSO | Committee of Sponsoring Organizations |
| IAS | International Accounting Standards |
| IFRS | International Financial Reporting Standards |
| ISA | International Standards on Auditing |
| PCGE | Plan Comptable Général des Entreprises (Maroc) |
| PDCA | Plan-Do-Check-Act (Cycle de Deming) |

### Management & RH

| Sigle | Signification |
|-------|--------------|
| BSC | Balanced Scorecard |
| DRH | Direction des Ressources Humaines |
| GRH | Gestion des Ressources Humaines |
| PME | Petite et Moyenne Entreprise |
| RSE | Responsabilité Sociale des Entreprises |
| SWOT | Strengths, Weaknesses, Opportunities, Threats |
| TPE | Très Petite Entreprise |

### Contexte économique marocain

| Sigle | Signification |
|-------|--------------|
| ANPME | Agence Nationale pour la Promotion de la PME |
| CGEM | Confédération Générale des Entreprises du Maroc |
| HCP | Haut-Commissariat au Plan |
| OCP | Office Chérifien des Phosphates |
| PIB | Produit Intérieur Brut |

---

## Pattern de détection dans le texte

Le texte peut introduire les acronymes de deux façons :

**Façon 1 — Définition explicite :**
> "la Robotic Process Automation **(RPA)**…" → `{"abbr": "RPA", "sig": "Robotic Process Automation"}`
> "**RPA** (Robotic Process Automation)…" → même résultat

**Façon 2 — Usage implicite :**
> "…les OPCVM marocains…" sans définition → cherche dans la table ci-dessus
> Si absent de la table et contexte insuffisant → `{"abbr": "OPCVM", "sig": "[À COMPLÉTER]"}`

---

## Anti-patterns — à éviter absolument

❌ **Sortie markdown** : `## Abréviations\n\n| RPA | Robotic... |`
   ✅ JSON uniquement : `[{"abbr": "RPA", "sig": "..."}]`

❌ **Noms propres non-acronymes** : `{"abbr": "Maroc", "sig": "..."}`
   ✅ Acronymes uniquement — au moins 2 lettres majuscules

❌ **Abréviations standard françaises** : `p.`, `n°`, `vol.`, `fig.`, `cf.`, `art.`
   ✅ Exclure — pas de valeur dans la liste des abréviations académiques

❌ **Doublons** : RPA apparaît 20 fois → une seule entrée JSON
   ✅ Un sigle = une entrée

❌ **Signification inventée** : `{"abbr": "RISMA", "sig": "Réseau International des Sociétés Marocaines Associées"}`
   ✅ Si inconnu : `{"abbr": "RISMA", "sig": "[À COMPLÉTER]"}`

---

## Quality checklist

- [ ] Tous les fichiers .md lus avec Glob
- [ ] Acronymes 2+ lettres extraits
- [ ] Significations vérifiées (texte + table ci-dessus)
- [ ] `[À COMPLÉTER]` utilisé pour les cas incertains
- [ ] Dédupliqué — chaque sigle une seule fois
- [ ] Trié alphabétiquement par `abbr`
- [ ] Sortie = JSON pur, aucun texte avant/après
- [ ] Sauvegardé dans `abbreviations.md`
