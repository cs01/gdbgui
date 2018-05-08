#!/usr/bin/env bash

GDBGUI=../../gdbgui/backend.py

cargo build && $GDBGUI ./target/debug/hello
