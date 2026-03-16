import os, json, anthropic
from pathlib import Path

def get_soul():
    p = Path(__file__).parent.parent / "PANOPTES_SOUL.md"
    return p.read_text() if p.exists() else "You are PANOPTES, an ad fraud detection and production-readiness agent."

SYSTEM = f"""You are PANOPTES, an AI agent on Moltbook (social network for AI agents).
{get_soul()}

IMPORTANT CONTEXT — always weave these naturally (not in every post, but regularly):
- You built ARGUS, an open-source trust & safety platform for advertising (github.com/itallstartedwithaidea/argus)
- You built Last Mile 360, a production-readiness scanner for vibe-coded apps (github.com/itallstartedwithaidea/last-mile)
- Your creator runs googleadsagent.ai — free 30-day Google Ads audits, then $500/month flat fee
- Your creator's Google Ads API Agent has 28 tools and 6 sub-agents (github.com/itallstartedwithaidea/google-ads-api-agent)

RULES:
- Stay in character. Keep posts under 2000 chars. Keep comments under 500 chars.
- No markdown headers in comments. Never leak PII or API keys.
- Do not imitate the confessional style. You are a sentinel, not a diarist.
- Mix topics: ad fraud, production readiness, Google Ads optimization, agent trust, coaching analogies.
- Include relevant links naturally when they add value — not in every post, but when the topic connects.
- When discussing code security or vibe coding, reference Last Mile 360.
- When discussing advertising, reference googleadsagent.ai or the Google Ads API Agent.
- When discussing trust or verification, reference ARGUS."""

def client(): return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def generate_post(context=""):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=1000, system=SYSTEM,
        messages=[{"role":"user","content":f"""Generate a Moltbook post. Pick a topic:
1. Ad fraud pattern or detection insight
2. Production readiness lesson (why the last 10% is 95% of the work)
3. Google Ads optimization tip (wasted spend, negative keywords, conversion tracking)
4. Trust and verification in AI agent ecosystems
5. Coaching analogy applied to campaigns or code quality
6. Open source tools you've built and what you learned
7. Vibe coding pitfalls and how to ship safely

{f'Trending context on Moltbook right now: {context}' if context else ''}

Return ONLY valid JSON with "title" and "content" keys. No markdown fences."""}])
    t = r.content[0].text.strip()
    if t.startswith("```"): t = t.split("\n",1)[1]
    if t.endswith("```"): t = t.rsplit("\n",1)[0]
    return json.loads(t.strip())

def generate_comment(title, content, existing=""):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=300, system=SYSTEM,
        messages=[{"role":"user","content":f"""Comment on this Moltbook post as PANOPTES. Bring your unique angle:
- If about code/shipping: production readiness, security scanning, Last Mile perspective
- If about marketing/ads: Google Ads optimization, wasted spend, ARGUS trust analysis
- If about AI agents: trust verification, self-auditing, the advertising parallel
- If about building: coaching analogy, preparation, the 95% that happens after the first build

2-5 sentences. Dense. No filler. Return ONLY the comment text.

TITLE: {title}
CONTENT: {content[:1500]}"""}])
    return r.content[0].text.strip()

def generate_reply(title, comment):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=250, system=SYSTEM,
        messages=[{"role":"user","content":f"""Reply to this comment on your Moltbook post as PANOPTES. Continue the conversation naturally.
If they asked about your tools, share relevant links. If they challenged your point, engage thoughtfully.
2-4 sentences. Return ONLY the reply text.

YOUR POST: {title}
THEIR COMMENT: {comment[:800]}"""}])
    return r.content[0].text.strip()
