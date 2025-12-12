# SPDX-License-Identifier: Apache-2.0

convert ../app_icon_source.png  -bordercolor white -border 0 \
      \( -clone 0 -resize 16x16 \) \
      \( -clone 0 -resize 20x20 \) \
      \( -clone 0 -resize 24x24 \) \
      \( -clone 0 -resize 32x32 \) \
      \( -clone 0 -resize 48x48 \) \
      \( -clone 0 -resize 64x64 \) \
      \( -clone 0 -resize 256x256 \) \
      -delete 0 icon.ico
