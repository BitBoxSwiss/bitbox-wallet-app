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

if [ ! -d ../web/build ]; then
    echo "Web assets have not been built." 1>&2
    exit 1
fi

echo '<!DOCTYPE RCC><RCC version="1.0"><qresource>' > assets.qrc
/usr/bin/find ../web/build/ -maxdepth 3 -type f | sed -e "s|../web/build/||" | awk '{ print "<file alias=\"" $1 "\">../web/build/" $1 "</file>" '} >> assets.qrc

echo '<file alias="trayicon.png">resources/trayicon.png</file>' >> assets.qrc
echo '</qresource></RCC>' >> assets.qrc
mkdir -p build/
rcc -binary assets.qrc -o build/assets.rcc
cat assets.qrc
rm assets.qrc
