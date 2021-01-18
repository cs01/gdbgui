#!/usr/bin/env python

"""
Build an executable of gdbgui for the current platform
"""


import subprocess
from sys import platform
from gdbgui import __version__
import hashlib
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
if platform.startswith("linux"):
    platform_dir = "linux"
elif platform.startswith("darwin"):
    platform_dir = "mac"
elif platform == "win32":
    platform_dir = "windows"
else:
    raise Exception("Unknown platform")


def write_spec_with_gdbgui_version_in_name(spec_path, binary_name):

    spec = f"""# -*- mode: python -*-

# create executable with: pyinstaller gdbgui.spec
# run executable with: dist/gdbgui

block_cipher = None


a = Analysis(['gdbgui/cli.py'],  # noqa
             pathex=['.'],
             binaries=[],
             datas=[
              ('./gdbgui/static*', './static'),
              ('./gdbgui/templates*', './templates'),
              ('./gdbgui/VERSION.txt*', './')
            ],
             hiddenimports=[
               'engineio.async_gevent',
               'engineio.async_threading',
               'engineio.async_drivers.gevent',
               'engineio.async_drivers.threading',
               'engineio.async_drivers.eventlet',
               'engineio.async_drivers.gevent_uwsgi',
               'pkg_resources.py2_warn',
               ],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             )

pyz = PYZ(a.pure, a.zipped_data,  # noqa
             cipher=block_cipher)

exe = EXE(pyz,  # noqa
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          name="{binary_name}",
          debug=False,
          strip=False,
          upx=False,
          runtime_tmpdir=None,
          console=True)

"""

    with open(spec_path, "w+") as f:
        f.write(spec)



def verify(binary_path: str, version: str):
    cmd = [str(binary_path), "--version"]
    logging.info(f"Smoke test: Running {' '.join(cmd)}")
    proc = subprocess.run(cmd, stdout=subprocess.PIPE)
    output = proc.stdout.decode().strip()
    if output != __version__:
        raise ValueError(f"Expected {__version__}. Got {output}")
    logging.info("Success!")


def generate_md5(binary: Path, output_file: Path):
    checksum = hashlib.md5(binary.read_bytes()).hexdigest()
    with open(output_file, "w+") as f:
        f.write(checksum + "\n")
    logging.info(f"Wrote md5 to {output_file}")


def main():
    binary_name = "gdbgui_%s" % __version__
    spec_path = "gdbgui.spec"
    distpath = (Path("executable") / platform_dir).resolve()
    extension = ".exe" if platform == "win32" else ""
    binary_path = Path(distpath) / f"{binary_name}{extension}"

    write_spec_with_gdbgui_version_in_name(spec_path, binary_name)
    subprocess.run(
        [
            "pyinstaller",
            spec_path,
            "--distpath",
            distpath,
            "--key",
            "a5s1fe65aw41f54sa64v6b4ds98fhea98rhg4etj4et78ku4yu87mn",
        ]
    )
    verify(binary_path, __version__)
    generate_md5(binary_path, distpath / f"{binary_name}.md5")
    logging.info(f"Saved executable to {binary_path}")
    text_file = open("gdbgui_executable", "w")
    n = text_file.write("{binary_path}".format(**locals())
)
    text_file.close()


if __name__ == "__main__":
    main()
