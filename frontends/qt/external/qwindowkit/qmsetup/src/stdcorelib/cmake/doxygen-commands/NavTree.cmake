# Run with -P over the generated navtree.js.
#
# Doxygen 1.17.0 builds the treeview labels with
#
#     ahref.textContent = escapeHtml(name);
#
# and textContent assigns a text node, which parses no markup. So escaping first is not a
# safeguard, it is a corruption: operator== arrives as operator&#x3D;&#x3D;, and every name
# holding one of < > " ' / ` = comes out spelled in entities. Twenty nine labels here, all of
# them operators. Doxygen 1.10.0 used innerHTML and had none of this.
#
# Dropping the call is the whole fix, and it loses no safety: textContent cannot interpret what
# it is given whatever is in it.
#
# A version that does this correctly will not match, and this leaves the file alone. Nothing here
# fails on a miss.

if(NOT EXISTS ${NAVTREE})
    return()
endif()

file(READ ${NAVTREE} _content)
string(REPLACE "textContent = escapeHtml(" "textContent = (" _fixed "${_content}")

if(NOT _fixed STREQUAL _content)
    file(WRITE ${NAVTREE} "${_fixed}")
    message(STATUS "Unescaped the treeview labels in navtree.js")
endif()
