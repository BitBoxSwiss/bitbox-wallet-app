all:
	make -C ../../knot/bindings/dbbdesktop/
	mkdir -p build
	qmake -o build/Makefile
	make -C build
	@echo "Binary: `pwd`/build/dbb"
