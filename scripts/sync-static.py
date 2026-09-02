#!/usr/bin/env python3
"""Regenerate the static fallback in index.html from data/*.json.

index.html ships complete content so the page works with JS off and is fully
indexable; main.js only replaces what it can load. That means the markup and
the JSON must agree. Run this after editing data/profile.json, overrides.json
or hackathons.json:

    python3 scripts/sync-static.py
"""
import json, re, html, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
load = lambda n: json.loads((root / 'data' / f'{n}.json').read_text(encoding='utf-8'))
profile, overrides, hacks = load('profile'), load('overrides'), load('hackathons')
src = (root / 'index.html').read_text(encoding='utf-8')

MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
def fm(s):
    y, m = s.split('-'); return f"{MON[int(m)-1]} {y}"

def sentence(b):
    """A bullet plus its optional metric clause, spliced before the period."""
    t = b['text'].rstrip() if isinstance(b, dict) else str(b).rstrip()
    if isinstance(b, dict) and b.get('metric'):
        t = re.sub(r'\.\s*$', '', t) + ', ' + b['metric'] + '.'
    return t

ITALIC = {  # phrases that keep their emphasis in the rendered markup
    "Evaluating Bias in LLMs&#x27; Responses to Patient-Oriented Tasks":
    "<em>Evaluating Bias in LLMs' Responses to Patient-Oriented Tasks</em>",
}

def experience_block():
    out = ['<div data-bind="experience">\n']
    for j in profile['experience']:
        when = f"{fm(j['start'])} —<br>" + (fm(j['end']) if j['end'] else '<span class="now">PRESENT</span>')
        org = " · ".join(x for x in [j['org'], j.get('location')] if x)
        out += ['\n        <article class="entry">\n',
                f'          <div class="when">{when}</div>\n          <div>\n',
                f'            <h3>{html.escape(j["title"])}</h3>\n',
                f'            <div class="org">{html.escape(org)}</div>\n            <ul class="bul">\n']
        for b in j['bullets']:
            t = html.escape(sentence(b))
            for k, v in ITALIC.items():
                t = t.replace(k, v)
            out.append(f'              <li>{t}</li>\n')
        out.append('            </ul>\n            <div class="tags">')
        out.append("".join(f'<span class="tag">{html.escape(s)}</span>' for s in j.get('stack', [])))
        out.append('</div>\n          </div>\n        </article>\n')
    out.append('\n      </div>')
    return "".join(out)

def sub(pattern, repl, text, what):
    text, n = re.subn(pattern, lambda m: repl(m) if callable(repl) else repl, text, count=1, flags=re.S)
    if n != 1:
        sys.exit(f"sync-static: could not replace {what} — index.html structure changed?")
    return text

src = sub(r'<div data-bind="experience">.*?\n      </div>', lambda m: experience_block(), src, "experience block")

nm = overrides['Nearmiss']
src = sub(r'(<div class="kicker">Current focus</div>\s*<h3>[^<]*</h3>\s*)<p>.*?</p>',
          lambda m: m.group(1) + '<p>' + html.escape(nm['blurb']) + '</p>', src, "lead blurb")
facts = "\n".join(
    f'            <div class="fact"><dt>{html.escape(f["label"])}</dt><dd>{html.escape(f["value"])}</dd></div>'
    for f in nm.get('facts', []))
src = sub(r'<dl class="facts">.*?</dl>', f'<dl class="facts">\n{facts}\n          </dl>', src, "facts")

for repo_heading, key in [("UTSAFindMySpot", "UTSAFindMySpot"), ("FairLane", "FairLane"), ("CityShield", "CityShield")]:
    blurb = overrides.get(key, {}).get('blurb')
    if not blurb:
        continue
    src = sub(r'(<div class="work-t">' + re.escape(repo_heading) + r'\s*<span class="arw">↗</span></div>\s*)<p>.*?</p>',
              lambda m, b=blurb: m.group(1) + '<p>' + html.escape(b) + '</p>', src, f"repo blurb {repo_heading}")

for pr in hacks['projects']:
    prize = f'<span class="prize">{html.escape(pr["award"])}</span>' if pr['won'] else '<span class="prize none">Submitted</span>'
    src = sub(r'(<h3>' + re.escape(pr['name']) + r'</h3>' + re.escape(prize) + r'</div>\s*)<p>.*?</p>',
              lambda m, t=pr['tagline']: m.group(1) + '<p>' + html.escape(t) + '</p>', src,
              f"hackathon {pr['name']}")

(root / 'index.html').write_text(src, encoding='utf-8')
print("index.html regenerated from data/*.json")
