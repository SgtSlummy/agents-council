#!/usr/bin/env python3
"""Extract a verified Council release archive without links or path traversal."""

from __future__ import annotations

import argparse
import pathlib
import tarfile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=pathlib.Path)
    parser.add_argument("--destination", required=True, type=pathlib.Path)
    args = parser.parse_args()

    destination = args.destination.resolve()
    destination.mkdir(parents=True, exist_ok=False)
    with tarfile.open(args.archive, mode="r:gz") as archive:
        members = archive.getmembers()
        if not members:
            raise ValueError(f"Archive is empty: {args.archive}")
        for member in members:
            if not (member.isdir() or member.isfile()):
                raise ValueError(f"Archive links and special entries are forbidden: {member.name}")
            relative = pathlib.PurePosixPath(member.name)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Archive path traversal is forbidden: {member.name}")
            target = (destination / pathlib.Path(*relative.parts)).resolve()
            if destination not in target.parents and target != destination:
                raise ValueError(f"Archive entry escapes destination: {member.name}")
        archive.extractall(destination, members=members, filter="data")


if __name__ == "__main__":
    main()
