import { sortRecords, toggleSort, buildSortableColumns } from 'c/sortTableUtils';

describe('sortTableUtils', () => {
    describe('sortRecords', () => {
        it('returns the same records unchanged when no field is given', () => {
            const records = [{ name: 'B' }, { name: 'A' }];
            expect(sortRecords(records, undefined, 'asc')).toBe(records);
        });

        it('sorts strings ascending by default', () => {
            const records = [{ name: 'B' }, { name: 'A' }, { name: 'C' }];
            const sorted = sortRecords(records, 'name', 'asc');
            expect(sorted.map((r) => r.name)).toEqual(['A', 'B', 'C']);
        });

        it('sorts descending when asked', () => {
            const records = [{ name: 'B' }, { name: 'A' }, { name: 'C' }];
            const sorted = sortRecords(records, 'name', 'desc');
            expect(sorted.map((r) => r.name)).toEqual(['C', 'B', 'A']);
        });

        it('sorts numbers numerically, not lexicographically', () => {
            const records = [{ quantity: 10 }, { quantity: 2 }, { quantity: 1 }];
            const sorted = sortRecords(records, 'quantity', 'asc');
            expect(sorted.map((r) => r.quantity)).toEqual([1, 2, 10]);
        });

        it('sorts null/undefined values to the front when ascending', () => {
            const records = [{ name: 'B' }, { name: null }, { name: 'A' }];
            const sorted = sortRecords(records, 'name', 'asc');
            expect(sorted.map((r) => r.name)).toEqual([null, 'A', 'B']);
        });

        it('does not mutate the original array', () => {
            const records = [{ name: 'B' }, { name: 'A' }];
            sortRecords(records, 'name', 'asc');
            expect(records.map((r) => r.name)).toEqual(['B', 'A']);
        });
    });

    describe('toggleSort', () => {
        it('starts a new ascending sort when a different column is clicked', () => {
            expect(toggleSort('name', 'desc', 'shiftDate')).toEqual({ field: 'shiftDate', direction: 'asc' });
        });

        it('toggles from ascending to descending on the same column', () => {
            expect(toggleSort('name', 'asc', 'name')).toEqual({ field: 'name', direction: 'desc' });
        });

        it('toggles from descending back to ascending on the same column', () => {
            expect(toggleSort('name', 'desc', 'name')).toEqual({ field: 'name', direction: 'asc' });
        });
    });

    describe('buildSortableColumns', () => {
        const columns = [
            { key: 'name', label: 'Request' },
            { key: 'shiftDate', label: 'Shift Date' }
        ];

        it('marks no column as sorted when sortField is unset', () => {
            const result = buildSortableColumns(columns, undefined, 'asc', 'my-requests__th');
            expect(result[0].cssClass).toBe('my-requests__th');
            expect(result[0].ariaSort).toBe('none');
            expect(result[0].indicator).toBe('');
        });

        it('marks the matching column as sorted ascending', () => {
            const result = buildSortableColumns(columns, 'name', 'asc', 'my-requests__th');
            expect(result[0].cssClass).toBe('my-requests__th my-requests__th_sorted');
            expect(result[0].ariaSort).toBe('ascending');
            expect(result[0].indicator).toBe('▲');
            expect(result[1].cssClass).toBe('my-requests__th');
        });

        it('marks the matching column as sorted descending', () => {
            const result = buildSortableColumns(columns, 'shiftDate', 'desc', 'reporting__th');
            expect(result[1].cssClass).toBe('reporting__th reporting__th_sorted');
            expect(result[1].ariaSort).toBe('descending');
            expect(result[1].indicator).toBe('▼');
        });
    });
});
