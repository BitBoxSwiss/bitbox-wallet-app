SECURITYFLAGS = " -O2 -D_FORTIFY_SOURCE=2 "
SECURITYFLAGS += " -fstack-protector-all -fPIC -fPIE"
SECURITYFLAGS += " -fstack-check "
EXTLDFLAGS:="-Wl,-z,now,-z,relro,-z,noexecstack,-z,noexecheap,-z,defs,-pie,-s,-E"
CXXFLAGS += ${SECURITYFLAGS}
CFLAGS += ${SECURITYFLAGS}
LFLAGS += ${EXTLDFLAGS}
export CXXFLAGS
export CFLAGS
export LFLAGS
export CGO_LDFLAGS_ALLOW=".*"
export CGO_CFLAGS_ALLOW=".*"
build:
	CGO_ENABLED=1 go build -buildmode=c-shared -ldflags -extldflags=${EXTLDFLAGS} -o libserver.so
windows:
	CGO_ENABLED=1 go build -ldflags="-s -w" -buildmode=c-archive -o libserver.a
	gcc server.def libserver.a -shared -lwinmm -lhid -lsetupapi -lWs2_32 -o libserver.dll -Wl,--out-implib,libserver.lib
