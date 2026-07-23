// Apex Time fields come back over the wire as milliseconds since midnight
// (a number, not a time string), so components format it themselves rather
// than relying on lightning-formatted-time's expected input shape.
export function formatTime(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    if (typeof value === 'string' && value.includes(':')) {
        const [hours, minutes] = value.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }
    const totalMillis = Number(value);
    if (Number.isNaN(totalMillis)) {
        return '';
    }
    const totalMinutes = Math.floor(totalMillis / 60000);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
