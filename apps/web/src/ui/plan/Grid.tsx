import { memo } from "react";
import { gridLines, gridTier, toScreen, type ViewTransform, visibleExtent } from "../../lib/plan-view.js";

const n = (v: number): string => v.toFixed(1);

/**
 * The drawing grid: minor and major lines, in world metres.
 *
 * Only the lines on screen are generated, so a pan across a 400 m site costs
 * what one screen of lines costs. `gridTier` steps the spacing up by five when
 * the lines crowd, so zoomed out the grid thins rather than turning grey.
 * The two axes through the origin are drawn a shade darker, because "where is
 * zero" is the first question a typed coordinate raises.
 */
export const Grid = memo(function Grid({
  view,
  width,
  height,
}: {
  view: ViewTransform;
  width: number;
  height: number;
}) {
  const tier = gridTier(view.scale);
  const extent = visibleExtent(view, width, height);
  const xs = gridLines(extent.minX, extent.maxX, tier.minor);
  const zs = gridLines(extent.minZ, extent.maxZ, tier.minor);
  const isMajor = (v: number): boolean => Math.abs(v / tier.major - Math.round(v / tier.major)) < 1e-9;

  const path = (keep: (v: number) => boolean): string => {
    const parts: string[] = [];
    for (const x of xs) {
      if (!keep(x)) continue;
      const sx = toScreen(view, [x, 0])[0];
      parts.push(`M${n(sx)},0 V${n(height)}`);
    }
    for (const z of zs) {
      if (!keep(z)) continue;
      const sy = toScreen(view, [0, z])[1];
      parts.push(`M0,${n(sy)} H${n(width)}`);
    }
    return parts.join(" ");
  };

  const [ox, oy] = toScreen(view, [0, 0]);
  return (
    <g pointerEvents="none" shapeRendering="crispEdges" data-grid={`${tier.minor}/${tier.major}`}>
      {tier.minorAlpha > 0 && (
        <path
          d={path((v) => !isMajor(v))}
          stroke="#e6e6e6"
          strokeOpacity={tier.minorAlpha}
          strokeWidth={1}
          fill="none"
        />
      )}
      <path d={path(isMajor)} stroke="#cfcfcf" strokeWidth={1} fill="none" />
      <path
        d={`M${n(ox)},0 V${n(height)} M0,${n(oy)} H${n(width)}`}
        stroke="#a9a9a9"
        strokeWidth={1}
        fill="none"
      />
    </g>
  );
});
