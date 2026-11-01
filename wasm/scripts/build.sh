#!/usr/bin/env bash
set -euo pipefail

# Build script for WebPraat WASM core using Emscripten
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${WASM_DIR}/build"
OUTPUT_DIR="${WASM_DIR}/../public"

BUILD_TYPE="${1:-Release}"
if [ "${BUILD_TYPE}" = "debug" ]; then
    BUILD_TYPE="Debug"
elif [ "${BUILD_TYPE}" = "release" ]; then
    BUILD_TYPE="Release"
fi

echo "=== Building WebPraat WASM (${BUILD_TYPE}) ==="
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

export EM_CACHE="${EM_CACHE:-/tmp/emscripten_cache}"
export EMCC_BATCH_BUILD=0

if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten SDK (emcc) is not found in PATH."
    exit 1
fi

echo "Emscripten compiler: $(emcc --version | head -n 1)"
echo "Configuring build with emcmake cmake..."

emcmake cmake "${WASM_DIR}" \
  -DCMAKE_BUILD_TYPE="${BUILD_TYPE}"

echo "Compiling with CMake..."
cmake --build . -- -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"

mkdir -p "${OUTPUT_DIR}"
cp "${BUILD_DIR}/praatlib.wasm" "${OUTPUT_DIR}/"
cp "${BUILD_DIR}/praatlib.js" "${OUTPUT_DIR}/"

echo "=== WebPraat WASM build finished successfully ==="
echo "Artifacts placed in ${OUTPUT_DIR}:"
ls -lh "${OUTPUT_DIR}/praatlib.wasm" "${OUTPUT_DIR}/praatlib.js"
