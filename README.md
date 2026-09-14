# SNICK — playable prototype

One swipe. Every shard counts.

Single file, no build step, no dependencies, no network calls. Open `index.html` and it runs.

## Deploy to GitHub Pages

1. New repo, push `index.html` to the root of `main`.
2. Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.
3. Open `https://<user>.github.io/<repo>/` on the iPhone.
4. Share → Add to Home Screen for fullscreen with no Safari chrome.

## What's implemented

The locked ruleset, in full:

| Rule | Value |
|---|---|
| Board | 6 × 12 cells, 1/8-cell sub-grid |
| Pieces | Convex polygons, no rotation, vertical fall only |
| Cut | Swipe casts an **infinite** line; every piece it crosses splits |
| Slivers | Under 0.5 cell of area → Dust, removed from the board |
| Weld | Same-colour pieces that touch fuse into one rigid body |
| Clear | A welded body clears at 4.0 cells of area |
| Hot edge | Fresh cut edges glow 0.4s and cannot weld |
| Blade | 3 charges, +1 per 1.4s, +1 per clear, +2 on a chain |
| Fail | Any piece settles above the danger line |

Also in: cut preview with target highlighting, 20px edge dead zone, colourblind
glyphs per colour on by default, WebAudio snick, DPR-correct rendering,
reduced-motion respected, best score persisted with an in-memory fallback.

## Verified by the test harness

`node test.js` extracts the game script from the HTML and runs it headlessly.
23 assertions, all passing. The ones that matter:

- **Cutting alone can never clear a block.** 12 cuts on one 1×1 block: zero clears.
  The original exploit is closed at the rule level.
- Cuts conserve area, including diagonals.
- Four touching same-colour blocks weld and clear; three weld and don't.
- Different colours never weld.
- Hot edges hold halves apart, then re-weld once cool.
- Slivers become Dust and the remainder survives intact.
- 90 seconds of randomised play: no NaN, no crash, peak 30 live bodies.

## One thing to watch in playtest

Repeated cutting *can* grind a block to nothing via the sliver rule. The test took
12 cuts and ~17 seconds to erase a single 1×1, against a ~1s spawn rate, so it
loses badly to just playing. If a tester finds a way to make grinding pay, the
fix is to stop awarding score for Dust, or raise `SLIVER` regen cost.

## Tuning knobs

All at the top of the script.

```
CLEAR_AREA   4.0    area needed to clear
SLIVER       0.5    below this, a shard becomes Dust
BLADE_MAX    3      charges
BLADE_REGEN  1400   ms per charge
HOT_MS       400    no-weld window after a cut
SNAP         16     cut vertices snap to 1/16 cell
ANGLES       64     swipe angle quantisation
```

Speed and spawn rate ramp off score in the `frame()` loop.

## Not in this build

Daily seed, leaderboard, Circle, Dust shop, cosmetics. All of that waits on the
two playtest questions: can a tester say why their run ended, and does anyone
find a degenerate strategy in three runs.
