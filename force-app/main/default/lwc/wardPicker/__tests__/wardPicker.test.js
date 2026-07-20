import { createElement } from 'lwc';
import WardPicker from 'c/wardPicker';
import getWardsForFacility from '@salesforce/apex/FacilityController.getWardsForFacility';

const mockWards = require('./data/getWardsForFacility.json');

jest.mock(
    '@salesforce/apex/FacilityController.getWardsForFacility',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

describe('c-ward-picker', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('is disabled with a placeholder when no facility is selected', () => {
        const element = createElement('c-ward-picker', { is: WardPicker });
        document.body.appendChild(element);

        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.disabled).toBe(true);
        expect(combobox.placeholder).toBe('Select a facility first');
    });

    it('renders a ward option per returned record once a facility is set', () => {
        const element = createElement('c-ward-picker', { is: WardPicker });
        element.facilityId = 'a01000000000001AAA';
        document.body.appendChild(element);

        getWardsForFacility.emit(mockWards);

        return Promise.resolve().then(() => {
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            expect(combobox.options).toHaveLength(mockWards.length);
            expect(combobox.options[0].label).toBe(mockWards[0].Name);
            expect(combobox.disabled).toBe(false);
        });
    });

    it('stays disabled with a helpful placeholder when the facility has no wards', () => {
        const element = createElement('c-ward-picker', { is: WardPicker });
        element.facilityId = 'a01000000000001AAA';
        document.body.appendChild(element);

        getWardsForFacility.emit([]);

        return Promise.resolve().then(() => {
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            expect(combobox.disabled).toBe(true);
            expect(combobox.placeholder).toBe('No wards on file for this facility');
        });
    });

    it('dispatches wardchange with the selected ward id', () => {
        const element = createElement('c-ward-picker', { is: WardPicker });
        element.facilityId = 'a01000000000001AAA';
        document.body.appendChild(element);

        const handler = jest.fn();
        element.addEventListener('wardchange', handler);

        getWardsForFacility.emit(mockWards);

        return Promise.resolve().then(() => {
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            combobox.dispatchEvent(new CustomEvent('change', { detail: { value: mockWards[0].Id } }));

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail.wardId).toBe(mockWards[0].Id);
        });
    });
});
