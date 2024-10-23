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
FROM thyrlian/android-sdk:4.0 as android

FROM ubuntu:20.04

ENV DEBIAN_FRONTEND noninteractive

# Android
COPY --from=android /opt/android-sdk /opt/android-sdk

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

ADD Makefile /tmp/
RUN make -C /tmp/ envinit

ENV PATH /opt/qt6/6.2.4/gcc_64/bin:/opt/qt6/6.2.4/gcc_64/libexec:$PATH

CMD ["bash"]
