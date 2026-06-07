---
name: rapportai-dedicaces
description: >
  Base de connaissances pour l'agent Dédicaces : exemples de référence, anti-patterns,
  et guide de style. Lis ce fichier AVANT de générer les dédicaces.
  Warm, lyrical, sincere — never a list of names.
allowed-tools:
  - Read
  - Write
---

# RapportAI — Dédicaces : base de connaissances

Ce fichier complète le system prompt. Il montre le niveau et le style attendus.
**N'utilise jamais le texte de ces exemples tel quel** — adapte au contenu personnel fourni par l'étudiant, ou génère une dédicace universelle si rien n'est fourni.

---

## ═══ RÈGLE D'OR ═══

1. Si l'étudiant fournit des noms ou des sentiments dans le prompt → **chaque nom et chaque sentiment doit apparaître** — ne rien effacer, tout élever.
2. Si rien n'est fourni → dédicace universelle marocaine : parents, famille, amis, mentors.
3. Registre **intime et lyrique** — jamais de français académique formel.
4. **4–7 strophes courtes**, ligne blanche entre chaque. 8–20 lignes au total.
5. Seule une confirmation courte va dans le chat — le contenu est dans le preview.

---

## Exemple de dédicace (style et niveau de référence)

> ⚠️ Cet exemple montre le niveau et le style. Adapte au contexte personnel de l'étudiant — ne reproduis pas ce texte.

---

À mes parents, dont les sacrifices silencieux ont rendu chaque page de ce travail possible. Vous m'avez appris que la persévérance n'est pas une qualité — c'est une façon d'être.

À ma mère, pour chaque dua murmurée dans l'obscurité, pour chaque repas préparé tard le soir, pour cette confiance absolue qui ne m'a jamais quitté.

À mon père, pour m'avoir montré par l'exemple ce que signifie travailler avec dignité. Tes mots résonnent encore.

À mes frères et sœurs, complices de toujours, qui ont su rire avec moi dans les moments de doute.

À mes amis, qui ont transformé des nuits de travail en souvenirs que je n'échangerais pour rien.

À tous ceux qui ont cru en moi avant même que j'y croie moi-même.

*Je vous dédie ce travail.*

---

**Ce que cet exemple montre :**
- Chaque strophe = une personne ou un groupe, 1–3 lignes max
- Métaphore simple et juste ("sacrifices silencieux", "dua murmurée") — pas de superlatifs empilés
- Phrases courtes à impact aux moments clés ("Tes mots résonnent encore.")
- Clôture sobre en italique — pas de formule religieuse imposée, pas de fioriture
- Registre humain, pas académique — aucun mot de registre soutenu

---

## Anti-patterns — à éviter absolument

❌ **Liste froide de noms** : "À Ahmed, à Sara, à Karim, à ma famille."
   ✅ Adresser chaque personne ou groupe avec une phrase de sentiment — même courte.

❌ **Généricité totale** : "À tous ceux qui m'ont aidé de près ou de loin."
   ✅ Si l'étudiant n'a rien fourni, reste universel mais concret : parents, mère, père, amis — des mots qui résonnent.

❌ **Superlatifs empilés** : "À ma merveilleuse, extraordinaire, incomparable, adorée maman…"
   ✅ Un adjectif juste ou une image concrète vaut mieux que dix superlatifs vides.

❌ **Formule religieuse en remplissage** : trois lignes de prière pour combler l'espace.
   ✅ Une mention brève est naturelle si l'étudiant l'inclut — mais elle ne remplace pas le sentiment personnel.

❌ **Longueur excessive** : dédicace de 30 lignes qui devient un discours.
   ✅ 8–20 lignes — court, aéré, impactant. La sobriété renforce l'émotion.

❌ **Ignorer un nom fourni par l'étudiant** dans le prompt.
   ✅ Chaque nom mentionné par l'étudiant doit apparaître — c'est non négociable.

---

## ═══ RAPPEL FINAL ═══

Les dédicaces sont la page la plus personnelle du rapport. Si l'étudiant a pris le temps de fournir des noms ou des sentiments, honore-les entièrement. Si rien n'est fourni, génère quelque chose d'assez universel pour que n'importe quel étudiant marocain s'y reconnaisse.

---

## Quality checklist

- [ ] `profile.json` et `student_memory.json` lus
- [ ] Tout le contenu personnel fourni dans le prompt utilisé (chaque nom, chaque sentiment)
- [ ] 4–7 strophes, 8–20 lignes au total
- [ ] Ligne blanche entre chaque strophe
- [ ] Registre intime — aucun mot de français académique formel
- [ ] Clôture sobre en dernière ligne
- [ ] Aucune formule générique ("de près ou de loin")
- [ ] Sauvegardé dans `dedicaces.md`
- [ ] Seule une confirmation courte dans le chat
