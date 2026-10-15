include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

if(QMSETUP_STATIC_RUNTIME)
    # To avoid a command execution that can't find the library, we choose to link compiler runtime statically
    if(MINGW)
        add_link_options(-static -static-libgcc -static-libstdc++)
    elseif(MSVC)
        add_compile_options(/MT)
    endif()
endif()

# Get stdcorelib
find_package(stdcorelib QUIET)

if(NOT TARGET stdcorelib::stdcorelib)
    set(STDC_BUILD_STATIC TRUE)
    set(STDC_INSTALL FALSE)
    add_subdirectory(stdcorelib)
endif()

# Add subdirectories
add_subdirectory(corecmd)

# Add headers
set(_corelib_name library)
add_library(${_corelib_name} INTERFACE)
target_include_directories(${_corelib_name} INTERFACE
    "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/../include>"
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>"
    "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}/${QMSETUP_INSTALL_NAME}>"
)

install(TARGETS ${_corelib_name}
    EXPORT ${QMSETUP_INSTALL_NAME}Targets
)

qm_basic_install(
    NAME ${QMSETUP_INSTALL_NAME}
    VERSION ${QMSETUP_VERSION}
    CONFIG_TEMPLATE ${CMAKE_CURRENT_LIST_DIR}/${QMSETUP_INSTALL_NAME}Config.cmake.in
    NAMESPACE qmsetup::
    EXPORT ${QMSETUP_INSTALL_NAME}Targets
    WRITE_CONFIG_OPTIONS NO_CHECK_REQUIRED_COMPONENTS_MACRO
)

set(_install_dir ${CMAKE_INSTALL_LIBDIR}/cmake/${QMSETUP_INSTALL_NAME})

# Install headers
install(DIRECTORY ../include/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)

# Install cmake modules
#
# Beside the package files, which is where the configuration file looks for
# QMSetupAPI.cmake.
install(DIRECTORY ../cmake/
    DESTINATION ${_install_dir}/cmake
)