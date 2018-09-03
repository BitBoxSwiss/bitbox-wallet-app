The BitBox Wallet supports building on X86_64 machines. Building on 32bit
systems is may be possible but it is explicitly unsupported. The following
platforms should be viable for development, building, and use of the BitBit
Wallet application.

* Debian GNU/Linux: Stretch and Buster
* Fedora: 26, 27, 28, and 29
* Ubuntu: 14.04, 16.04, 17.10, and 18.04
* MacOS: 10.13
* Windows: Windows 7, Windows 10

## Debian GNU/Linux

Install Docker:
`./scripts/docker_install.sh`

Initalize the Docker image:
`make dockerinit`
`make dockerdev`

Within the Docker dev environment, build the QT frontend:
`make qt-linux`

## Ubuntu

Install Docker:
`./scripts/docker_install.sh`

Initalize the Docker image:
`make dockerinit`
`make dockerdev`

Inside of Docker, build the QT frontend:
`make qt-linux`

## Fedora

Install [Docker for Fedora]
(https://docs.docker.com/install/linux/docker-ce/fedora/#install-using-the-repository):

Initalize the Docker image:
`make dockerinit`
`make dockerdev`

Inside of Docker, build the QT frontend:
`make qt-linux`

## MacOS

Prepare the MacOS system to have the build environment:
`make osx-init`

Build the QT frontend for MacOS:
`make qt-osx`

## Windows

The exact steps to build are documented in `appveyor.yml` and there is no
automated Windows build environment setup Makefile target. The Windows build
process is currently a work in progress. The build requires `mingw-w64`,
`bash`, `make`, `Microsoft Visual Studio 2017`, `go 1.10`, `yarn`, `QT 5.11.1`
and possibly other tools. 

Build the QT frontend for Windows:
`cd frontends/qt/server/`
`make -f Makefile.windows windows-legacy`
`cd .. && mkdir build && cd build`
`qmake ..\BitBox.pro`
`nmake`
`cd .. && bash windows_post.sh`

Other GNU/Linux systems should be able to run AppImage releases. Builds may
be produced with or without Docker on each supported platform.
