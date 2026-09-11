# Task 12 — How many samples is enough

## Context

The shot default is 2,000 samples. I chose that number before the path tracer had
ever run on a GPU, from nothing. Now it can be measured: roughly 3.2 samples/sec
at 1920 × 1080 on this machine — see [running-on-a-gpu.md](../../wiki/running-on-a-gpu.md).

Nobody has compared a 500-sample render with a 3,000-sample one and said where it
stops improving. Until someone does, every shot's budget is a guess, and the
question of whether a denoiser is worth adding cannot be answered — which is why
that stays deferred behind this.

## Files you OWN

- `scenes/src/*.ts` — shot sample budgets, once measured
- `corpus/wiki/running-on-a-gpu.md` — the convergence findings
- Any small harness needed to run the study

## Files you must NOT touch

- The render path itself. This brief measures; it does not change how rendering
  works. If it turns out something is wrong with the tracer, that is a finding and
  a separate brief.

## What to do

1. **Render one shot at 250 / 500 / 1,000 / 2,000 / 3,000 samples**, same camera,
   same clock, keeping each image.
2. **Compare them honestly** — against each other, not against an ideal. Note where
   the difference stops being visible at 100%, and separately where it stops being
   visible at the size a person actually looks at.
3. **Pick defaults per shot kind** if they differ: an interior under a pergola
   converges more slowly than an open elevation, and if that shows up it is worth
   saying so rather than averaging it away.
4. **Record the numbers**, including wall-clock cost, so the next person changing
   a budget is arguing with evidence.
5. **Then** say whether a denoiser is worth a brief. That is the output, not an
   assumption going in.

## Acceptance

- A table of sample count against time and against visible quality, in the wiki.
- Shot budgets updated to what the study supports.
- A stated answer on denoising, with the reason.
