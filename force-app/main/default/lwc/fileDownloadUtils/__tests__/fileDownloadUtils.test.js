import { isIosDevice, triggerDataUriDownload } from 'c/fileDownloadUtils';

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function setUserAgent(value) {
    Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

describe('fileDownloadUtils', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
        setUserAgent(originalUserAgent);
        jest.restoreAllMocks();
    });

    describe('isIosDevice', () => {
        it('returns true for an iPhone user agent', () => {
            setUserAgent(IPHONE_UA);
            expect(isIosDevice()).toBe(true);
        });

        it('returns true for an iPad user agent', () => {
            setUserAgent(IPAD_UA);
            expect(isIosDevice()).toBe(true);
        });

        it('returns false for an Android user agent', () => {
            setUserAgent(ANDROID_UA);
            expect(isIosDevice()).toBe(false);
        });

        it('returns false for a desktop user agent', () => {
            setUserAgent(DESKTOP_CHROME_UA);
            expect(isIosDevice()).toBe(false);
        });
    });

    describe('triggerDataUriDownload', () => {
        it('on iOS, opens the data URI in a new tab rather than clicking an anchor', () => {
            setUserAgent(IPHONE_UA);
            const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
            const createElementSpy = jest.spyOn(document, 'createElement');

            triggerDataUriDownload('data:application/pdf;base64,AAAA', 'invoice.pdf');

            expect(openSpy).toHaveBeenCalledWith('data:application/pdf;base64,AAAA', '_blank');
            expect(createElementSpy).not.toHaveBeenCalledWith('a');
        });

        it('on desktop/Android, clicks an off-DOM anchor with the download attribute (existing behaviour)', () => {
            setUserAgent(DESKTOP_CHROME_UA);
            const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});

            let createdLink;
            const originalCreateElement = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    jest.spyOn(el, 'click').mockImplementation(() => {});
                    createdLink = el;
                }
                return el;
            });

            triggerDataUriDownload('data:text/csv;charset=utf-8,a%2Cb', 'export.csv');

            expect(openSpy).not.toHaveBeenCalled();
            expect(createdLink.href).toBe('data:text/csv;charset=utf-8,a%2Cb');
            expect(createdLink.download).toBe('export.csv');
            expect(createdLink.click).toHaveBeenCalled();
        });
    });
});
