FROM shiftcrypto/qt5

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

ADD Makefile /tmp/
RUN make -C /tmp/ envinit

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
RUN apt-get -y install --no-install-recommends fuse && cd /opt && wget https://github.com/probonopd/linuxdeployqt/releases/download/continuous/linuxdeployqt-continuous-x86_64.AppImage && chmod +x /opt/linuxdeployqt-continuous-x86_64.AppImage

ENV PATH /opt/qt5/bin:$PATH

CMD ["bash"]