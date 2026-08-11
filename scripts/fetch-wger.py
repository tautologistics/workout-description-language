#!/usr/bin/env python3
"""Fetch the wger exercise catalogue, politely.

    python3 scripts/fetch-wger.py

wger runs a small public instance, so this uses modest pages, a pause between
each, exponential backoff on failure, and writes progress after every page —
an interruption costs one request rather than the whole run, and re-running
resumes from what is on disk.

Written against urllib rather than Node's fetch: undici cannot connect to this
host in some environments (UND_ERR_CONNECT_TIMEOUT) while curl and urllib can.
"""
import json, os, sys, time, urllib.request, urllib.error

OUT = "docs/references/wger.json"
PAGE, PAUSE, MAX_RETRIES, TIMEOUT = 20, 2.5, 5, 45
UA = "wdl-registry/0.1 (workout definition language; one-off catalogue fetch)"

state = (json.load(open(OUT)) if os.path.exists(OUT)
         else {"source": "https://wger.de/api/v2/exerciseinfo/",
               "licence": "CC-BY-SA 4.0", "count": 0, "next": None, "results": []})
seen = {r["id"] for r in state["results"]}
url = state.get("next") or f"https://wger.de/api/v2/exerciseinfo/?limit={PAGE}&format=json"
pages = 0

while url:
    body = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            body = json.load(urllib.request.urlopen(req, timeout=TIMEOUT))
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 30))
                print(f"  rate limited, waiting {wait}s", file=sys.stderr, flush=True)
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            wait = min(60, 2 * 2 ** attempt)
            print(f"  attempt {attempt}/{MAX_RETRIES} failed ({e}), waiting {wait}s",
                  file=sys.stderr, flush=True)
            if attempt == MAX_RETRIES:
                url = None
                break
            time.sleep(wait)
    if not body:
        break

    for r in body["results"]:
        if r["id"] not in seen:
            seen.add(r["id"])
            state["results"].append(r)
    state["count"], state["next"] = body["count"], body["next"]
    url = body["next"]
    pages += 1
    json.dump(state, open(OUT, "w"))
    print(f"  {len(state['results'])}/{body['count']}", file=sys.stderr, flush=True)
    if url:
        time.sleep(PAUSE)

state["retrieved"] = time.strftime("%Y-%m-%d")
json.dump(state, open(OUT, "w"))
print(f"\n{len(state['results'])} of {state['count']} exercises in {OUT} ({pages} pages)")
if state.get("next"):
    print("Incomplete — re-run to resume from where it stopped.")
