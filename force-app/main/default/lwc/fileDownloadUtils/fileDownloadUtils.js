// iOS Safari (and any other WebKit-based browser on iOS - Chrome/Firefox on
// iOS are all just Safari underneath) never honours the <a download>
// attribute at all, on a data: URI or otherwise - it's a long-standing,
// deliberate WebKit platform limitation, not a bug that gets fixed by a
// newer iOS version. Clicking such a link just navigates to/opens the data:
// URI in the current or a new tab instead of saving anything, which is why
// both the Invoice PDF download and Reporting's CSV download silently did
// nothing useful on an iPhone/iPad. Android's browsers (Chrome, Samsung
// Internet, etc.) do support it, including with data: URIs, so they're left
// on the existing, already-working desktop path below - only iOS gets the
// different treatment.
const IOS_USER_AGENT_PATTERN = /iPad|iPhone|iPod/i;

export function isIosDevice() {
    return IOS_USER_AGENT_PATTERN.test(navigator.userAgent);
}

// Desktop and Android: unchanged from what was already working here - an
// off-DOM anchor with the download attribute, clicked programmatically. This
// path is untouched by the iOS fix below.
function downloadViaAnchor(dataUri, filename) {
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// iOS: the download attribute is ignored regardless of what's done above, so
// instead this opens the data: URI directly in a new tab. There's no way to
// force a real "Save As" from pure client-side markup on iOS Safari, but
// opening it lets iOS's own viewer take over - a PDF opens in Safari's
// built-in PDF viewer, which has its own native Share/Save-to-Files button,
// and other content (e.g. CSV, which iOS has no built-in viewer for) at
// least becomes visible/copyable/shareable instead of the tap doing nothing.
function openInNewTab(dataUri) {
    window.open(dataUri, '_blank');
}

/**
 * Triggers a browser download for a data: URI, working around iOS Safari's
 * lack of <a download> support (see isIosDevice above). Desktop and Android
 * behaviour is unchanged from the original, already-verified-working anchor
 * click technique.
 */
export function triggerDataUriDownload(dataUri, filename) {
    if (isIosDevice()) {
        openInNewTab(dataUri);
        return;
    }
    downloadViaAnchor(dataUri, filename);
}
