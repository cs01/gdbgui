import Util from '../Util.js';

/* eslint-env jest */

test('parses spaces', ()=>{
    const fn = Util.string_to_array_safe_quotes
    expect(fn('hi')).toEqual(['hi'])
    expect(fn('"hi bye"')).toEqual(['hi bye'])
    expect(fn('hi bye')).toEqual(['hi', 'bye'])
    expect(fn('hi bye "1 2, 3" asdf\n\t' )).toEqual(['hi', 'bye', '1 2, 3', 'asdf\n\t'])
})
