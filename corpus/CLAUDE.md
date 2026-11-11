# Corpus conventions — Solstice

This `corpus/` is an LLM-maintained wiki. **Read `index.md` first**, then at most
**2–3 wiki pages**. Needing more is a signal a page must split, not a licence to
read more.

## Layout

- `wiki/` — the synthesis. The LLM owns this and rewrites it freely.
- `briefs/{todo,done,superseded}/` — **immutable** work specs, `NN-slug.md`.
  Numbers are stable for the life of the file; never renumber on a move.
  Briefs run in number order; `wiki/status.md` doesn't list them. Numbering
  restarted at 01 on 2026-11-02: the seventy-nine briefs before that were folded
  into the wiki and deleted, and the last commit holding them is `f8f39a0`
  (`log.md`, "Briefs reset").
- Code comments and test titles don't cite brief numbers ("brief 46", "(brief
  75)"). Say what the code does and why, or give the date; the history belongs
  in `log.md`.
- `todos/` — captured prose, pre-spec.
- `log.md` — chronological, newest last. Absolute dates only.
- `index.md` — generated catalog. Regenerate with `bash corpus/lint.sh --index`.

## Source-of-truth ordering

1. The **actual code** beats any wiki claim.
2. A brief in **`done/`** beats `wiki/` if the wiki hasn't caught up.
3. **`decisions.md`** beats `status.md` for choices not formally revisited.

Verify any path, symbol or command a page names before acting on it — pages drift.

## Project invariants

They apply outside the corpus too, so they live in the root [CLAUDE.md](../CLAUDE.md)
("Invariants"). Read them there; they are deliberate, so don't "fix" them.

## Workflow

Capture → `todos/`. Promote → `briefs/todo/NN-slug.md`. Build → move verbatim to
`briefs/done/`, append a `log.md` entry, fold durable findings into `wiki/`.
Never commit corpus changes unless asked.

## brief-board

Brief progress goes on brief-board. Run `brief-board guide` before you
start or resume a brief, and follow it.
