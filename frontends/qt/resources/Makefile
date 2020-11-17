SIZES=16x16 32x32 48x48 64x64 128x128

TARGETS=$(addprefix linux/usr/share/icons/hicolor/, $(addsuffix /apps/bitbox.png, ${SIZES}))

all: $(TARGETS)

linux/usr/share/icons/hicolor/%/apps/bitbox.png: app_icon_source.png
	mkdir -p $(@D)
	convert $< -resize '$*' $@
