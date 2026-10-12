#!/usr/bin/env python3
"""Refresh korean-conjugations.json from Dongsa All Levels.

C103 Item Conjugation is Work / Professional (line indexes 1/3, future 1/3/5/7).
This dump still stores All Levels so the hall can map by index.

Lemma set = unique Hangul headwords (ja_term before '|', NFC) of 動詞 / 形容詞
in korean-data.json. Already-complete dump rows are kept; only missing lemmas
are fetched. Uses curl because Python urllib SSL often fails on macOS.

Run from anywhere:

    python3 scripts/scrape_dongsa_conjugations.py
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from unicodedata import normalize

REPO = Path(__file__).resolve().parent.parent
OUT_JSON = REPO / "korean-conjugations.json"
HALL_JSON = REPO / "korean-data.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CollectionGalleryOnline/1.0"

TENSE_TO_FIELD = {
    "현재형": "present",
    "과거형": "past",
    "미래형": "future",
    "현재 의문형": "presentQuestion",
    "과거 의문형": "pastQuestion",
    "명령형": "command",
    "청유형": "suggestion",
}
OTHER_TENSES = {"연결형", "기타"}
EXPECTED = {
    "present": 4,
    "past": 4,
    "future": 8,
    "presentQuestion": 4,
    "pastQuestion": 4,
    "command": 4,
    "suggestion": 4,
    "other": 5,
}


class DongsaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.sections: list[dict] = []
        self.cur = None
        self.card = None
        self.buf: list[str] = []
        self.in_val = False
        self.in_name = False
        self.in_tense = False

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class") or ""
        classes = cls.split()
        if "conjugation-section" in classes:
            self.cur = {"tense": "", "cards": []}
            self.sections.append(self.cur)
        if "tense-korean" in classes:
            self.in_tense = True
            self.buf = []
        if "conjugation-card" in classes:
            self.card = {"value": "", "name": ""}
            if self.cur is not None:
                self.cur["cards"].append(self.card)
        if "conjugation-value" in classes:
            self.in_val = True
            self.buf = []
        if "conjugation-name" in classes:
            self.in_name = True
            self.buf = []

    def handle_endtag(self, tag):
        if self.in_tense:
            if self.cur is not None:
                self.cur["tense"] = "".join(self.buf).strip()
            self.in_tense = False
        if self.in_val:
            if self.card is not None:
                self.card["value"] = "".join(self.buf).strip()
            self.in_val = False
        if self.in_name:
            if self.card is not None:
                self.card["name"] = "".join(self.buf).strip()
            self.in_name = False

    def handle_data(self, data):
        if self.in_tense or self.in_val or self.in_name:
            self.buf.append(data)


def empty_entry(lemma: str) -> dict:
    return {
        "lemma": lemma,
        "present": [],
        "past": [],
        "future": [],
        "presentQuestion": [],
        "pastQuestion": [],
        "command": [],
        "suggestion": [],
        "other": [],
    }


def parse_html(html: str, lemma: str) -> dict:
    parser = DongsaParser()
    parser.feed(html)
    entry = empty_entry(lemma)
    other: list[str] = []
    for section in parser.sections:
        tense = section["tense"]
        values = [c["value"] for c in section["cards"] if c.get("value")]
        if tense in TENSE_TO_FIELD:
            entry[TENSE_TO_FIELD[tense]] = values
        elif tense in OTHER_TENSES:
            other.extend(values)
    entry["other"] = other
    return entry


def fetch(lemma: str, timeout: int = 30) -> dict:
    url = "https://koreanverb.app/conjugate/" + urllib.parse.quote(lemma)
    result = subprocess.run(
        ["curl", "-fsSL", "--max-time", str(timeout), "-A", UA, url],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        err = (result.stderr or "").strip() or f"curl exit {result.returncode}"
        raise RuntimeError(err)
    html = result.stdout
    if "conjugation-section" not in html:
        raise RuntimeError("no conjugation-section")
    return parse_html(html, lemma)


def is_complete(entry: dict | None) -> bool:
    if not entry:
        return False
    for key, n in EXPECTED.items():
        vals = entry.get(key) or []
        if len(vals) != n or any(not str(v).strip() for v in vals):
            return False
    return True


def hangul_headword(term: str) -> str:
    return normalize("NFC", str(term or "").split("|", 1)[0].strip())


def hall_lemmas() -> list[str]:
    rows = json.loads(HALL_JSON.read_text(encoding="utf-8"))
    seen: dict[str, None] = {}
    for row in rows:
        if row.get("pos") not in ("動詞", "形容詞"):
            continue
        head = hangul_headword(row.get("ja_term") or "")
        if head:
            seen.setdefault(head, None)
    return list(seen.keys())


def load_store() -> dict[str, dict]:
    if not OUT_JSON.exists():
        return {}
    existing = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    return {normalize("NFC", e["lemma"]): e for e in existing if is_complete(e)}


def scrape_one(lemma: str) -> tuple[str, dict | None, str | None]:
    last_err = None
    for attempt in range(4):
        try:
            entry = fetch(lemma)
            if not is_complete(entry):
                return lemma, entry, "incomplete"
            return lemma, entry, None
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            time.sleep(0.6 * (attempt + 1))
    return lemma, None, last_err


def write_atomic(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    if not HALL_JSON.exists():
        print(f"missing {HALL_JSON}", file=sys.stderr)
        return 1

    lemmas = hall_lemmas()
    store = load_store()
    todo = [h for h in lemmas if h not in store]
    print(f"hall lemmas {len(lemmas)} cached {len(store)} todo {len(todo)}", flush=True)

    failed: list[tuple[str, str]] = []
    incomplete: list[str] = []
    done = 0
    if todo:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futs = [pool.submit(scrape_one, lemma) for lemma in todo]
            for fut in as_completed(futs):
                lemma, entry, err = fut.result()
                done += 1
                if err == "incomplete" and entry:
                    incomplete.append(lemma)
                elif entry and not err:
                    store[lemma] = entry
                else:
                    failed.append((lemma, err or "unknown"))
                if done % 50 == 0 or done == len(todo):
                    print(
                        f"progress {done}/{len(todo)} stored {len(store)} "
                        f"failed {len(failed)} incomplete {len(incomplete)}",
                        flush=True,
                    )

    ordered = [store[h] for h in sorted(lemmas) if h in store]
    write_atomic(OUT_JSON, json.dumps(ordered, ensure_ascii=False, indent=2) + "\n")
    hada = next((e for e in ordered if e["lemma"] == "하다"), None)
    complete = sum(1 for e in ordered if is_complete(e))
    print("written", len(ordered), "complete", complete)
    print("failed", len(failed), failed[:20])
    print("incomplete", len(incomplete), incomplete[:20])
    if hada:
        print("하다 present", hada["present"])
    if failed or incomplete or complete != len(lemmas):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
