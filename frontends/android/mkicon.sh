#!/usr/bin/env bash
# This script requires convert tool from ImageMagick and optipng.
# The output is nondeterministic.
set -e

thisdir=$(dirname ${0})
source=${thisdir}/icon_source.png
res=${thisdir}/BitBoxApp/app/src/main/res

convert -resize 48x48 ${source} ${res}/mipmap-mdpi/ic_launcher.png
convert -resize 72x72 ${source} ${res}/mipmap-hdpi/ic_launcher.png
convert -resize 96x96 ${source} ${res}/mipmap-xhdpi/ic_launcher.png
convert -resize 144x144 ${source} ${res}/mipmap-xxhdpi/ic_launcher.png
convert -resize 192x192 ${source} ${res}/mipmap-xxxhdpi/ic_launcher.png

find ${res} -name ic_launcher.png -exec optipng -quiet {} \;
