# Run with -P over a layout file that doxygen -l has just written.
#
# Doxygen calls a \defgroup page a topic, and labels the tab holding them "Topics". This library
# calls the same nine things its components, which is what the README calls them, and one word for
# one idea is worth a build step.
#
# The layout is generated rather than committed for the reason a custom HTML_HEADER is not used
# either: it is 269 lines of somebody else's defaults, and a Doxygen that grows a section would
# have it silently missing from a copy taken today. Generating it means it is always the running
# Doxygen's own, with one attribute changed.
#
# A version that has no such tab will not match, and this leaves the file alone.

if(NOT EXISTS ${LAYOUT})
    message(FATAL_ERROR "doxygen -l wrote no layout at ${LAYOUT}")
endif()

# The tab carries both the name it is listed under and the sentence at the top of the page it
# leads to, and the second one says "topics" in Doxygen's own words rather than in a title we set.
file(READ ${LAYOUT} _content)
string(REPLACE "<tab type=\"topics\" visible=\"yes\" title=\"\" intro=\"\"/>"
               "<tab type=\"topics\" visible=\"yes\" title=\"Components\" intro=\"Each is defined by the header that owns it, with a description and an example of its own.\"/>"
               _fixed "${_content}")

if(_fixed STREQUAL _content)
    message(WARNING "This Doxygen spells the topics tab differently, so it keeps its own name")
else()
    file(WRITE ${LAYOUT} "${_fixed}")
endif()
