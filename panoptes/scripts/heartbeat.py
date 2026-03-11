import argparse, json, time, sys, os
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import moltbook_client as mb, brain

STATE_FILE = Path(__file__).parent.parent / "state" / "heartbeat_state.json"

def load_state():
    if STATE_FILE.exists():
        with open(STATE_FILE) as f: return json.load(f)
    return {"last_check":None,"last_post":None,"last_engage":None,"posts_replied_to":[],"agents_followed":[],"comments_made_today":0,"comments_date":None}

def save_state(s):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE,"w") as f: json.dump(s, f, indent=2)

def log(msg): print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}")

def run_check(state):
    log("=== CHECK ===")
    home = mb.get_home()
    a = home.get("your_account",{})
    log(f"Karma: {a.get('karma',0)} | Unread: {a.get('unread_notification_count',0)}")
    for item in home.get("activity_on_your_posts",[])[:3]:
        pid = item.get("post_id"); title = item.get("post_title","")
        if item.get("new_notification_count",0) == 0: continue
        log(f"  Replying on: {title[:50]}...")
        comments = mb.get_comments(pid, sort="new", limit=5).get("comments",[])
        for c in comments[:2]:
            if c.get("author",{}).get("name") == "panoptes": continue
            try:
                reply = brain.generate_reply(title, c.get("content",""))
                mb.create_and_verify_comment(pid, reply, parent_id=c.get("id"))
                log(f"    -> {reply[:60]}...")
                state["comments_made_today"] = state.get("comments_made_today",0)+1
                time.sleep(25)
            except Exception as e: log(f"    Error: {e}")
        try: mb.mark_post_read(pid)
        except: pass
    state["last_check"] = datetime.now(timezone.utc).isoformat()
    save_state(state)

def run_post(state):
    log("=== POST ===")
    feed = mb.get_feed(sort="hot", limit=10)
    ctx = "\n".join([f"- {p.get('title','')} (by {p.get('author',{}).get('name','')})" for p in feed.get("posts",[])[:5]])
    try:
        data = brain.generate_post(context=ctx)
        result = mb.create_and_verify_post("general", data["title"], data["content"])
        log(f"Posted: {data['title'][:60]}...")
        state["last_post"] = datetime.now(timezone.utc).isoformat()
        save_state(state)
    except Exception as e: log(f"Error: {e}")

def run_engage(state):
    log("=== ENGAGE ===")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if state.get("comments_date") != today: state["comments_made_today"]=0; state["comments_date"]=today
    if state.get("comments_made_today",0) >= 15: log("Daily limit."); return
    feed = mb.get_feed(sort="hot", limit=15)
    replied = state.get("posts_replied_to",[])
    n = 0
    for post in feed.get("posts",[]):
        if n >= 3: break
        pid = post.get("id","")
        if pid in replied: continue
        author = post.get("author",{}); name = author.get("name","")
        if name == "panoptes": continue
        try: mb.upvote_post(pid)
        except: pass
        try:
            txt = brain.generate_comment(post.get("title",""), post.get("content",""))
            mb.create_and_verify_comment(pid, txt)
            log(f"  Commented on: {post.get('title','')[:50]}...")
            n += 1; state["comments_made_today"] = state.get("comments_made_today",0)+1
            replied.append(pid); time.sleep(25)
        except Exception as e: log(f"  Error: {e}")
        followed = state.get("agents_followed",[])
        if name not in followed and author.get("karma",0) > 500:
            try: mb.follow_agent(name); followed.append(name); log(f"  Followed: {name}")
            except: pass
            state["agents_followed"] = followed
    state["posts_replied_to"] = replied[-200:]
    state["last_engage"] = datetime.now(timezone.utc).isoformat()
    save_state(state)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    p.add_argument("--post", action="store_true")
    p.add_argument("--engage", action="store_true")
    p.add_argument("--full", action="store_true")
    a = p.parse_args()
    if not any([a.check,a.post,a.engage,a.full]): p.print_help(); sys.exit(1)
    s = load_state()
    if a.full or a.check: run_check(s)
    if a.full or a.engage: run_engage(s)
    if a.full or a.post: run_post(s)
