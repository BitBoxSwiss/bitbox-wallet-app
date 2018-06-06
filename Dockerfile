FROM ubuntu:14.04

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

ADD Makefile /tmp/
RUN make -C /tmp/ envinit

COPY --from=dev.shiftcrypto.ch:443/qt5 /opt/qt5 /opt/qt5

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
RUN apt-get -y install --no-install-recommends fuse libxcb-xinerama0 libxcb-xkb-dev libxcb-render-util0 libxcb-image0 libxcb-keysyms1 libxcb-icccm4 libcups2 libgl1-mesa-dev libegl1-mesa-dev libfontconfig1-dev libfreetype6-dev libxi-dev libxcursor-dev libxrender-dev libxss-dev libxcomposite-dev libasound2-dev libxtst-dev libxslt-dev libnss3-dev libicu-dev && cd /opt && wget https://github.com/probonopd/linuxdeployqt/releases/download/continuous/linuxdeployqt-continuous-x86_64.AppImage

ENV PATH /opt/qt5/bin:$PATH

CMD ["bash"]