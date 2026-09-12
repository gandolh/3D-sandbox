#!/usr/bin/env bash
# The assets `download.sh` skips for size. Generated — re-run `npm run assets`.
# These are decimation *sources*, not things to commit: see DOWNLOADS.md.
set -euo pipefail
cd "$(dirname "$0")"

fetch_one() {                                 # url target expected_bytes
  local url="$1" target="$2" want="$3" got

  if [ -f "$target" ]; then
    got=$(wc -c < "$target")
    if [ "$want" -gt 0 ] && [ "$got" -ne "$want" ]; then
      echo "  ! $target is $got bytes, expected $want — refetching" >&2
      rm -f "$target"
    elif [ "$got" -lt 512 ]; then
      echo "  ! $target is only $got bytes — suspiciously small, refetching" >&2
      rm -f "$target"
    else
      return 0
    fi
  fi

  # Never onto the target itself: an interrupted transfer must not leave
  # something the existence check above will accept for the rest of time.
  curl -fsSL -o "$target.part" "$url"
  got=$(wc -c < "$target.part")
  if [ "$want" -gt 0 ] && [ "$got" -ne "$want" ]; then
    rm -f "$target.part"
    echo "  ✗ $target: got $got bytes, expected $want" >&2
    return 1
  fi
  mv "$target.part" "$target"
}


echo "→ polyhaven/fir_tree_01  (486.6 MB)"
mkdir -p "polyhaven/fir_tree_01"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/fir_tree_01/fir_tree_01_2k.gltf" "polyhaven/fir_tree_01/fir_tree_01_2k.gltf" 30279
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_bark_nor_gl_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_bark_nor_gl_2k.jpg" 3920997
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_bark_diff_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_bark_diff_2k.jpg" 2839282
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_bark_arm_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_bark_arm_2k.jpg" 2783615
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_a_nor_gl_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_a_nor_gl_2k.jpg" 3642074
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_a_diff_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_a_diff_2k.jpg" 3028704
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_a_arm_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_a_arm_2k.jpg" 2974686
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_twig_nor_gl_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_twig_nor_gl_2k.jpg" 1611490
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_twig_diff_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_twig_diff_2k.jpg" 1141996
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_twig_arm_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_twig_arm_2k.jpg" 1271524
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_b_nor_gl_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_b_nor_gl_2k.jpg" 3269280
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_b_diff_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_b_diff_2k.jpg" 2548347
mkdir -p "polyhaven/fir_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/fir_tree_01/fir_tree_01_trunk_b_arm_2k.jpg" "polyhaven/fir_tree_01/textures/fir_tree_01_trunk_b_arm_2k.jpg" 2718246
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/fir_tree_01/fir_tree_01.bin" "polyhaven/fir_tree_01/fir_tree_01.bin" 478462204

echo "→ polyhaven/pine_tree_01  (936.7 MB)"
mkdir -p "polyhaven/pine_tree_01"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/pine_tree_01/pine_tree_01_2k.gltf" "polyhaven/pine_tree_01/pine_tree_01_2k.gltf" 30596
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_bark_nor_gl_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_bark_nor_gl_2k.jpg" 3373886
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_bark_diff_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_bark_diff_2k.jpg" 2700448
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_bark_arm_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_bark_arm_2k.jpg" 2941366
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_a_nor_gl_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_a_nor_gl_2k.jpg" 3642074
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_a_diff_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_a_diff_2k.jpg" 3028704
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_a_arm_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_a_arm_2k.jpg" 2974686
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_twig_nor_gl_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_twig_nor_gl_2k.jpg" 2924424
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_twig_diff_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_twig_diff_2k.jpg" 1623201
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_twig_arm_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_twig_arm_2k.jpg" 1524195
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_b_nor_gl_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_b_nor_gl_2k.jpg" 3269280
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_b_diff_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_b_diff_2k.jpg" 2548347
mkdir -p "polyhaven/pine_tree_01/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/pine_tree_01/pine_tree_01_trunk_b_arm_2k.jpg" "polyhaven/pine_tree_01/textures/pine_tree_01_trunk_b_arm_2k.jpg" 2718246
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/pine_tree_01/pine_tree_01.bin" "polyhaven/pine_tree_01/pine_tree_01.bin" 948849556

echo "→ polyhaven/tree_small_02  (110.0 MB)"
mkdir -p "polyhaven/tree_small_02"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/tree_small_02/tree_small_02_2k.gltf" "polyhaven/tree_small_02/tree_small_02_2k.gltf" 9075
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_nor_gl_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_branch_nor_gl_2k.jpg" 1781975
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_diff_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_branch_diff_2k.jpg" 1425692
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_arm_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_branch_arm_2k.jpg" 1147503
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_nor_gl_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_leaves_nor_gl_2k.jpg" 2395771
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_diff_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_leaves_diff_2k.jpg" 961870
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_arm_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_leaves_arm_2k.jpg" 2191542
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_nor_gl_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_nor_gl_2k.jpg" 4555311
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_diff_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_diff_2k.jpg" 3170612
mkdir -p "polyhaven/tree_small_02/textures"
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_arm_2k.jpg" "polyhaven/tree_small_02/textures/tree_small_02_arm_2k.jpg" 2586815
fetch_one "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/tree_small_02/tree_small_02.bin" "polyhaven/tree_small_02/tree_small_02.bin" 95102324

