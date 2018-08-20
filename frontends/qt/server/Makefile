include ../../../env.mk.inc

linux:
	make -f Makefile.linux linux
linux-clean:
	-make -f Makefile.linux clean

macosx:
	make -f Makefile.macosx darwin
macosx-clean:
	-make -f Makefile.macosx clean

windows:
	make -f Makefile.windows windows
windows-cross:
	make -f Makefile.windows windows-cross
windows-clean:
	-make -f Makefile.windows clean

install:
	install ${LIBNAME}.so ${DESTDIR}/usr/lib/${LIBNAME}.so
	install ${LIBNAME}.h ${DESTDIR}/usr/include/${LIBNAME}.h

clean: linux-clean macosx-clean windows-clean
	@echo "Cleaning all targets for ${LIBNAME}"
