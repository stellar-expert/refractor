const {matchPredicate} = require('../storage/simple-predicate-matcher')

const value = {a: 10, b: 'check', c: false}

test.each([
    [{a: 10}, true],
    [{a: 10, b: 'check'}, true],
    [{a: 8, b: 'check'}, false],
    [{a: {$lt: 20}}, true],
    [{a: {$lt: 10}}, false],
    [{a: {$lt: 20, $gte: 10}}, true],
    [{a: {$lt: 10, $gt: 5}}, false],
    [{a: {$ne: 5}}, true],
    [{a: {$ne: 10}}, false],
    [{b: {$in: ['a', 'check']}}, true],
    [{b: {$in: ['a', 'b']}}, false]
])('simple predicate match - %o %p', (predicate, matches) => {
    expect(matchPredicate(value, predicate)).toEqual(matches)
})