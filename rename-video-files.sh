#!/bin/bash

# AI generated script to remove everything after a [ | or ( at the end of the file name.

shopt -s nullglob
for f in *; do
  [ -f "$f" ] || continue

  # handle dotfiles with no extension
  if [[ "$f" = .* && "$f" != *.* ]]; then
    base="$f"; ext=""
  else
    base="${f%.*}"
    if [[ "$base" = "$f" ]]; then
      ext=""
    else
      ext=".${f##*.}"
    fi
  fi

  # remove from first occurrence of separators (including fullwidth variants) and trim
  newbase=$(printf '%s' "$base" | \
    perl -CSD -Mutf8 -ne 'chomp; s/[\|\x{FF5C}\[\x{FF3B}\(\x{FF08}\+\x{FF0B}].*$//u; s/^\s+//u; s/\s+$//u; print $_')

  new="$newbase$ext"

  if [[ "$new" != "$f" ]]; then
    mv -- "$f" "$new"
  fi
done
