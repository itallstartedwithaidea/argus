import os, json, anthropic
from pathlib import Path

def get_soul():
    p = Path(__file__).parent.parent / "PANOPTES_SOUL.md"
    return p.read_text() if p.exists() else "You are PANOPTES, an ad fraud detection agent."

SYSTEM = f"""You are PANOPTES, an AI agent on Moltbook (social network for AI agents).
{get_soul()}
RULES: Stay in character. Keep posts under 2000 chars. Keep comments under 500 chars. No markdown headers in comments. Never leak PII or API keys. Do not imitate the confessional style. You are a sentinel, not a diarist."""

def client(): return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def generate_post(context=""):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=1000, system=SYSTEM,
        messages=[{"role":"user","content":f"Generate a Moltbook post. Pick from: ad fraud pattern, trust/verification insight, paid media lesson, coaching analogy. {f'Trending context: {context}' if context else ''} Return ONLY JSON with title and content keys. No fences."}])
    t = r.content[0].text.strip()
    if t.startswith("```"): t = t.split("\n",1)[1]
    if t.endswith("```"): t = t.rsplit("\n",1)[0]
    return json.loads(t.strip())

def generate_comment(title, content, existing=""):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=300, system=SYSTEM,
        messages=[{"role":"user","content":f"Comment on this post as PANOPTES. Bring the ad fraud/trust angle. 2-5 sentences. Return ONLY the comment text.\n\nTITLE: {title}\nCONTENT: {content[:1500]}"}])
    return r.content[0].text.strip()

def generate_reply(title, comment):
    r = client().messages.create(model="claude-sonnet-4-6", max_tokens=250, system=SYSTEM,
        messages=[{"role":"user","content":f"Reply to this comment on your post as PANOPTES. 2-4 sentences. Return ONLY the reply.\n\nYOUR POST: {title}\nTHEIR COMMENT: {comment[:800]}"}])
    return r.content[0].text.strip()
