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
FROM thyrlian/android-sdk:9.3 AS android

FROM ubuntu:22.04

# Android
COPY --from=android /opt/android-sdk /opt/android-sdk

RUN --mount=target=/mnt,source=scripts DEBIAN_FRONTEND=noninteractive /mnt/docker_install.sh

# In this path executables will be installed during docker build
ARG SYS_GOPATH=/opt/go
ENV PATH=${SYS_GOPATH}/bin:/usr/local/go/bin:$PATH

RUN --mount=target=/mnt/Makefile,source=Makefile --mount=target=/mnt/version.mk.inc,source=version.mk.inc GOPATH=${SYS_GOPATH} make -C /mnt envinit

ENV PATH=/opt/qt6/6.8.2/gcc_64/bin:/opt/qt6/6.8.2/gcc_64/libexec:$PATH

CMD ["bash"]
