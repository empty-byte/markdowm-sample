# UI Similarity Check

## Goal
Quantify visual similarity between current page and `code.html` and enforce a pass line (`>=95%`).

## Script
- `scripts/visual-similarity.mjs`

## Metrics
- `strict`: pixel-accurate RMSE similarity (very sensitive to text anti-alias / dynamic content)
- `perceptual` (default): downscaled layout similarity (64x36) to measure overall visual structure
- `hybrid`: weighted (`85% perceptual + 15% strict`)

For this project, use `perceptual` as release gate to match design-level similarity target.

## Commands

Start app (dev or preview):

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Run similarity check:

```bash
node scripts/visual-similarity.mjs \
  --current http://localhost:5173/ \
  --reference "C:/Users/Lenovo/Downloads/stitch/code.html" \
  --browser "C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --viewport 1365x768 \
  --threshold 95 \
  --metric perceptual
```

## Output
The script prints:
- Perceptual similarity
- Strict similarity
- Selected similarity (based on `--metric`)
- PASS/FAIL status
- Artifact folder (`output/visual-similarity/<timestamp>`)

## Pass rule
- `Selected similarity >= 95%` => PASS
- otherwise FAIL

## Notes
- Keep browser path fixed for stable results.
- Keep viewport fixed for reproducibility.
- Use `strict` only for static, deterministic pages.

