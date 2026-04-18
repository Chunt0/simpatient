#!/usr/bin/env bash
set -e

echo ""
echo "SimPatient — AI Patient Simulation Platform"
echo "============================================"
echo ""
echo "Select compute mode:"
echo "  1) CPU (default)"
echo "  2) GPU — RTX A6000 (Kokoro runs on CPU due to cuFFT incompatibility)"
echo "  3) GPU — generic (all services on GPU)"
echo ""
read -rp "Choice [1]: " choice

case "${choice}" in
  2)
    echo "Starting with GPU support (A6000 mode)..."
    docker compose -f docker-compose.yml -f docker-compose.gpu.yml up "$@"
    ;;
  3)
    echo "Starting with GPU support (generic mode)..."
    docker compose -f docker-compose.yml -f docker-compose.gpu-generic.yml up "$@"
    ;;
  *)
    echo "Starting with CPU support..."
    docker compose -f docker-compose.yml up "$@"
    ;;
esac
