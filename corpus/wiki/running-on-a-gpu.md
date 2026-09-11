---
summary: Why the path tracer falls back to software under WSL2, and the exact browser flags that reach the real GPU — with measured numbers for both.
updated: 2026-09-11
---

# Running on a GPU

The path tracer is the only part of Solstice whose usefulness depends on the
machine underneath it. Everything else — geometry, solar, physics, the linter —
is headlessly testable and equally correct at any speed. This page records what
it takes to get the renderer onto real hardware from this development machine,
because the answer is non-obvious and cost a session to find.

## The measurement

Same scene (`villa-carpathia`), same 2,000-sample budget:

| Backend | Samples | Time | Rate | Resolution |
|---|---|---|---|---|
| SwiftShader (Chromium default) | 0.22 | 74 s | ~0.003 /s | 960×540 |
| D3D12 → AMD Radeon (WSL2) | 538.7 | 168 s | ~3.2 /s | 1920×1080 |

About a thousandfold — and the GPU run was doing **four times the pixels**, so per
pixel it is nearer four thousandfold. A 2,000-sample shot at 1920×1080 is roughly
**ten minutes**, against a software figure that extrapolates past a week.

The render target is sized by the shot, not by the viewport canvas
(`PathTraceSession` calls `setSize(settings.width, settings.height)`), so the
browser window size does not enter into these numbers.

Rate is steady from the first reading onward (225 samples at 68.9 s → 3.26 /s;
538.7 at 168.4 s → 3.20 /s), so BVH build is not a meaningful share of a shot of
this size.

## Why headless falls back to software

WSL2 exposes the GPU as `/dev/dxg`, and Mesa's `d3d12` gallium driver talks to it
through `libdxcore.so`. `glxinfo -B` confirms it:
`D3D12 (AMD Radeon (TM) Graphics)`, `Accelerated: yes`, GLES 3.1 — comfortably
above the GLES 3.0 that WebGL2 needs.

**Chromium cannot see it.** Its GPU process enumerates adapters through
`/dev/dri`, which does not exist under WSL2; there is no code path in Chromium
that knows what `/dev/dxg` is. With no adapter found it falls back to SwiftShader
and reports success, so nothing in the app or the console indicates a problem.
The only symptom is the sample rate.

Passing GPU flags to a *headless* browser does not help. Verified failures:

- `--use-gl=angle --use-angle=gl` → still SwiftShader
- `--use-gl=egl` → still SwiftShader
- `--use-angle=vulkan` → **no WebGL2 context at all**. There is no Vulkan ICD for
  D3D12 on this machine (`/usr/share/vulkan/icd.d` has intel, radeon, lvp and
  virtio; Mesa's `dzn` Vulkan-on-D3D12 driver is not installed), and the listed
  `radeon_icd` wants the `amdgpu` kernel driver, which WSL does not provide.

## What works

**Headed, through WSLg's X server.** WSLg runs a real X server on `:0` with Mesa
already bound to `d3d12` — which is why `glxinfo` succeeds where Chromium fails.
Given an X11 surface, ANGLE's desktop-GL backend picks up that same context:

```
--ozone-platform=x11
--use-gl=angle
--use-angle=gl
--ignore-gpu-blocklist
--disable-gpu-sandbox
--no-sandbox
--enable-gpu-rasterization
```

With `agent-browser`, that is `--headed` plus `--args` (comma-separated), or the
`AGENT_BROWSER_ARGS` environment variable:

```bash
agent-browser open http://localhost:5173/ --session gpu --headed \
  --args "--ozone-platform=x11,--use-gl=angle,--use-angle=gl,--ignore-gpu-blocklist,--disable-gpu-sandbox,--no-sandbox,--enable-gpu-rasterization"
```

**`--headed` is load-bearing, not cosmetic.** It is what supplies the X11 surface
the whole path hangs off. `--use-gl=desktop` on the same X11 surface yields no
WebGL2 context and is not a substitute.

## Verifying, not assuming

The renderer will happily produce a correct image on SwiftShader, so *looking at
the render proves nothing about the backend*. Check the string:

```js
const gl = document.createElement('canvas').getContext('webgl2');
const d = gl.getExtension('WEBGL_debug_renderer_info');
gl.getParameter(d.UNMASKED_RENDERER_WEBGL);
```

- `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) …)` → software.
- `ANGLE (Microsoft Corporation, D3D12 (AMD Radeon (TM) Graphics), OpenGL 4.2)` →
  the real GPU.

Do this before quoting any render timing. It is one eval and it is the difference
between a number worth recording and a number that means nothing.

## What this does not settle

This is an **integrated** Radeon sharing system memory. It is enough to make
interactive path tracing feel real and to make sample budgets measurable, but a
discrete GPU would change the numbers again. Shot defaults (2,000 samples) and
the absence of a denoiser are still open — now testable rather than guesswork.
See [open-questions.md](open-questions.md).
