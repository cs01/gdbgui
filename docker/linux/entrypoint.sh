#!/bin/bash

# Fail on errors.
set -e

cd /src

if [ -f requirements.txt ]; then
    pip install -r requirements.txt
fi # [ -f requirements.txt ]

echo "$@"
echo `pwd`
ls -lsa

python3 make_executable.py

#
# if [[ "$@" == "" ]]; then
#     pyinstaller --clean -y --dist ./dist/windows --workpath /tmp *.spec
#     chown -R --reference=. ./dist/windows
# else
#     sh -c "$@"
# fi # [[ "$@" == "" ]]
