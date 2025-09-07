cmake_minimum_required(VERSION 3.17)
project(umbf-viewer
    VERSION 0.0.1
    LANGUAGES CXX C
)

add_subdirectory(modules/umbf)

set(ALWF_ROOT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/modules/alwf)
set(ALWF_PUBLIC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/public)
set(ALWF_VIEWS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/views)
set(ALWF_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)
set(ALWF_MANIFEST_DEPS libumbf:${UMBF_VERSION})
set(ALWF_FRONTEND_DISABLE ON CACHE BOOL "Disable ALWF frontend installation")

include(${ALWF_ROOT_DIR}/alwf.cmake)
target_link_libraries(${PROJECT_NAME} PRIVATE umbf)