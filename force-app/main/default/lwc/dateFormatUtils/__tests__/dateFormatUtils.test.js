import { formatDate, formatDateTime, todayIso } from 'c/dateFormatUtils';

describe('dateFormatUtils', () => {
    describe('formatDate', () => {
        it('formats a YYYY-MM-DD value as DD/MM/YYYY', () => {
            expect(formatDate('2026-07-30')).toBe('30/07/2026');
        });

        it('formats a single-digit day/month with leading zeros preserved', () => {
            expect(formatDate('2026-01-05')).toBe('05/01/2026');
        });

        it('handles a full ISO datetime value by using only its date portion', () => {
            expect(formatDate('2026-07-30T10:00:00.000Z')).toBe('30/07/2026');
        });

        it('returns an empty string for null/undefined/empty input', () => {
            expect(formatDate(null)).toBe('');
            expect(formatDate(undefined)).toBe('');
            expect(formatDate('')).toBe('');
        });
    });

    describe('formatDateTime', () => {
        it('formats an ISO datetime as DD/MM/YYYY, HH:MM in local time', () => {
            const isoValue = new Date(2026, 6, 30, 14, 5, 0).toISOString();
            expect(formatDateTime(isoValue)).toBe('30/07/2026, 14:05');
        });

        it('returns an empty string for null/undefined/empty input', () => {
            expect(formatDateTime(null)).toBe('');
            expect(formatDateTime(undefined)).toBe('');
            expect(formatDateTime('')).toBe('');
        });

        it('returns an empty string for an unparseable value', () => {
            expect(formatDateTime('not-a-date')).toBe('');
        });
    });

    describe('todayIso', () => {
        it('returns the current date as YYYY-MM-DD', () => {
            const now = new Date();
            const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
                now.getDate()
            ).padStart(2, '0')}`;
            expect(todayIso()).toBe(expected);
        });
    });
});
