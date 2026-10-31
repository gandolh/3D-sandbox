# README images

How each image was made, so the next refresh is a re-run. Re-take an image when the screen it shows changes. The first three show the bundled Greenhollow scene, which is made-up content, with the CC0 assets downloaded. The GIF draws a new house on Greenhollow's site; its first frame shows the viewport without the CC0 assets, which were not downloaded for it.

| File | Shows | How to reach that state | Viewport | Taken |
|---|---|---|---|---|
| sun-path.gif | Greenhollow from above while the solar clock runs 07:30 to 19:30 | `npm run dev`, wait for "12 model(s) loaded" in the footer, pick the Overview shot, seek the animation to 0, then set the Solar time slider from 07:30 to 19:30 in 12-minute steps, one screenshot per step | 1280×800 @1x, scaled to 960 wide | 2026-10-09 |
| wall-inspector.webp | The garden side with wall W-02 selected and its fields in the inspector | same, pick the Garden three-quarter shot, set the Solar time slider to 10:15, select W-02 in the scene tree | 1440×900 @2x | 2026-10-09 |
| plan.webp | The generated ground-floor plan | same, then press PLAN; cropped to the white sheet | 1440×1320 @2x | 2026-10-09 |
| draw-house.gif | New house, four typed walls, a door, two windows, a room, Save | `npm run dev` and `npm run api` against a scratch copy of `scenes/`, then the beats below, one screenshot per beat | 1280×800 @1x, GIF 960 px wide, 13 s | an empty level on Greenhollow's site, named Sample Cottage | 2026-10-31 |

## How they were captured

Headless Chrome through `agent-browser`, which renders WebGL on SwiftShader at a few frames per second. That is too slow to record the sun-path study playing in real time, so the GIF is stepped instead: each frame sets the clock, waits 1.2 s for the viewport to redraw, and takes a screenshot. The step that sets the clock:

```js
const el = document.querySelector('input[aria-label="Solar time"]');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "450"); // minutes after midnight
el.dispatchEvent(new Event("input", { bubbles: true }));
```

The 61 frames were joined at 8 fps:

```bash
ffmpeg -framerate 8 -i f%03d.png \
  -vf "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 sun-path.gif
```

At 128 colours the GIF came out just over the 5 MB budget, with no visible gain over 96.

Screenshots: `ffmpeg -i shot.png -c:v libwebp -quality 82 shot.webp`, plus `-vf crop=1310:1552:743:140` for the plan sheet.

The plan needs the tall viewport. At 1440×900 the sheet is taller than its pane and runs over the timeline.

## The drawing GIF

Never point the API at the repo's own `scenes/` for this: New house writes a scene file there. Copy the folder and start the API on the copy:

```bash
cp -r scenes /tmp/solstice-scenes
SOLSTICE_SCENES_DIR=/tmp/solstice-scenes SOLSTICE_INDEX_DB=/tmp/solstice-index.db npm run api
npm run dev
```

The beats, at 1280×800 with Playwright and Chrome on SwiftShader, one screenshot after each:

1. New house, title "Sample Cottage", Create. The plan view opens with the Wall tool.
2. Click a start point. For each leg move the pointer the way the wall runs, type the length, Tab, the bearing, Enter: `8` `90`, `6` `180`, `8` `270`, `6` `0`. Enter ends the chain.
3. Door, click the middle of the south wall. Window, click the north wall, then the east wall.
4. Room, click inside, type "Living room", Add room. Select, then Save.

Join the frames with an ffmpeg concat list, 0.45 s a frame, about 1 s on the dialog, the closed walls and the room, 2.2 s on the last, then the palette filter above at `fps=10`.
