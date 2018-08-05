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

FROM shiftcrypto/qt5

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

ADD Makefile /tmp/
RUN make -C /tmp/ envinit

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
RUN apt-get -y install --no-install-recommends fuse && \
    cd /opt && \
    wget https://github.com/probonopd/linuxdeployqt/releases/download/continuous/linuxdeployqt-continuous-x86_64.AppImage && \
    echo "c068b019a2bdb616df84775054d4149ea1832ace5db1f95e0e417ef27e01f980 /opt/linuxdeployqt-continuous-x86_64.AppImage" | sha256sum -c - && \
    chmod +x /opt/linuxdeployqt-continuous-x86_64.AppImage

# Install fpm to create deb/rpm packages
RUN apt-get -y install --no-install-recommends ruby ruby-dev build-essential && gem install --no-ri --no-rdoc fpm

ENV PATH /opt/qt5/bin:$PATH

CMD ["bash"]
