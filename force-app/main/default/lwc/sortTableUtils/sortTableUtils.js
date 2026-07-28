// Shared client-side table sort behavior for myStaffingRequests and
// staffingRequestReporting - both render the same shape of request row data
// and need identical sort/toggle/column-header-decoration logic.

export function sortRecords(records, field, direction) {
    if (!field) {
        return records;
    }
    const multiplier = direction === 'desc' ? -1 : 1;
    return [...records].sort((a, b) => {
        const valueA = a[field];
        const valueB = b[field];
        if (valueA == null && valueB == null) {
            return 0;
        }
        if (valueA == null) {
            return -1 * multiplier;
        }
        if (valueB == null) {
            return 1 * multiplier;
        }
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return (valueA - valueB) * multiplier;
        }
        return String(valueA).localeCompare(String(valueB)) * multiplier;
    });
}

// Clicking the already-sorted column toggles direction; clicking a
// different column starts a fresh ascending sort on it.
export function toggleSort(currentField, currentDirection, clickedField) {
    if (currentField === clickedField) {
        return { field: clickedField, direction: currentDirection === 'desc' ? 'asc' : 'desc' };
    }
    return { field: clickedField, direction: 'asc' };
}

// Decorates a plain { key, label } column list with the CSS class, aria-sort
// value, and indicator glyph a sortable <th> needs, given the current sort
// state. classPrefix is the component's own BEM-ish block name (e.g.
// "my-requests__th"), since the two callers use different class names.
export function buildSortableColumns(columns, sortField, sortDirection, classPrefix) {
    return columns.map((column) => {
        const isSorted = sortField === column.key;
        const direction = isSorted ? sortDirection : undefined;
        return {
            ...column,
            cssClass: isSorted ? `${classPrefix} ${classPrefix}_sorted` : classPrefix,
            ariaSort: isSorted ? (direction === 'desc' ? 'descending' : 'ascending') : 'none',
            indicator: isSorted ? (direction === 'desc' ? '▼' : '▲') : ''
        };
    });
}
