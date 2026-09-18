const {TextEncoder, TextDecoder} = require('node:util')

//jsdom lacks encoders required by @stellar/stellar-sdk
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
//jsdom runs in a separate realm with its own typed array constructors, so Node's Buffer (used by the SDK
//and the app in place of the webpack polyfill) fails `instanceof Uint8Array` checks - align the realms
global.Uint8Array = Object.getPrototypeOf(Buffer.prototype).constructor
global.ArrayBuffer = Buffer.alloc(0).buffer.constructor
//not implemented in jsdom - invoked by the click navigation handler
window.scrollTo = () => {
}
//toast notifications global exposed by createToastNotificationsContainer() in the real app
global.notify = jest.fn()
//network access is always mocked explicitly in tests
global.fetch = jest.fn(() => Promise.reject(new Error('fetch is not mocked')))
