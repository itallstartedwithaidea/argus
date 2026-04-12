# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### Algoritmisch authenticiteitsanalyseplatform

**VirusTotal voor neppe social media-profielen en -posts — gratis, open source, Cloudflare-native**

🔗 **Live**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **Rapporten**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## Wat het doet

ARGUS analyseert elk social media-profiel, -post of engagementpatroon op LinkedIn, Reddit, Instagram, X, Facebook, YouTube, Quora, TikTok en Pinterest. Het retourneert een **gewogen vertrouwensscore (0–100)** met volledige onderbouwing, uitsplitsingen per detectie-engine, commentaaranalyse en strafuitleg.

Gemarkeerde content krijgt een publieke landingspagina geïndexeerd door Google met SEO-vriendelijke URLs. Alle analyse wordt gepresenteerd als algoritmische mening — niet als oordeel. Profieleigenaren kunnen op elk moment bezwaar maken.

**Elke pagina die live gaat, is beoordeeld en goedgekeurd door een mens.**

---

## Belangrijkste functies

- **4 detectie-engines**: Beeld, Tekst, Gedrag, Netwerk — elk onafhankelijk gescoord
- **Commentaaranalyse**: Elke zichtbare commentator geanalyseerd op botpatronen, coördinatie, authenticiteit
- **Gewogen scoringsalgoritme**: `Netwerk(35%) + Gedrag(30%) + Beeld(20%) + Tekst(15%) - Straffen`
- **Strafsysteem**: Automatische aftrekken voor niet-verifieerbare gegevens, botpatronen, nep-engagement, etc.
- **Privé-profielmodus**: Plak content + screenshots voor profielen die ARGUS niet kan scrapen
- **Claude AI-analyse**: Aangedreven door Anthropic Claude voor diepgaande contentanalyse
- **Dynamische publieke rapporten**: Wiki-achtige pagina's on-the-fly gegenereerd via Cloudflare Workers
- **SEO-vriendelijke URLs**: `/report/reddit-landing-page-navigation-conversion-85`
- **Admin-dashboard**: OAuth-beschermd met Chart.js-analytics, groepering, geschillenbeslechting
- **Bewijsupload**: R2-opslag voor bewijsbestanden bij bezwaren
- **E-mailnotificaties**: Gedetailleerde analyseresultaten via Resend naar indieners
- **Dynamische sitemap**: Automatisch gegenereerd uit gepubliceerde rapporten
- **Browserextensie**: Chrome-extensie voor snelle analyse

---

## Scoringsalgoritme

Anders dan generieke AI-scoring gebruikt ARGUS een **deterministisch gewogen composiet**:

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

## Gebruikte Cloudflare-services

| Service     | Doel                              | Gratis niveau            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | Statische pagina's + Functions API         | Onbeperkt            |
| **KV**      | Inzendingen, bezwaren, config cache  | 100K reads/dag       |
| **R2**      | Bewijskluis (bezwaarbestanden uploaden)| 10GB + 10M ops/maand |
| **Workers** | Dynamische rapportgeneratie, sitemap   | 100K req/dag         |

**Maandelijkse kosten: ~€0–€5**

---

## Detectie-engines

| Engine | Analyseert | Belangrijkste signalen |
|--------|----------|-------------|
| **Beeld** | Profielfoto's, postafbeeldingen | GAN-artefacten, stockfoto's, C2PA-herkomst, EXIF-anomalieën |
| **Tekst** | Bio, posts, reacties | AI-gegenereerde tekst, stylometrische consistentie, sjabloonmatig taalgebruik |
| **Gedrag** | Activiteitspatronen | Accountleeftijd vs. activiteit, postfrequentie, engagementratio's |
| **Netwerk** | Verbindingen, interacties | Volgerratio's, coördinatie-indicatoren, botnetwerk-signaturen |

---

## Juridische architectuur

Elke pagina wordt beschermd door:

1. **"Algoritmische analyse, geen oordeel"** — weergegeven op elke pagina
2. **Volledige methodologie-openbaarmaking** — open source, publiek controleerbaar
3. **Transparante scoring** — gewogen composiet met getoonde straffen
4. **Prominent bezwaarmechanisme** — direct zichtbaar, niet verstopt
5. **Menselijke redactionele beoordeling** — admin keurt elke gepubliceerde pagina goed

---

## Bezwaar- / Opt-out-proces

Iedereen kan een bezwaar indienen op `/tools/argus/dispute` met bestandsuploads (R2).

| Niveau | Bewijs | Uitkomst |
|------|----------|---------|
| **Niveau 1** | Overheids-ID + platformverificatie | Automatische goedkeuring verwijdering |
| **Niveau 2** | Cross-platform aanwezigheid, werkgeversbevestiging | Menselijke beoordeling |
| **Niveau 3** | "Ik ben echt" zonder bewijs | Bezwaar afgewezen |

---

## Live URLs

- **Landing**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **Indienen**: [googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **Rapporten**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **Bezwaar**: [googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **Docs**: [googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **Sitemap**: [googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## MIT-licentie

Open source. Community-onderhouden. PR's welkom.

**github.com/itallstartedwithaidea/argus**
