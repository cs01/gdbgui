module.exports = {
    "preset": 'ts-jest',
    "verbose": true,
    "testMatch": [__dirname  + '/gdbgui/src/js/tests/**'],
    "transform": {
      '^.+\.(j|t)sx?$': 'ts-jest'
    }
}
