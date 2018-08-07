import Util from '../Util.js';

/* eslint-env jest */

test('parses spaces', ()=>{
    const fn = Util.string_to_array_safe_quotes
    expect(fn('hi')).toEqual(['hi'])
    expect(fn('"hi bye"')).toEqual(['"hi bye"'])
    expect(fn('hi bye')).toEqual(['hi', 'bye'])
    expect(fn('hi bye "1 2, 3" asdf\n\t' )).toEqual(['hi', 'bye', '"1 2, 3"', 'asdf\n\t'])
    expect(fn('"hi bye" "1 2, 3" asdf\n\t' )).toEqual(['"hi bye"', '"1 2, 3"', 'asdf\n\t'])
})

test('dot version comparison', ()=>{
  expect(Util.is_newer('1.0.0', '1.0.0')).toEqual(false)
  expect(Util.is_newer('1.0.0', '0.9.9')).toEqual(true)
  expect(Util.is_newer('0.1.0', '0.0.9')).toEqual(true)
  expect(Util.is_newer('0.0.8', '0.0.9')).toEqual(false)
  expect(Util.is_newer('0.11.3.1', '0.11.3.0')).toEqual(true)
  expect(Util.is_newer('0.11.4.0', '0.11.3.0')).toEqual(true)
  expect(Util.is_newer('0.11.4.0\n', '0.11.3.0')).toEqual(true)
  expect(Util.is_newer('0.11.3.0', '0.11.3.0\n')).toEqual(false)
  expect(Util.is_newer('0.11.3.0', '0.11.4.0\n')).toEqual(false)
  expect(Util.is_newer('0.12.0.0', '0.11.4.0\n')).toEqual(true)
  expect(Util.is_newer('1.0.0', '0.11.4.0\n')).toEqual(true)
  expect(Util.is_newer('1.0.1', '1.0.0')).toEqual(true)
})
