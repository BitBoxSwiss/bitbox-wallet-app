# SPDX-License-Identifier: Apache-2.0

convert ../app_icon_source.png -resize 1024x icon_1024x1024x32.png
convert ../app_icon_source.png -resize 512x icon_512x512x32.png
convert ../app_icon_source.png -resize 256x icon_256x256x32.png
convert ../app_icon_source.png -resize 32x icon_32x32x32.png
convert ../app_icon_source.png -resize 16x icon_16x16x32.png
png2icns icon.icns icon_1024x1024x32.png icon_512x512x32.png icon_256x256x32.png icon_32x32x32.png icon_16x16x32.png
rm icon_1024x1024x32.png icon_512x512x32.png icon_256x256x32.png icon_32x32x32.png icon_16x16x32.png
cp icon.icns Testnet.app/Contents/Resources/icon.icns
