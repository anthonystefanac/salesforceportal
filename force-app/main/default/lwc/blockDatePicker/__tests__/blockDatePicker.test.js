import { createElement } from 'lwc';
import BlockDatePicker from 'c/blockDatePicker';

// Fixed "today" (mid-month, so both a day earlier and a day later in the
// same month exist to click) - matches staffingRequestReporting's own
// fixed-system-time pattern, for the same reason: calendar/date-math tests
// shouldn't depend on which day of the month the suite happens to run on.
const FIXED_TODAY = new Date(2026, 6, 15, 12, 0, 0); // Wed 15 July 2026

function dayButton(element, iso) {
    return element.shadowRoot.querySelector(`[data-date="${iso}"]`);
}

function chipRemoveButtons(element) {
    return Array.from(element.shadowRoot.querySelectorAll('.block-date-picker__chip-remove'));
}

describe('c-block-date-picker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(FIXED_TODAY);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
    });

    it('shows the current month and an empty-state message with nothing selected', () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('.block-date-picker__month').textContent).toBe('July 2026');
        expect(element.shadowRoot.querySelector('.block-date-picker__empty')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.block-date-picker__selection')).toBeNull();
    });

    it('selects a day on click, adds it as a chip, and fires datechange', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        const changeHandler = jest.fn();
        element.addEventListener('datechange', changeHandler);
        document.body.appendChild(element);

        dayButton(element, '2026-07-20').click();
        await Promise.resolve();

        expect(changeHandler).toHaveBeenCalledTimes(1);
        expect(changeHandler.mock.calls[0][0].detail.dates).toEqual(['2026-07-20']);
        expect(dayButton(element, '2026-07-20').classList).toContain('block-date-picker__day_selected');
        expect(chipRemoveButtons(element)).toHaveLength(1);
        expect(chipRemoveButtons(element)[0].dataset.date).toBe('2026-07-20');
    });

    it('deselects an already-selected day on a second click', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        document.body.appendChild(element);

        dayButton(element, '2026-07-20').click();
        await Promise.resolve();
        dayButton(element, '2026-07-20').click();
        await Promise.resolve();

        expect(dayButton(element, '2026-07-20').classList).not.toContain('block-date-picker__day_selected');
        expect(chipRemoveButtons(element)).toHaveLength(0);
    });

    it('selects multiple, not-necessarily-consecutive days', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        const changeHandler = jest.fn();
        element.addEventListener('datechange', changeHandler);
        document.body.appendChild(element);

        dayButton(element, '2026-07-20').click();
        await Promise.resolve();
        dayButton(element, '2026-07-16').click();
        await Promise.resolve();
        dayButton(element, '2026-07-28').click();
        await Promise.resolve();

        // Sorted, even though clicked out of order.
        expect(changeHandler.mock.calls[2][0].detail.dates).toEqual(['2026-07-16', '2026-07-20', '2026-07-28']);
        expect(chipRemoveButtons(element)).toHaveLength(3);
        expect(element.shadowRoot.querySelector('.block-date-picker__selection-count').textContent).toBe(
            '3 dates selected'
        );
    });

    it('renders a day before today as disabled and does not select it on click', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        const changeHandler = jest.fn();
        element.addEventListener('datechange', changeHandler);
        document.body.appendChild(element);

        const yesterday = dayButton(element, '2026-07-14');
        expect(yesterday.disabled).toBe(true);

        yesterday.click();
        await Promise.resolve();

        expect(changeHandler).not.toHaveBeenCalled();
    });

    it("renders today's own cell as selectable, not disabled", () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        document.body.appendChild(element);

        const today = dayButton(element, '2026-07-15');
        expect(today.disabled).toBe(false);
        expect(today.classList).toContain('block-date-picker__day_today');
    });

    it('removes a date via its chip remove button', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        const changeHandler = jest.fn();
        element.addEventListener('datechange', changeHandler);
        document.body.appendChild(element);

        dayButton(element, '2026-07-20').click();
        await Promise.resolve();
        dayButton(element, '2026-07-22').click();
        await Promise.resolve();
        changeHandler.mockClear();

        chipRemoveButtons(element)
            .find((button) => button.dataset.date === '2026-07-20')
            .click();
        await Promise.resolve();

        expect(changeHandler).toHaveBeenCalledTimes(1);
        expect(changeHandler.mock.calls[0][0].detail.dates).toEqual(['2026-07-22']);
        expect(dayButton(element, '2026-07-20').classList).not.toContain('block-date-picker__day_selected');
    });

    it('clears every selected date via "Clear all"', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        document.body.appendChild(element);

        dayButton(element, '2026-07-20').click();
        await Promise.resolve();
        dayButton(element, '2026-07-22').click();
        await Promise.resolve();

        element.shadowRoot.querySelector('.block-date-picker__clear-all').click();
        await Promise.resolve();

        expect(chipRemoveButtons(element)).toHaveLength(0);
        expect(element.shadowRoot.querySelector('.block-date-picker__empty')).not.toBeNull();
    });

    it('navigates between months and jumps back to the current month with Today', async () => {
        const element = createElement('c-block-date-picker', { is: BlockDatePicker });
        document.body.appendChild(element);

        element.shadowRoot.querySelector('[data-action="next"]').click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.block-date-picker__month').textContent).toBe('August 2026');

        element.shadowRoot.querySelector('[data-action="prev"]').click();
        await Promise.resolve();
        element.shadowRoot.querySelector('[data-action="prev"]').click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.block-date-picker__month').textContent).toBe('June 2026');

        element.shadowRoot.querySelector('.block-date-picker__today').click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.block-date-picker__month').textContent).toBe('July 2026');
    });

    describe('@api defaultDate', () => {
        it('pre-selects the given date and jumps the visible month to it', async () => {
            const element = createElement('c-block-date-picker', { is: BlockDatePicker });
            element.defaultDate = '2026-09-03';
            document.body.appendChild(element);
            await Promise.resolve();

            expect(element.shadowRoot.querySelector('.block-date-picker__month').textContent).toBe(
                'September 2026'
            );
            expect(dayButton(element, '2026-09-03').classList).toContain('block-date-picker__day_selected');
        });

        it('adds to (rather than replaces) the selection on a second assignment', async () => {
            const element = createElement('c-block-date-picker', { is: BlockDatePicker });
            document.body.appendChild(element);

            element.defaultDate = '2026-07-20';
            await Promise.resolve();
            element.defaultDate = '2026-07-25';
            await Promise.resolve();

            expect(chipRemoveButtons(element).map((button) => button.dataset.date)).toEqual([
                '2026-07-20',
                '2026-07-25'
            ]);
        });

        it('reflects back the last value assigned', () => {
            const element = createElement('c-block-date-picker', { is: BlockDatePicker });
            document.body.appendChild(element);

            element.defaultDate = '2026-07-20';
            expect(element.defaultDate).toBe('2026-07-20');
        });
    });

    describe('@api clearSelection / removeDates', () => {
        it('clearSelection empties the whole selection and fires datechange', async () => {
            const element = createElement('c-block-date-picker', { is: BlockDatePicker });
            const changeHandler = jest.fn();
            element.addEventListener('datechange', changeHandler);
            document.body.appendChild(element);

            dayButton(element, '2026-07-20').click();
            await Promise.resolve();
            dayButton(element, '2026-07-22').click();
            await Promise.resolve();
            changeHandler.mockClear();

            element.clearSelection();
            await Promise.resolve();

            expect(changeHandler).toHaveBeenCalledTimes(1);
            expect(changeHandler.mock.calls[0][0].detail.dates).toEqual([]);
            expect(chipRemoveButtons(element)).toHaveLength(0);
        });

        it('removeDates drops only the given dates, leaving the rest selected', async () => {
            const element = createElement('c-block-date-picker', { is: BlockDatePicker });
            const changeHandler = jest.fn();
            element.addEventListener('datechange', changeHandler);
            document.body.appendChild(element);

            dayButton(element, '2026-07-16').click();
            await Promise.resolve();
            dayButton(element, '2026-07-20').click();
            await Promise.resolve();
            dayButton(element, '2026-07-28').click();
            await Promise.resolve();
            changeHandler.mockClear();

            element.removeDates(['2026-07-16', '2026-07-28']);
            await Promise.resolve();

            expect(changeHandler).toHaveBeenCalledTimes(1);
            expect(changeHandler.mock.calls[0][0].detail.dates).toEqual(['2026-07-20']);
            expect(chipRemoveButtons(element).map((button) => button.dataset.date)).toEqual(['2026-07-20']);
        });
    });
});
