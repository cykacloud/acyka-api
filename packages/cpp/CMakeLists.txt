cmake_minimum_required(VERSION 3.20)

project(acyka VERSION 1.0.0 LANGUAGES CXX
        DESCRIPTION "A client for the acyka API")

# Header-only. A client library that has to be built and linked is one whose
# users argue with their build system before they write a line — so this is an
# INTERFACE target and the whole integration is one `FetchContent` block and one
# `#include`.
add_library(acyka INTERFACE)
add_library(acyka::acyka ALIAS acyka)

target_include_directories(acyka INTERFACE
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>)

target_compile_features(acyka INTERFACE cxx_std_20)

include(FetchContent)

# nlohmann/json, found if the project already has it and fetched if not. A
# library that always fetched would give whoever depends on it two copies.
find_package(nlohmann_json 3.11 QUIET)
if(NOT nlohmann_json_FOUND)
    FetchContent_Declare(nlohmann_json
        URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
        URL_HASH SHA256=d6c65aca6b1ed68e7a182f4757257b107ae403032760ed6ef121c9d55e81757d)
    FetchContent_MakeAvailable(nlohmann_json)
endif()
target_link_libraries(acyka INTERFACE nlohmann_json::nlohmann_json)

# libcurl is what the shipped transport uses, and it is optional: define
# ACYKA_NO_CURL and pass your own `http_transport` if a project has already
# chosen an HTTP client. Two TLS stacks in one binary is not a favour.
option(ACYKA_WITH_CURL "Build the libcurl transport" ON)
if(ACYKA_WITH_CURL)
    find_package(CURL REQUIRED)
    target_link_libraries(acyka INTERFACE CURL::libcurl)
else()
    target_compile_definitions(acyka INTERFACE ACYKA_NO_CURL)
endif()

option(ACYKA_BUILD_TESTS "Build the tests" ${PROJECT_IS_TOP_LEVEL})
if(ACYKA_BUILD_TESTS)
    enable_testing()

    # No test framework, and deliberately: a header-only library should not make
    # its contributors install one to run three files.
    foreach(one hmac transport webhooks)
        add_executable(${one}_test tests/${one}_test.cpp)
        target_link_libraries(${one}_test PRIVATE acyka)
        target_compile_options(${one}_test PRIVATE
            $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall -Wextra -Wpedantic>
            $<$<CXX_COMPILER_ID:MSVC>:/W4>)
        add_test(NAME ${one} COMMAND ${one}_test)
    endforeach()
endif()

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
install(TARGETS acyka EXPORT acyka-targets)
install(EXPORT acyka-targets
        FILE acyka-targets.cmake
        NAMESPACE acyka::
        DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/acyka)

write_basic_package_version_file(
    "${CMAKE_CURRENT_BINARY_DIR}/acyka-config-version.cmake"
    COMPATIBILITY SameMajorVersion
    ARCH_INDEPENDENT)
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/acyka-config-version.cmake"
        DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/acyka)
