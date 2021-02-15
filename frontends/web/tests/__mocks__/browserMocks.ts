// Mock Browser API's which are not supported by JSDOM

// The app uses matchMedia query to look up whether reduced animations feature
// is enabled. The query isn't available in tests.
// See Jest docs for more details:
// https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: false,
    value: jest.fn().mockImplementation(query => ({
        media: query,
        matches: false,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});
