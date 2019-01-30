# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM shiftcrypto/qt5:16.04

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

ADD Makefile /tmp/
ADD scripts/go-get.sh /tmp/scripts/
RUN make -C /tmp/ envinit

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
RUN apt-get -y install --no-install-recommends fuse && \
    cd /opt && \
    wget https://github.com/probonopd/linuxdeployqt/releases/download/5/linuxdeployqt-5-x86_64.AppImage && \
    echo "e5294433d97504a5081c354cdedfebe918dd50188c378d965f598576fcbbf5b4 /opt/linuxdeployqt-5-x86_64.AppImage" | sha256sum -c - && \
    chmod +x /opt/linuxdeployqt-5-x86_64.AppImage

# Install fpm to create deb/rpm packages
# (childprocess is a dependency of fpm which broke in 1.0.0, so pinning it explictly until resolved)
RUN apt-get -y install --no-install-recommends ruby ruby-dev build-essential rpm && gem install childprocess --version 0.9.0 && gem install --no-ri --no-rdoc fpm

ENV PATH /opt/qt5/bin:$PATH

CMD ["bash"]
