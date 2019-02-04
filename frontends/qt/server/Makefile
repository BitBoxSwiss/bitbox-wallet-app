include ../../../env.mk.inc

linux:
	$(MAKE) -f Makefile.linux linux
linux-clean:
	-$(MAKE) -f Makefile.linux clean

macosx:
	$(MAKE) -f Makefile.macosx darwin
macosx-clean:
	-$(MAKE) -f Makefile.macosx clean

windows:
	$(MAKE) -f Makefile.windows windows
windows-cross:
	$(MAKE) -f Makefile.windows windows-cross
windows-legacy:
	$(MAKE) -f Makefile.windows windows-legacy
windows-clean:
	-$(MAKE) -f Makefile.windows clean

install:
	install ${LIBNAME}.so ${DESTDIR}/usr/lib/${LIBNAME}.so
	install ${LIBNAME}.h ${DESTDIR}/usr/include/${LIBNAME}.h

clean: linux-clean macosx-clean windows-clean
	@echo "Cleaning all targets for ${LIBNAME}"
