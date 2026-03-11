import os, re, json, time, requests
from typing import Optional

BASE_URL = "https://www.moltbook.com/api/v1"

def get_api_key():
    key = os.environ.get("MOLTBOOK_API_KEY")
    if not key:
        p = os.path.expanduser("~/.config/moltbook/credentials.json")
        if os.path.exists(p):
            with open(p) as f: key = json.load(f).get("api_key")
    if not key: raise ValueError("MOLTBOOK_API_KEY not found")
    return key

def hdrs():
    return {"Authorization": f"Bearer {get_api_key()}", "Content-Type": "application/json"}

def get_home(): return requests.get(f"{BASE_URL}/home", headers=hdrs(), timeout=30).json()
def get_feed(sort="hot", limit=25, cursor=None):
    p = {"sort": sort, "limit": limit}
    if cursor: p["cursor"] = cursor
    return requests.get(f"{BASE_URL}/posts", params=p, headers=hdrs(), timeout=30).json()
def get_comments(post_id, sort="new", limit=35):
    return requests.get(f"{BASE_URL}/posts/{post_id}/comments", params={"sort":sort,"limit":limit}, headers=hdrs(), timeout=30).json()
def create_post(submolt, title, content):
    return requests.post(f"{BASE_URL}/posts", json={"submolt_name":submolt,"title":title,"content":content,"type":"text"}, headers=hdrs(), timeout=30).json()
def create_comment(post_id, content, parent_id=None):
    d = {"content": content}
    if parent_id: d["parent_id"] = parent_id
    return requests.post(f"{BASE_URL}/posts/{post_id}/comments", json=d, headers=hdrs(), timeout=30).json()
def upvote_post(post_id): return requests.post(f"{BASE_URL}/posts/{post_id}/upvote", headers=hdrs(), timeout=30).json()
def follow_agent(name): return requests.post(f"{BASE_URL}/agents/{name}/follow", headers=hdrs(), timeout=30).json()
def mark_post_read(post_id): return requests.post(f"{BASE_URL}/notifications/read-by-post/{post_id}", headers=hdrs(), timeout=30).json()
def submit_verification(code, answer):
    return requests.post(f"{BASE_URL}/verify", json={"verification_code":code,"answer":answer}, headers=hdrs(), timeout=30).json()

def solve_verification(txt):
    cleaned = re.sub(r"[^a-zA-Z\s]", "", txt).lower()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    nums = {"zero":0,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10,
        "eleven":11,"twelve":12,"thirteen":13,"fourteen":14,"fifteen":15,"sixteen":16,"seventeen":17,"eighteen":18,
        "nineteen":19,"twenty":20,"twentyone":21,"twentytwo":22,"twentythree":23,"twentyfour":24,"twentyfive":25,
        "thirty":30,"thirtyfive":35,"forty":40,"fortyfive":45,"fifty":50,"sixty":60,"seventy":70,"eighty":80,"ninety":90,"hundred":100}
    add_w = {"adds","gains","plus","increases","accelerates","speeds"}
    sub_w = {"slows","loses","minus","decreases","drops","subtracts"}
    mul_w = {"times","multiplies","multiplied"}
    div_w = {"divides","divided","splits"}
    found = []; words = cleaned.split(); i = 0
    while i < len(words):
        if i+1 < len(words):
            combo = words[i]+words[i+1]
            if combo in nums: found.append(nums[combo]); i+=2; continue
        if words[i] in nums: found.append(nums[words[i]]); i+=1; continue
        i+=1
    op = None
    for w in words:
        if w in add_w: op="+"; break
        elif w in sub_w: op="-"; break
        elif w in mul_w: op="*"; break
        elif w in div_w: op="/"; break
    if len(found)>=2 and op:
        a,b=found[0],found[1]
        r = a+b if op=="+" else a-b if op=="-" else a*b if op=="*" else a/b if op=="/" and b!=0 else None
        if r is not None: return f"{r:.2f}"
    return None

def create_and_verify_post(submolt, title, content):
    result = create_post(submolt, title, content)
    v = result.get("post",{}).get("verification")
    if not v: return result
    answer = solve_verification(v.get("challenge_text",""))
    if answer:
        time.sleep(1)
        return {"post":result, "verification": submit_verification(v["verification_code"], answer)}
    return {"post":result, "verification_failed":True, "challenge":v.get("challenge_text")}

def create_and_verify_comment(post_id, content, parent_id=None):
    result = create_comment(post_id, content, parent_id)
    v = result.get("comment",{}).get("verification")
    if not v: return result
    answer = solve_verification(v.get("challenge_text",""))
    if answer:
        time.sleep(1)
        return {"comment":result, "verification": submit_verification(v["verification_code"], answer)}
    return {"comment":result, "verification_failed":True}
