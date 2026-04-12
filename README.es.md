# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### Plataforma de análisis algorítmico de autenticidad

**VirusTotal para perfiles y publicaciones falsas en redes sociales — gratis, código abierto, nativo de Cloudflare**

🔗 **En vivo**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **Informes**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## Qué hace

ARGUS analiza cualquier perfil, publicación o patrón de engagement en redes sociales a través de LinkedIn, Reddit, Instagram, X, Facebook, YouTube, Quora, TikTok y Pinterest. Devuelve una **puntuación de confianza ponderada (0–100)** con razonamiento completo, desgloses por motor de detección, análisis de comentaristas y explicaciones de penalizaciones.

El contenido marcado obtiene una página pública indexada por Google con URLs SEO-friendly. Todo análisis se presenta como opinión algorítmica — no un veredicto. Los propietarios de perfiles pueden disputar en cualquier momento.

**Cada página publicada ha sido revisada y aprobada por un humano.**

---

## Características clave

- **4 motores de detección**: Imagen, Texto, Comportamental, Red — cada uno evaluado independientemente
- **Análisis de comentaristas**: Cada comentarista visible analizado para patrones de bots, coordinación, autenticidad
- **Algoritmo de puntuación ponderada**: `Red(35%) + Comportamental(30%) + Imagen(20%) + Texto(15%) - Penalizaciones`
- **Sistema de penalizaciones**: Deducciones automáticas por datos no verificables, patrones de bots, engagement falso, etc.
- **Modo perfil privado**: Pegue contenido + capturas de pantalla para perfiles que ARGUS no puede scrapear
- **Análisis Claude AI**: Impulsado por Anthropic Claude para análisis profundo de contenido
- **Informes públicos dinámicos**: Páginas wiki generadas al vuelo vía Cloudflare Workers
- **URLs SEO-friendly**: `/report/reddit-landing-page-navigation-conversion-85`
- **Panel de administración**: Protegido por OAuth con analítica Chart.js, agrupación, resolución de disputas
- **Carga de evidencias**: Almacenamiento R2 para archivos de evidencia de disputas
- **Notificaciones por email**: Resultados de análisis detallados enviados a los remitentes vía Resend
- **Sitemap dinámico**: Autogenerado a partir de informes publicados
- **Extensión de navegador**: Extensión Chrome para análisis rápido

---

## Algoritmo de puntuación

A diferencia del scoring genérico de IA, ARGUS usa un **compuesto ponderado determinista**:

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

## Servicios Cloudflare utilizados

| Servicio    | Propósito                              | Nivel gratuito            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | Páginas estáticas + API Functions         | Ilimitado            |
| **KV**      | Envíos, disputas, caché de config  | 100K lecturas/día       |
| **R2**      | Bóveda de evidencias (carga de archivos de disputa)| 10GB + 10M ops/mes |
| **Workers** | Generación dinámica de informes, sitemap   | 100K req/día         |

**Coste mensual: ~0–5$**

---

## Motores de detección

| Motor | Analiza | Señales clave |
|--------|----------|-------------|
| **Imagen** | Fotos de perfil, imágenes de publicaciones | Artefactos GAN, fotos de stock, procedencia C2PA, anomalías EXIF |
| **Texto** | Bio, publicaciones, comentarios | Texto generado por IA, consistencia estilométrica, lenguaje plantilla |
| **Comportamental** | Patrones de actividad | Edad de cuenta vs actividad, frecuencia de publicación, ratios de engagement |
| **Red** | Conexiones, interacciones | Ratios de seguidores, indicadores de coordinación, firmas de redes de bots |

---

## Arquitectura jurídica

Cada página está protegida por:

1. **"Análisis algorítmico, no un veredicto"** — mostrado en cada página
2. **Divulgación completa de la metodología** — código abierto, auditable públicamente
3. **Puntuación transparente** — compuesto ponderado con penalizaciones mostradas
4. **Mecanismo de disputa prominente** — visible inmediatamente, no enterrado
5. **Revisión editorial humana** — un administrador aprueba cada página publicada

---

## Proceso de disputa / Exclusión

Cualquier persona puede enviar una disputa en `/tools/argus/dispute` con carga de archivos (R2).

| Nivel | Evidencia | Resultado |
|------|----------|---------|
| **Nivel 1** | ID gubernamental + verificación de plataforma | Aprobación automática de eliminación |
| **Nivel 2** | Presencia multiplataforma, confirmación de empleador | Revisión humana |
| **Nivel 3** | "Soy real" sin evidencia | Disputa denegada |

---

## URLs en vivo

- **Inicio**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **Enviar**: [googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **Informes**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **Disputar**: [googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **Docs**: [googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **Sitemap**: [googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## Licencia MIT

Código abierto. Mantenido por la comunidad. PRs bienvenidos.

**github.com/itallstartedwithaidea/argus**
