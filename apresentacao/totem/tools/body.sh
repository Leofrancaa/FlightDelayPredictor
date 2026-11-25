#!/bin/bash
# usage: body.sh name:scene:at:actor[:ang] ...
cd /home/claude/totem
for spec in "$@"; do IFS=: read n s a who ang <<< "$spec"; node tools/shot.mjs "http://localhost:8765/?scene=$s&at=$a&body=$who&ang=${ang:-0}" /tmp/$n.png 300000 960 540 2>&1 | grep -i "err" | sed "s/^/[$n] /"; done
