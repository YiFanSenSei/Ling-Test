# -*- coding: utf-8 -*-
"""计算 tokens.css 色板的前景/背景对比度（WCAG 2.1 相对亮度公式）"""

def h2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def L(hexc):
    r, g, b = h2rgb(hexc)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(fg, bg):
    a, b = L(fg), L(bg)
    if a < b:
        a, b = b, a
    return (a + 0.05) / (b + 0.05)

def over(fg_hex, bg_hex, alpha):
    """alpha 合成（前景色带透明度叠在背景上）"""
    fr, fg_, fb = h2rgb(fg_hex)
    br, bg_, bb = h2rgb(bg_hex)
    return '#%02X%02X%02X' % (
        round((fr * alpha + br * (1 - alpha)) * 255),
        round((fg_ * alpha + bg_ * (1 - alpha)) * 255),
        round((fb * alpha + bb * (1 - alpha)) * 255),
    )

C = {
    'paper':       '#F5F1E8',
    'paper-deep':  '#EBE5D8',
    'paper-light': '#FBF9F3',
    'ink':         '#1C1A17',
    'ink-soft':    '#4A453D',
    'ink-faint':   '#8A8279',
    'ink-ghost':   '#C4BDB0',
    'cinnabar':    '#B23A2E',
    'cinnabar-deep': '#8C2A20',
    'cinnabar-wash': '#E8D5D1',
    'gold':        '#C9A961',
    'gold-soft':   '#E3D5B0',
    'azurite':     '#3A5A78',
    'azurite-soft': '#C5D2DE',
    'rule':        '#D9D2C4',
    'white':       '#FFFFFF',
}

def verdict(r, large=False):
    need = 3.0 if large else 4.5
    if r >= 7:
        return 'AAA'
    if r >= 4.5:
        return 'AA'
    if r >= 3:
        return 'AA大字/UI' if not large else 'AA大'
    return '不合格'

rows = []
for bgname in ['paper', 'paper-deep', 'paper-light', 'ink', 'cinnabar-wash', 'white']:
    for fgname in ['ink', 'ink-soft', 'ink-faint', 'ink-ghost', 'cinnabar', 'cinnabar-deep',
                   'gold', 'gold-soft', 'azurite', 'azurite-soft', 'rule']:
        r = ratio(C[fgname], C[bgname])
        rows.append((bgname, fgname, C[fgname], C[bgname], r, verdict(r)))

print('%-14s %-14s %-9s %-9s %8s  %s' % ('背景', '前景', '前景色', '背景色', '对比度', '判定'))
for bg, fg, f, b, r, v in rows:
    flag = '' if r >= 4.5 else ('  <<< 正文不合格' if r >= 3 else '  <<< 严重不合格')
    print('%-14s %-14s %-9s %-9s %8.2f:1  %s%s' % (bg, fg, f, b, r, v, flag))

print()
print('=== 半透明文字（叠在指定底色上）===')
cases = [
    ('rgba(245,241,232,0.72) on ink', '#F5F1E8', '#1C1A17', 0.72),
    ('rgba(245,241,232,0.55) on ink', '#F5F1E8', '#1C1A17', 0.55),
    ('rgba(245,241,232,0.60) on ink', '#F5F1E8', '#1C1A17', 0.60),
    ('rgba(245,241,232,0.35) on ink', '#F5F1E8', '#1C1A17', 0.35),
    ('rgba(245,241,232,0.55) on ink 叠 0.03 底', '#F5F1E8', '#1C1A17', 0.55),
]
for name, fg, bg, a in cases:
    comp = over(fg, bg, a)
    r = ratio(comp, bg)
    print('%-42s 合成色 %s  对比度 %5.2f:1  %s' % (name, comp, r, verdict(r)))

print()
print('=== 朱砂底上的浅色文字 / 深色文字 ===')
for fg in ['paper', 'paper-light', 'white', 'ink']:
    r = ratio(C[fg], C['cinnabar'])
    print('%-12s on cinnabar  对比度 %5.2f:1  %s' % (fg, r, verdict(r)))

print()
print('=== UI 组件 3:1（边框/图标/焦点环）===')
for fg, bg, what in [
    ('rule', 'paper', '卡片/输入框边框 --rule on 纸'),
    ('rule', 'paper-light', '--rule on 卡片底'),
    ('ink-ghost', 'paper', '--ink-ghost 分隔线/滚动条 on 纸'),
    ('cinnabar', 'paper', '焦点环 朱砂 on 纸'),
    ('cinnabar', 'cinnabar-wash', '焦点环 朱砂 on 朱砂wash 底'),
    ('cinnabar', 'ink', '焦点环 朱砂 on 深色区块'),
    ('gold', 'ink', '金色 on 深色区块'),
    ('gold', 'paper', '金色 on 纸'),
    ('azurite', 'paper', '石青 on 纸'),
]:
    r = ratio(C[fg], C[bg])
    print('%-34s %5.2f:1  %s' % (what, r, '达标' if r >= 3 else '不足 3:1'))

print()
print('=== 模拟器内 canvas 上的文字色（供参考）===')
for fg, bg, what in [
    ('ink-faint', 'paper-deep', 'ink-faint on 画布底'),
]:
    r = ratio(C[fg], C[bg])
    print('%-34s %5.2f:1' % (what, r))
