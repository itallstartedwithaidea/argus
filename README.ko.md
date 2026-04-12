# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### 알고리즘 기반 진위성 분석 플랫폼

**가짜 소셜 미디어 프로필 및 게시물을 위한 VirusTotal — 무료, 오픈소스, Cloudflare 네이티브**

🔗 **라이브**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **보고서**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## 기능 소개

ARGUS는 LinkedIn, Reddit, Instagram, X, Facebook, YouTube, Quora, TikTok, Pinterest에서 소셜 미디어 프로필, 게시물 또는 참여 패턴을 분석합니다. 완전한 근거, 탐지 엔진 분석, 댓글 작성자 분석 및 감점 설명과 함께 **가중 신뢰 점수(0–100)**를 반환합니다.

표시된 콘텐츠는 SEO 친화적 URL로 Google에 색인되는 공개 랜딩 페이지를 받습니다. 모든 분석은 알고리즘적 의견으로 표현됩니다 — 판결이 아닙니다. 프로필 소유자는 언제든지 이의를 제기할 수 있습니다.

**공개되는 모든 페이지는 사람의 검토와 승인을 거칩니다.**

---

## 핵심 기능

- **4개 탐지 엔진**: 이미지, 텍스트, 행동, 네트워크 — 각각 독립적으로 평가
- **댓글 작성자 분석**: 모든 가시적 댓글 작성자의 봇 패턴, 조정, 진정성 분석
- **가중 스코어링 알고리즘**: `네트워크(35%) + 행동(30%) + 이미지(20%) + 텍스트(15%) - 감점`
- **감점 시스템**: 검증 불가 데이터, 봇 패턴, 가짜 참여 등에 자동 감점
- **비공개 프로필 모드**: ARGUS가 스크래핑할 수 없는 프로필의 콘텐츠 + 스크린샷 붙여넣기
- **Claude AI 분석**: Anthropic Claude 기반 심층 콘텐츠 분석
- **동적 공개 보고서**: Cloudflare Workers로 즉시 생성되는 Wiki 스타일 페이지
- **SEO 친화적 URL**: `/report/reddit-landing-page-navigation-conversion-85`
- **관리자 대시보드**: OAuth 보호, Chart.js 분석, 그룹화, 분쟁 해결
- **증거 업로드**: 분쟁 증거 파일용 R2 스토리지
- **이메일 알림**: Resend를 통해 제출자에게 상세 분석 결과 발송
- **동적 사이트맵**: 게시된 보고서에서 자동 생성
- **브라우저 확장 프로그램**: 빠른 분석을 위한 Chrome 확장

---

## 스코어링 알고리즘

일반적인 AI 스코어링과 달리 ARGUS는 **결정론적 가중 합산**을 사용합니다:

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

## 사용된 Cloudflare 서비스

| 서비스     | 용도                              | 무료 등급            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | 정적 페이지 + Functions API         | 무제한            |
| **KV**      | 제출, 분쟁, 설정 캐시  | 10만 읽기/일       |
| **R2**      | 증거 저장소 (분쟁 파일 업로드)| 10GB + 1000만 작업/월 |
| **Workers** | 동적 보고서 생성, 사이트맵   | 10만 요청/일         |

**월 비용: ~$0–$5**

---

## 탐지 엔진

| 엔진 | 분석 대상 | 핵심 신호 |
|--------|----------|-------------|
| **이미지** | 프로필 사진, 게시물 이미지 | GAN 아티팩트, 스톡 사진, C2PA 출처, EXIF 이상 |
| **텍스트** | 바이오, 게시물, 댓글 | AI 생성 텍스트, 문체 측정 일관성, 템플릿화된 언어 |
| **행동** | 활동 패턴 | 계정 나이 vs 활동, 게시 빈도, 참여 비율 |
| **네트워크** | 연결, 상호작용 | 팔로워 비율, 조정 지표, 봇 네트워크 시그니처 |

---

## 법적 아키텍처

모든 페이지는 다음으로 보호됩니다:

1. **"알고리즘 분석이며, 판결이 아닙니다"** — 모든 페이지에 표시
2. **완전한 방법론 공개** — 오픈소스, 공개적으로 감사 가능
3. **투명한 스코어링** — 감점이 표시된 가중 합산
4. **눈에 띄는 이의 제기 메커니즘** — 즉시 보이는 위치, 숨기지 않음
5. **사람의 편집 검토** — 관리자가 모든 게시 페이지 승인

---

## 이의 제기 / 옵트아웃 프로세스

누구나 `/tools/argus/dispute`에서 파일 업로드(R2)와 함께 이의를 제기할 수 있습니다.

| 등급 | 증거 | 결과 |
|------|----------|---------|
| **등급 1** | 정부 신분증 + 플랫폼 인증 | 자동 삭제 승인 |
| **등급 2** | 크로스 플랫폼 존재, 고용주 확인 | 사람 검토 |
| **등급 3** | 증거 없이 "저는 진짜입니다" | 이의 거부 |

---

## 라이브 URL

- **랜딩**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **제출**: [googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **보고서**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **이의 제기**: [googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **문서**: [googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **사이트맵**: [googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## MIT 라이선스

오픈소스. 커뮤니티 유지. PR 환영합니다.

**github.com/itallstartedwithaidea/argus**
