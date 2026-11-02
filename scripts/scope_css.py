import re, sys
sys.path.insert(0, sys.path[0])
from pick_css import blocks

ROOT = '.vsp'

def split_sel(sel):
    out, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: out.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur.strip())
    return out

def scope_one(s):
    if s in (':root',): return [ROOT]
    if s.startswith(':root'): s = s[5:].strip() or ''; return [ROOT + (' ' + s if s else '')]
    if s in ('html', 'body', '#root') or re.match(r'^(html|body)\b', s): return []
    if s.startswith(ROOT): return [s]
    m = re.match(r'^(\[data-theme=[^\]]+\])(.*)$', s)
    if m:
        rest = m.group(2)
        return [f'{ROOT}{m.group(1)}{rest}', f'{ROOT} {m.group(1)}{rest}']
    if s.startswith('::selection'): return [f'{ROOT} {s}']
    return [f'{ROOT} {s}']

def scope(css):
    out = []
    for head, body in blocks(css):
        if head.startswith('@keyframes') or head.startswith('@font-face'):
            out.append(f'{head}{{{body}}}')
        elif head.startswith('@'):
            out.append(f'{head}{{{scope(body)}}}')
        else:
            sels = [x for s in split_sel(head) for x in scope_one(s)]
            if sels: out.append(f'{",".join(sels)}{{{body}}}')
    return '\n'.join(out)

if __name__ == '__main__':
    sys.stdout.write(scope(open(sys.argv[1]).read()) + '\n')
