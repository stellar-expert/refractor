const {getAllSourceAccounts} = require('../business-logic/tx-helpers')

test('returns tx source when no operations have custom source', () => {
    const tx = {source: 'GABC', operations: [{}, {}]}
    expect(getAllSourceAccounts(tx)).toEqual(['GABC'])
})

test('returns unique source accounts from operations', () => {
    const tx = {source: 'GA', operations: [{source: 'GB'}, {source: 'GC'}]}
    const result = getAllSourceAccounts(tx)
    expect(result).toContain('GA')
    expect(result).toContain('GB')
    expect(result).toContain('GC')
    expect(result).toHaveLength(3)
})

test('deduplicates sources', () => {
    const tx = {source: 'GA', operations: [{source: 'GA'}, {source: 'GB'}]}
    const result = getAllSourceAccounts(tx)
    expect(result).toEqual(['GA', 'GB'])
})

test('handles fee bump transactions', () => {
    const tx = {feeSource: 'GFEE', innerTransaction: {source: 'GA', operations: []}}
    expect(getAllSourceAccounts(tx)).toEqual(['GFEE'])
})
