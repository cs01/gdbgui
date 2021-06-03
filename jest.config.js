module.exports = {
    "preset": 'ts-jest',
    "verbose": true,
    "testMatch": [__dirname  + '/gdbgui/src/js/tests/**',__dirname  + '/gdbgui/src/js/tests_browser/**'],
    "transform": {
      '^.+\.(j|t)sx?$': 'ts-jest'
    }
}

