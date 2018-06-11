echo '<!DOCTYPE RCC><RCC version="1.0"><qresource>' > assets.qrc
find ../web/build/ -type f -maxdepth 1 | sed -e "s|../web/build/||" | awk '{ print "<file alias=\"" $1 "\">../web/build/" $1 "</file>" '} >> assets.qrc
echo '</qresource></RCC>' >> assets.qrc
rcc -binary assets.qrc -o build/assets.rcc
