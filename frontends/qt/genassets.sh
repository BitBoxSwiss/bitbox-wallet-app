# SPDX-License-Identifier: Apache-2.0

set -e

output=${1:?missing output path}

if [ ! -d ../web/build ]; then
    echo "Web assets have not been built." 1>&2
    exit 1
fi

echo '<!DOCTYPE RCC><RCC version="1.0"><qresource>' > assets.qrc
find ../web/build/ -maxdepth 3 -type f | sort | sed -e "s|../web/build/||" | awk '{ print "<file alias=\"" $1 "\">../web/build/" $1 "</file>" '} >> assets.qrc

echo '<file alias="trayicon.png">resources/trayicon.png</file>' >> assets.qrc
echo '<file alias="trayicon-dark.png">resources/trayicon-dark.png</file>' >> assets.qrc
echo '</qresource></RCC>' >> assets.qrc
mkdir -p "$(dirname "$output")"
rcc -binary assets.qrc -o "$output"
cat assets.qrc
rm assets.qrc
