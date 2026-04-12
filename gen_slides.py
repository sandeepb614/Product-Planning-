import json, math
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── Colour palette (purple shades) ───────────────────────────────────────────
BG_DARK   = RGBColor(0x0F, 0x0B, 0x1E)   # near-black purple bg
BG_SLIDE  = RGBColor(0x16, 0x10, 0x2E)   # slide background
PANEL_BG  = RGBColor(0x22, 0x1A, 0x42)   # pill / card background
PANEL_BDR = RGBColor(0x3D, 0x2E, 0x6E)   # pill border / divider
ACCENT    = RGBColor(0x8B, 0x5C, 0xF6)   # bright purple accent
ACCENT2   = RGBColor(0xC0, 0x84, 0xFF)   # lighter purple
TEXT_PRI  = RGBColor(0xED, 0xE9, 0xFE)   # near-white text
TEXT_MUT  = RGBColor(0x9D, 0x8F, 0xC7)   # muted lavender

# Stage accent colours (left-border on pills)
STAGE_COLOR = {
    'Released':              RGBColor(0x34, 0xD3, 0x99),  # green
    'Released with Exception': RGBColor(0x34, 0xD3, 0x99),
    'Blocked':               RGBColor(0xF8, 0x71, 0x71),  # red
    'QA Testing':            RGBColor(0x22, 0xD3, 0xEE),  # cyan
    'HW Input':              RGBColor(0xFB, 0x92, 0x3C),  # orange
    'Dev Scheduling':        RGBColor(0xA7, 0x8B, 0xFA),  # purple
    'Test Planning':         RGBColor(0x86, 0xEF, 0xAC),  # light-green
    'Exception Pending PM':  RGBColor(0xFB, 0xBF, 0x24),  # amber
    'Draft':                 RGBColor(0x55, 0x4C, 0x7E),  # muted
    'PgM Review':            RGBColor(0x55, 0x4C, 0x7E),
    'On Hold':               RGBColor(0x55, 0x4C, 0x7E),
    'Cancelled':             RGBColor(0x4B, 0x44, 0x6A),
}

# ── Slide dimensions (16:9 widescreen) ───────────────────────────────────────
W = Inches(13.33)
H = Inches(7.5)

QUARTERS = [
    ('2025-03-31', 'Q1 2025'),
    ('2025-06-30', 'Q2 2025'),
    ('2025-09-30', 'Q3 2025'),
    ('2025-12-31', 'Q4 2025'),
    ('2026-03-31', 'Q1 2026'),
    ('2026-06-30', 'Q2 2026'),
    ('2026-09-30', 'Q3 2026'),
]

MAX_PER_SLIDE = 21   # max pills before splitting to a second slide


def solid_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color


def add_rect(slide, l, t, w, h, color):
    s = slide.shapes.add_shape(1, l, t, w, h)  # MSO_SHAPE_TYPE.RECTANGLE = 1
    solid_fill(s, color)
    s.line.fill.background()
    return s


def add_text_box(slide, text, l, t, w, h, size, color, bold=False, align=PP_ALIGN.LEFT, wrap=True):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    return tb


def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


# ── Load data ─────────────────────────────────────────────────────────────────
with open('/home/user/Product-Planning-/features_data.json') as f:
    raw = json.load(f)
features = raw['features'] if isinstance(raw, dict) else raw

# Group by quarter
groups = {q: [] for q, _ in QUARTERS}
for feat in features:
    rd = feat.get('target_release_date', '')
    if rd in groups:
        groups[rd].append(feat)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H

blank_layout = prs.slide_layouts[6]  # blank

# ══════════════════════════════════════════════════════════════════════════════
# COVER SLIDE
# ══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
set_slide_bg(slide, BG_DARK)

# Gradient-like top band
add_rect(slide, 0, 0, W, Inches(0.08), ACCENT)

# Decorative blobs (large translucent circles via rect with rounded corners)
blob = slide.shapes.add_shape(9, Inches(9.5), Inches(-1), Inches(5), Inches(5))  # oval
blob.fill.solid(); blob.fill.fore_color.rgb = RGBColor(0x2D, 0x1F, 0x5E)
blob.line.fill.background()

blob2 = slide.shapes.add_shape(9, Inches(-1), Inches(4.5), Inches(4), Inches(4))
blob2.fill.solid(); blob2.fill.fore_color.rgb = RGBColor(0x20, 0x16, 0x45)
blob2.line.fill.background()

# Title
add_text_box(slide, 'Product Planning', Inches(1.2), Inches(1.8), Inches(8), Inches(1.2),
             40, TEXT_PRI, bold=True, align=PP_ALIGN.LEFT)

# Subtitle
add_text_box(slide, 'Feature Release Timeline · Q1 2025 – Q3 2026',
             Inches(1.2), Inches(3.0), Inches(9), Inches(0.7),
             18, ACCENT2, bold=False, align=PP_ALIGN.LEFT)

# Stats line
total = len(features)
released = sum(1 for f in features if 'Released' in f.get('workflow_stage',''))
add_text_box(slide, f'{total} Features   ·   {released} Released   ·   7 Quarters',
             Inches(1.2), Inches(3.9), Inches(9), Inches(0.5),
             13, TEXT_MUT, align=PP_ALIGN.LEFT)

# Bottom accent line
add_rect(slide, 0, H - Inches(0.08), W, Inches(0.08), PANEL_BDR)

# Date
add_text_box(slide, 'April 2026', W - Inches(2.2), H - Inches(0.55),
             Inches(2), Inches(0.4), 11, TEXT_MUT, align=PP_ALIGN.RIGHT)

# ══════════════════════════════════════════════════════════════════════════════
# QUARTER SLIDES
# ══════════════════════════════════════════════════════════════════════════════
MARGIN_L = Inches(0.45)
MARGIN_T  = Inches(1.25)
CONTENT_W = W - Inches(0.9)
CONTENT_H = H - Inches(1.6)

PILL_H    = Inches(0.38)
PILL_GAP  = Inches(0.10)
ACCENT_W  = Inches(0.055)
COLS      = 3
COL_GAP   = Inches(0.22)
COL_W     = (CONTENT_W - COL_GAP * (COLS - 1)) / COLS

def render_quarter_slide(quarter_label, date_key, feats, part=None, total_parts=None):
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, BG_SLIDE)

    # Top accent bar
    add_rect(slide, 0, 0, W, Inches(0.06), ACCENT)

    # Header background strip
    add_rect(slide, 0, Inches(0.06), W, Inches(1.0), RGBColor(0x1A, 0x12, 0x36))

    # Quarter label
    part_suffix = f'  ({part}/{total_parts})' if total_parts and total_parts > 1 else ''
    add_text_box(slide, quarter_label + part_suffix,
                 MARGIN_L, Inches(0.18), Inches(5), Inches(0.55),
                 26, TEXT_PRI, bold=True)

    # Feature count badge
    count_label = f'{len(feats)} features'
    add_text_box(slide, count_label,
                 W - Inches(2.2), Inches(0.26), Inches(2), Inches(0.4),
                 12, TEXT_MUT, align=PP_ALIGN.RIGHT)

    # Bottom bar
    add_rect(slide, 0, H - Inches(0.06), W, Inches(0.06), PANEL_BDR)

    # Page number hint
    add_text_box(slide, date_key,
                 W - Inches(2.2), H - Inches(0.46), Inches(2), Inches(0.35),
                 10, TEXT_MUT, align=PP_ALIGN.RIGHT)

    # Pills — 3 columns
    rows_per_col = math.ceil(len(feats) / COLS)

    for idx, feat in enumerate(feats):
        col = idx // rows_per_col
        row = idx % rows_per_col

        x = MARGIN_L + col * (COL_W + COL_GAP)
        y = MARGIN_T + row * (PILL_H + PILL_GAP)

        stage = feat.get('workflow_stage', '')
        sc = STAGE_COLOR.get(stage, PANEL_BDR)

        # Pill background
        pill = add_rect(slide, x, y, COL_W, PILL_H, PANEL_BG)
        pill.line.color.rgb = PANEL_BDR
        pill.line.width = Emu(6350)  # 0.5pt

        # Left accent stripe
        add_rect(slide, x, y, ACCENT_W, PILL_H, sc)

        # Feature title text
        title = feat.get('feature_title', '')
        tb = slide.shapes.add_textbox(
            x + ACCENT_W + Inches(0.08), y + Inches(0.04),
            COL_W - ACCENT_W - Inches(0.12), PILL_H - Inches(0.08)
        )
        tf = tb.text_frame
        tf.word_wrap = False
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = title
        run.font.size = Pt(9.5)
        run.font.color.rgb = TEXT_PRI


# ── Render each quarter, splitting if > MAX_PER_SLIDE ─────────────────────────
for date_key, label in QUARTERS:
    feats = groups.get(date_key, [])
    feats.sort(key=lambda f: f.get('feature_title', ''))

    if not feats:
        continue

    chunks = [feats[i:i+MAX_PER_SLIDE] for i in range(0, len(feats), MAX_PER_SLIDE)]
    for part_idx, chunk in enumerate(chunks):
        render_quarter_slide(
            label, date_key, chunk,
            part=part_idx + 1,
            total_parts=len(chunks)
        )

# ── Save ──────────────────────────────────────────────────────────────────────
out = '/home/user/Product-Planning-/quarterly_timeline.pptx'
prs.save(out)
print(f'Saved: {out}')
print(f'Slides: {len(prs.slides)}')
