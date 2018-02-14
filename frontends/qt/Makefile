all:
	make -C server/
	mkdir -p build
	qmake -o build/Makefile
	make -C build
	@echo "Binary: `pwd`/build/dbb"
