build:
	CGO_ENABLED=1 go build -ldflags="-s -w" -buildmode=c-shared -o libserver.so
windows:
	CGO_ENABLED=1 go build -ldflags="-s -w" -buildmode=c-archive -o libserver.a
	gcc server.def libserver.a -shared -lwinmm -lhid -lsetupapi -lWs2_32 -o libserver.dll -Wl,--out-implib,libserver.lib
