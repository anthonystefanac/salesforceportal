import { createElement } from 'lwc';
import FacilityPicker from 'c/facilityPicker';
import getFacilitiesForCurrentUser from '@salesforce/apex/FacilityController.getFacilitiesForCurrentUser';

const mockFacilities = require('./data/getFacilitiesForCurrentUser.json');

jest.mock(
    '@salesforce/apex/FacilityController.getFacilitiesForCurrentUser',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

describe('c-facility-picker', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders a facility option per returned record', () => {
        const element = createElement('c-facility-picker', { is: FacilityPicker });
        document.body.appendChild(element);

        getFacilitiesForCurrentUser.emit(mockFacilities);

        return Promise.resolve().then(() => {
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            expect(combobox.options).toHaveLength(mockFacilities.length);
            expect(combobox.options[0].label).toBe(mockFacilities[0].Name);
            expect(combobox.options[0].value).toBe(mockFacilities[0].Id);
        });
    });

    it('dispatches facilitychange with the selected facility id', () => {
        const element = createElement('c-facility-picker', { is: FacilityPicker });
        document.body.appendChild(element);

        const handler = jest.fn();
        element.addEventListener('facilitychange', handler);

        getFacilitiesForCurrentUser.emit(mockFacilities);

        return Promise.resolve().then(() => {
            const combobox = element.shadowRoot.querySelector('lightning-combobox');
            combobox.dispatchEvent(
                new CustomEvent('change', { detail: { value: mockFacilities[0].Id } })
            );

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail.facilityId).toBe(mockFacilities[0].Id);
        });
    });

    it('shows an error message when the wire adapter errors', () => {
        const element = createElement('c-facility-picker', { is: FacilityPicker });
        document.body.appendChild(element);

        getFacilitiesForCurrentUser.error();

        return Promise.resolve().then(() => {
            const errorEl = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorEl).not.toBeNull();
        });
    });
});
