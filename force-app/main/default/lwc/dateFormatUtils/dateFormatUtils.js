// Explicit DD/MM/YYYY formatting, independent of the running user's Locale
// setting. Relying on Locale isn't reliable here: it's a per-user setting,
// so a portal user, an internal staff member, and a scheduled job can each
// have a different one, and several date cells in this app (Shift Date,
// Invoice Date, Due Date, Last Update) were previously either raw ISO
// strings or routed through lightning-formatted-date-time, whose day/month
// order is itself locale-driven, not fixed by its format attributes.

// Plain Date fields come back over the wire as 'YYYY-MM-DD' - parsed with a
// regex rather than `new Date(value)`, which would reinterpret the string in
// the browser's local timezone and can shift the calendar day by one.
export function formatDate(value) {
    if (!value) {
        return '';
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
        return '';
    }
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
}

// Datetime fields come back as a full ISO string with a time/zone component -
// `new Date(value)` here is intentional, converting to the viewer's local
// time the same way lightning-formatted-date-time already did.
export function formatDateTime(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
}
