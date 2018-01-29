#!/usr/bin/env python


"""
"""


import subprocess
from gdbgui import __version__


def write_spec_with_gdbgui_version_in_name(spec_path, binary_name):

    spec = """# -*- mode: python -*-

# create executable with: pyinstaller backend.spec
# run executable with: dist/gdbgui

block_cipher = None


a = Analysis(['gdbgui/backend.py'],  # noqa
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
          name="%s",
          debug=False,
          strip=False,
          upx=False,
          runtime_tmpdir=None,
          console=True)

""" % binary_name

    with open('gdbgui.spec', 'w') as f:
        f.write(spec)


def main():
    binary_name = 'gdbgui_%s' % __version__
    spec_path = 'gdbgui.spec'
    write_spec_with_gdbgui_version_in_name(spec_path, binary_name)

    subprocess.call(['pyinstaller', spec_path,
        '--distpath', 'executable',
        '--key', 'a5s1fe65aw41f54sa64v6b4ds98fhea98rhg4etj4et78ku4yu87mn'])


if __name__ == '__main__':
    main()
