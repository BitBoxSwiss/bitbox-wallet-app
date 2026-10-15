# The CMake reference, rendered from the comments in cmake/.
#
# Everything Sphinx needs is asked for here rather than at the top of the tree,
# so that a project that never turns the documentation on pays for none of it
# and the root has nothing about Python in it.
#
# Nothing here is part of `all`. The reference is built by asking for it, since
# it wants two Python packages installed and a build that stopped for the want
# of them would be a worse trade than a build without documentation in it.

set(_doc_dir share/doc/${QMSETUP_INSTALL_NAME})

# Beside the binaries rather than under the build directory, so that what a
# build leaves behind is laid out the way an install is.
get_filename_component(_build_doc_dir
    "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/../${_doc_dir}" ABSOLUTE
)

find_package(Python3 COMPONENTS Interpreter REQUIRED)

# Asked of the interpreter rather than looked for on disk, since sphinx-build is
# a script whose presence says nothing about which Python it will run under, and
# the extension has to be importable by that same one.
execute_process(
    COMMAND ${Python3_EXECUTABLE} -c
        "import sphinx, sphinxcontrib.moderncmakedomain"
    RESULT_VARIABLE _sphinx_result
    OUTPUT_QUIET
    ERROR_QUIET
)

if(NOT _sphinx_result EQUAL 0)
    message(FATAL_ERROR
        "qmsetup documentation: ${Python3_EXECUTABLE} cannot import sphinx and "
        "sphinxcontrib.moderncmakedomain.\n"
        "  ${Python3_EXECUTABLE} -m pip install sphinx sphinxcontrib-moderncmakedomain\n"
        "Or configure with -DQMSETUP_BUILD_DOCUMENTATIONS=OFF."
    )
endif()

# -W, so that a reference that does not resolve fails the build rather than
# scrolling past. --keep-going, so that one failure does not hide the rest.
#
# -d keeps the cache out of the output, which is otherwise left holding a
# .doctrees directory larger than the pages and of no use to anyone reading
# them. Under the build directory, so that the install reuses what the build
# worked out.
set(_sphinx_command
    ${Python3_EXECUTABLE} -m sphinx -b html -W --keep-going
    -d "${CMAKE_CURRENT_BINARY_DIR}/doctrees"
    "${CMAKE_CURRENT_SOURCE_DIR}"
)

# What the pages are made of, so that touching a comment rebuilds them. Sphinx
# works out the rest for itself, the stubs naming the .cmake files it reads.
file(GLOB_RECURSE _doc_sources CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.rst"
    "${CMAKE_CURRENT_SOURCE_DIR}/conf.py"
    "${QMSETUP_SOURCE_DIR}/cmake/*.cmake"
)

# Emptied first, both of them. Sphinx writes the pages it has and removes none
# that it has not, so a module that was renamed leaves the page it used to have
# behind, in the search index and in the navigation, until something takes it
# away. Taking the cache with it is what makes the run after write everything
# again rather than find the sources unchanged and write nothing.
#
# Affordable because this only runs when one of the files below has changed, and
# rendering the whole reference is a couple of seconds.
add_custom_command(
    OUTPUT "${_build_doc_dir}/index.html"
    COMMAND ${CMAKE_COMMAND} -E rm -rf "${_build_doc_dir}" "${CMAKE_CURRENT_BINARY_DIR}/doctrees"
    COMMAND ${_sphinx_command} "${_build_doc_dir}"
    DEPENDS ${_doc_sources}
    COMMENT "Rendering the CMake reference"
    VERBATIM
)

add_custom_target(${QMSETUP_INSTALL_NAME}_docs
    DEPENDS "${_build_doc_dir}/index.html"
)

# Rendered again on the way in rather than copied from the build tree, which a
# build that never asked for the target has nothing in.
#
# Bracket arguments, so that what goes between them is text and nothing in it is
# read as a variable while this file is being read.
install(CODE "
    set(_command [==[${_sphinx_command}]==])
    message(STATUS \"Rendering the CMake reference\")
    # Emptied for the same reason as the build does, an install into a prefix
    # that already holds an older reference otherwise keeping its stale pages.
    file(REMOVE_RECURSE \"\${CMAKE_INSTALL_PREFIX}/${_doc_dir}\")
    execute_process(
        COMMAND \${_command} \"\${CMAKE_INSTALL_PREFIX}/${_doc_dir}\"
        COMMAND_ERROR_IS_FATAL ANY
    )
")
