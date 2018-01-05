# -*- mode: python -*-

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
          name='gdbgui',
          debug=False,
          strip=False,
          upx=False,
          runtime_tmpdir=None,
          console=True)
