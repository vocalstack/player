import re, sys

def blocks(css):
    out, i, n = [], 0, len(css)
    while i < n:
        while i < n and css[i] in ' \n\t\r': i += 1
        if i >= n: break
        if css.startswith('/*', i):
            j = css.index('*/', i) + 2; i = j; continue
        j = css.index('{', i)
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        out.append((head, css[j + 1:k - 1]))
        i = k
    return out

def wanted(sel, classes):
    names = set(re.findall(r'\.([a-zA-Z][\w-]*)', sel))
    if not names: return False
    roots = {re.split(r'__|--', x)[0] for x in names}
    return bool(roots & classes)

def pick(css, classes, keep_all_at=False):
    res, frames = [], set()
    for head, body in blocks(css):
        if head.startswith('@keyframes'):
            res.append(('kf', head, body)); continue
        if head.startswith('@media') or head.startswith('@supports') or head.startswith('@container'):
            inner = [f'{h}{{{b}}}' for h, b in blocks(body) if wanted(h, classes)]
            if inner: res.append(('at', head, ''.join(inner)))
            continue
        if head.startswith('@'): continue
        if wanted(head, classes): res.append(('r', head, body))
    text = ''.join(f'{h}{{{b}}}\n' for k, h, b in res if k != 'kf')
    used = set(re.findall(r'animation(?:-name)?\s*:\s*([\w-]+)', text))
    for k, h, b in res:
        if k == 'kf' and h.split()[1] in used: text += f'{h}{{{b}}}\n'
    return text

if __name__ == '__main__':
    classes = set(open(sys.argv[2]).read().split())
    sys.stdout.write(pick(open(sys.argv[1]).read(), classes))
