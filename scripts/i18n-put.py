#!/usr/bin/env python3
"""사전 파일에 번역을 부분 갱신합니다. stdin 으로 JSON {locale: {key: value}} 를 받습니다.

    echo '{"en": {"검색": "Search"}}' | python3 scripts/i18n-put.py

키 목록 자체는 npm run i18n 이 관리합니다 — 여기서는 값만 채웁니다.
"""
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "app/lib/i18n"

ENTRY = re.compile(r'^\s*("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")\s*,\s*$', re.M)


def read_dict(name):
    src = io.open(I18N / f"{name}.ts", encoding="utf-8").read()
    return {json.loads(m[0]): json.loads(m[1]) for m in ENTRY.findall(src)}


def read_keys():
    src = io.open(I18N / "keys.ts", encoding="utf-8").read()
    return [json.loads(m) for m in re.findall(r'^\s*("(?:\\.|[^"\\])*"),$', src, re.M)]


def write_dict(name, entries, keys):
    body = "\n".join(
        f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(entries.get(k, ''), ensure_ascii=False)},"
        for k in keys
    )
    io.open(I18N / f"{name}.ts", "w", encoding="utf-8").write(
        f"// {name} 번역. 값이 비어 있으면 화면에 한국어 원문이 그대로 나옵니다.\n"
        f"// 키는 `npm run i18n` 이 관리합니다 — 값만 채우세요.\n"
        f'// 영어 복수형은 "{{n}} partner|{{n}} partners" 처럼 | 로 나눠 적습니다.\n\n'
        f'import type {{ MessageKey }} from "./keys";\n\n'
        f"export const {name}: Record<MessageKey, string> = {{\n{body}\n}};\n"
    )


payload = json.load(sys.stdin)
keys = read_keys()
known = set(keys)
for locale, pairs in payload.items():
    entries = read_dict(locale)
    unknown = [k for k in pairs if k not in known]
    if unknown:
        print(f"⚠️  {locale}: 키 목록에 없는 항목 {len(unknown)}개 — 무시합니다")
        for k in unknown[:5]:
            print(f"     · {k}")
    entries.update({k: v for k, v in pairs.items() if k in known})
    write_dict(locale, entries, keys)
    filled = sum(1 for k in keys if entries.get(k, "").strip())
    print(f"{locale}: {filled}/{len(keys)} 채움")
