import {formatPairingLink, formatRequestLink, wcMobileWallets} from '../signer/walletconnect/wc-wallets'

const uri = 'wc:' + 'a'.repeat(64) + '@2?relay-protocol=irn&symKey=' + 'b'.repeat(64) + '&expiryTimestamp=1'

describe('wallet deep links', () => {
    //same formats as Reown AppKit (CoreHelperUtil.formatNativeUrl) and sign-client (formatDeeplinkUrl) produce
    test('pass encoded pairing URI to the wallet', () => {
        expect(formatPairingLink('lobstr://', uri)).toBe('lobstr://wc?uri=' + encodeURIComponent(uri))
        expect(formatPairingLink('freighterwallet://wc-redirect', uri))
            .toBe('freighterwallet://wc-redirect/wc?uri=' + encodeURIComponent(uri))
        expect(formatPairingLink('lobstr://', uri)).not.toContain('&symKey')
    })

    test('point the wallet to the pending request', () => {
        expect(formatRequestLink('lobstr://', 42, 'topic')).toBe('lobstr://wc?requestId=42&sessionTopic=topic')
        expect(formatRequestLink('hotwallet://', 42, 'topic')).toBe('hotwallet://wc?requestId=42&sessionTopic=topic')
        expect(formatRequestLink('freighterwallet://wc-redirect', 42, 'topic'))
            .toBe('freighterwallet://wc-redirect/wc?requestId=42&sessionTopic=topic')
    })

    test('list only wallets with native app links', () => {
        const names = wcMobileWallets.map(w => w.name)
        expect(new Set(names).size).toBe(names.length)
        //links registered in WalletConnect wallet registry
        expect(wcMobileWallets).toEqual(expect.arrayContaining([
            expect.objectContaining({name: 'LOBSTR', link: 'lobstr://'}),
            expect.objectContaining({name: 'Freighter', link: 'freighterwallet://wc-redirect'})
        ]))
        for (const w of wcMobileWallets) {
            expect(w.link).toMatch(/^[a-z]+:\/\//)
        }
    })
})
