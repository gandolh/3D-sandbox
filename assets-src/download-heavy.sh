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


echo '→ polyhaven/tree_small_02  (110.0 MB)'
mkdir -p 'polyhaven/tree_small_02'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/tree_small_02/tree_small_02_2k.gltf' 'polyhaven/tree_small_02/tree_small_02_2k.gltf' 9075
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_nor_gl_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_branch_nor_gl_2k.jpg' 1781975
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_diff_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_branch_diff_2k.jpg' 1425692
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_branch_arm_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_branch_arm_2k.jpg' 1147503
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_nor_gl_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_leaves_nor_gl_2k.jpg' 2395771
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_diff_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_leaves_diff_2k.jpg' 961870
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_leaves_arm_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_leaves_arm_2k.jpg' 2191542
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_nor_gl_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_nor_gl_2k.jpg' 4555311
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_diff_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_diff_2k.jpg' 3170612
mkdir -p 'polyhaven/tree_small_02/textures'
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/tree_small_02/tree_small_02_arm_2k.jpg' 'polyhaven/tree_small_02/textures/tree_small_02_arm_2k.jpg' 2586815
fetch_one 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/tree_small_02/tree_small_02.bin' 'polyhaven/tree_small_02/tree_small_02.bin' 95102324

