# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### Plateforme d'analyse algorithmique d'authenticité

**VirusTotal pour les faux profils et publications sur les réseaux sociaux — gratuit, open source, natif Cloudflare**

🔗 **En ligne** : [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **Rapports** : [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## Ce qu'il fait

ARGUS analyse n'importe quel profil, publication ou schéma d'engagement sur les réseaux sociaux à travers LinkedIn, Reddit, Instagram, X, Facebook, YouTube, Quora, TikTok et Pinterest. Il renvoie un **score de confiance pondéré (0–100)** avec un raisonnement complet, des détails par moteur de détection, une analyse des commentateurs et des explications de pénalités.

Le contenu signalé obtient une page publique indexée par Google avec des URL SEO-friendly. Toute analyse est présentée comme une opinion algorithmique — pas un verdict. Les propriétaires de profils peuvent contester à tout moment.

**Chaque page publiée a été examinée et approuvée par un humain.**

---

## Fonctionnalités clés

- **4 moteurs de détection** : Image, Texte, Comportemental, Réseau — chacun évalué indépendamment
- **Analyse des commentateurs** : Chaque commentateur visible analysé pour les patterns de bots, la coordination, l'authenticité
- **Algorithme de scoring pondéré** : `Réseau(35%) + Comportemental(30%) + Image(20%) + Texte(15%) - Pénalités`
- **Système de pénalités** : Déductions automatiques pour données invérifiables, patterns de bots, faux engagement, etc.
- **Mode profil privé** : Collez du contenu + captures d'écran pour les profils qu'ARGUS ne peut pas scraper
- **Analyse Claude AI** : Propulsé par Anthropic Claude pour une analyse approfondie du contenu
- **Rapports publics dynamiques** : Pages wiki générées à la volée via Cloudflare Workers
- **URLs SEO-friendly** : `/report/reddit-landing-page-navigation-conversion-85`
- **Tableau de bord admin** : Protégé par OAuth avec analytique Chart.js, groupement, résolution de litiges
- **Upload de preuves** : Stockage R2 pour les fichiers de preuves de contestation
- **Notifications par e-mail** : Résultats d'analyse détaillés envoyés aux soumetteurs via Resend
- **Sitemap dynamique** : Généré automatiquement à partir des rapports publiés
- **Extension navigateur** : Extension Chrome pour une analyse rapide

---

## Architecture

```
Community Submission Form / Private Mode / Browser Extension
    ↓
Cloudflare Pages Function API (/api/argus)
    ├── Submit → KV queue + rate limiting
    ├── Analyze → Claude AI + weighted scoring algorithm
    ├── Approve → SEO slug generation + email + sitemap
    └── Dispute → R2 evidence upload + resolution workflow
    ↓
Admin Dashboard (OAuth-protected)
    ├── Queue management with full detail view
    ├── Analytics: Chart.js charts (platform, scores, risk, timeline)
    ├── Grouping: Repeat posters, submitter activity tracking
    └── Score breakdown: composite, penalties, Claude raw vs final
    ↓
Dynamic Public Report Pages (Cloudflare Workers)
    ├── Trust score with SVG gauge
    ├── 4 engine breakdowns with signal tables
    ├── Commenter analysis table
    ├── Bot/AI/Fake engagement detection cards
    ├── Poster profile section
    ├── Score calculation transparency
    └── Full SEO: Schema.org, Open Graph, breadcrumbs
    ↓
Google Indexing (via sitemap + robots.txt)
```

---

## Algorithme de scoring

Contrairement au scoring IA générique, ARGUS utilise un **composite pondéré déterministe** :

```
Final Score = Weighted Composite - Penalties

Weighted Composite:
  Network Engine  × 0.35
  Behavioral      × 0.30
  Image           × 0.20
  Text            × 0.15

Penalties (applied automatically):
  Account age unverifiable:      -8
  No visible posting history:    -10
  Private submission:            -15
  Page couldn't be fetched:      -12
  Very limited content:          -10
  Bot activity detected:         -up to 20
  AI-generated content:          -up to 15
  Fake engagement detected:      -up to 20
  >50% suspicious comments:      -15
  High followers + few posts:    -18
  New account + high engagement: -20
```

---

## Services Cloudflare utilisés

| Service     | Objectif                              | Offre gratuite            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | Pages statiques + API Functions         | Illimité            |
| **KV**      | Soumissions, litiges, cache config  | 100K lectures/jour       |
| **R2**      | Coffre-fort de preuves (uploads de fichiers de contestation)| 10Go + 10M ops/mois |
| **Workers** | Génération dynamique de rapports, sitemap   | 100K req/jour         |

**Coût mensuel : ~0–5$**

---

## Structure du dépôt

```
argus/
├── functions/
│   ├── api/
│   │   ├── argus.js              ← Main API: submit, analyze, approve, reject, dispute, stats
│   │   └── argus-sitemap.js      ← Dynamic XML sitemap from published reports
│   └── tools/argus/
│       ├── admin.js              ← Admin page security headers middleware
│       ├── reports.js            ← Public reports directory (dynamic listing)
│       └── report/[[id]].js      ← Dynamic public report pages (slug + ID routing)
├── pages/argus/
│   ├── index.html                ← Landing page
│   ├── app.html                  ← Submission form (URL + private mode)
│   ├── admin.html                ← Admin dashboard (OAuth + Chart.js analytics)
│   ├── dispute.html              ← Dispute form (with R2 file upload)
│   └── docs.html                 ← Documentation
├── extension/
│   └── popup.html                ← Chrome extension popup
├── wrangler.toml                 ← Cloudflare bindings config
└── README.md
```

---

## Configuration (intégré à googleadsagent.ai)

ARGUS fonctionne dans le cadre du déploiement Cloudflare Pages de [googleadsagent.ai](https://googleadsagent.ai).

### Prérequis

```bash
npm install -g wrangler
wrangler login
```

### Espaces de noms KV requis

- `SESSIONS` — soumissions, litiges, config, limitation de débit
- `USERS` — stockage de sessions OAuth

### Bucket R2 requis

- `FILES` — uploads de fichiers de preuves pour les contestations

### Secrets requis

```bash
wrangler pages secret put ANTHROPIC_API_KEY    # Claude API key
wrangler pages secret put RESEND_API_KEY       # Email notifications
```

---

## Points d'accès API

### Publics

| Méthode | Point d'accès | Action | Description |
|--------|----------|--------|-------------|
| POST | `/api/argus?action=submit` | submit | Soumettre une URL ou du contenu privé pour analyse |
| POST | `/api/argus?action=dispute` | dispute | Déposer une contestation avec preuves |
| POST | `/api/argus?action=upload` | upload | Uploader des fichiers de preuves vers R2 |
| GET | `/api/argus?action=submission&id=X` | submission | Obtenir une soumission publiée |
| GET | `/api/argus?action=published` | published | Lister tous les rapports publiés |
| GET | `/api/argus-sitemap` | — | Sitemap XML dynamique |

### Admin (OAuth requis)

| Méthode | Point d'accès | Action | Description |
|--------|----------|--------|-------------|
| POST | `/api/argus?action=analyze` | analyze | Lancer l'analyse Claude sur une soumission |
| POST | `/api/argus?action=approve` | approve | Publier avec slug SEO + e-mail |
| POST | `/api/argus?action=reject` | reject | Rejeter une soumission |
| POST | `/api/argus?action=dispute_resolve` | dispute_resolve | Résoudre un litige + notifier le plaignant |
| GET | `/api/argus?action=queue` | queue | Obtenir toutes les soumissions |
| GET | `/api/argus?action=disputes` | disputes | Obtenir tous les litiges |
| GET | `/api/argus?action=stats` | stats | Données analytiques (graphiques, groupement) |

---

## Moteurs de détection

| Moteur | Analyse | Signaux clés |
|--------|----------|-------------|
| **Image** | Photos de profil, images de publications | Artefacts GAN, photos stock, provenance C2PA, anomalies EXIF |
| **Texte** | Bio, publications, commentaires | Texte généré par IA, cohérence stylométrique, langage templé |
| **Comportemental** | Patterns d'activité | Âge du compte vs activité, fréquence de publication, ratios d'engagement |
| **Réseau** | Connexions, interactions | Ratios de followers, indicateurs de coordination, signatures de réseaux de bots |

---

## Architecture juridique

Chaque page est protégée par :

1. **« Analyse algorithmique, pas un verdict »** — affiché sur chaque page
2. **Divulgation complète de la méthodologie** — open source, auditable publiquement
3. **Scoring transparent** — composite pondéré avec pénalités affichées
4. **Mécanisme de contestation proéminent** — visible immédiatement, pas enterré
5. **Révision éditoriale humaine** — un admin approuve chaque page publiée

---

## Processus de contestation / Opt-out

N'importe qui peut soumettre une contestation à `/tools/argus/dispute` avec upload de fichiers (R2).

| Niveau | Preuves | Résultat |
|------|----------|---------|
| **Niveau 1** | Pièce d'identité gouvernementale + vérification de plateforme | Approbation automatique du retrait |
| **Niveau 2** | Présence multiplateforme, confirmation employeur | Examen humain |
| **Niveau 3** | « Je suis réel » sans preuve | Contestation refusée |

---

## URLs en ligne

- **Accueil** : [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **Soumettre** : [googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **Rapports** : [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **Contester** : [googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **Docs** : [googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **Sitemap** : [googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## Licence MIT

Open source. Maintenu par la communauté. PRs bienvenues.

**github.com/itallstartedwithaidea/argus**
