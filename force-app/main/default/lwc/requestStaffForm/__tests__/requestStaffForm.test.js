import { createElement } from 'lwc';
import RequestStaffForm from 'c/requestStaffForm';
import { CurrentPageReference } from 'lightning/navigation';
import createRequest from '@salesforce/apex/StaffingRequestController.createRequest';

jest.mock(
    '@salesforce/apex/StaffingRequestController.createRequest',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

function setInputValue(element, selector, value) {
    const input = element.shadowRoot.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
    return input;
}

describe('c-request-staff-form', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('submits the form data mapped to Staffing_Request__c fields', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        const facilityPicker = element.shadowRoot.querySelector('c-facility-picker');
        facilityPicker.dispatchEvent(
            new CustomEvent('facilitychange', { detail: { facilityId: 'a01000000000001AAA' } })
        );

        const wardPicker = element.shadowRoot.querySelector('c-ward-picker');
        wardPicker.dispatchEvent(new CustomEvent('wardchange', { detail: { wardId: 'a05000000000001AAA' } }));

        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2026-08-01');
        setInputValue(element, '[data-field="startTime"]', '07:00:00.000');
        setInputValue(element, '[data-field="endTime"]', '15:00:00.000');
        setInputValue(element, '[data-field="quantity"]', '3');

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(createRequest).toHaveBeenCalledTimes(1);
        const callArg = createRequest.mock.calls[0][0].newRequest;
        expect(callArg.Facility__c).toBe('a01000000000001AAA');
        expect(callArg.Ward__c).toBe('a05000000000001AAA');
        expect(callArg.Role__c).toBe('Registered Nurse');
        expect(callArg.Shift_Date__c).toBe('2026-08-01');
        expect(callArg.Quantity__c).toBe(3);
    });

    it('defaults Quantity to 1, selectable from 1 through 10', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        const quantityField = element.shadowRoot.querySelector('[data-field="quantity"]');
        expect(quantityField.value).toBe('1');
        expect(quantityField.options).toHaveLength(10);
        expect(quantityField.options[0]).toEqual({ label: '1', value: '1' });
        expect(quantityField.options[9]).toEqual({ label: '10', value: '10' });

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(createRequest.mock.calls[0][0].newRequest.Quantity__c).toBe(1);
    });

    it('resets the selected ward when the facility changes', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        const facilityPicker = element.shadowRoot.querySelector('c-facility-picker');
        facilityPicker.dispatchEvent(
            new CustomEvent('facilitychange', { detail: { facilityId: 'a01000000000001AAA' } })
        );

        const wardPicker = element.shadowRoot.querySelector('c-ward-picker');
        wardPicker.dispatchEvent(new CustomEvent('wardchange', { detail: { wardId: 'a05000000000001AAA' } }));

        // Selecting a different facility should clear the previously chosen ward
        facilityPicker.dispatchEvent(
            new CustomEvent('facilitychange', { detail: { facilityId: 'a01000000000002AAA' } })
        );

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        const callArg = createRequest.mock.calls[0][0].newRequest;
        expect(callArg.Facility__c).toBe('a01000000000002AAA');
        expect(callArg.Ward__c).toBeUndefined();
    });

    it('defaults End Time to Start Time while End Time is still unset', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="startTime"]', '08:30:00.000');
        await Promise.resolve();

        const endTimeInput = element.shadowRoot.querySelector('[data-field="endTime"]');
        expect(endTimeInput.value).toBe('08:30:00.000');
    });

    it('does not override an End Time the user already chose', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="endTime"]', '16:00:00.000');
        await Promise.resolve();
        setInputValue(element, '[data-field="startTime"]', '08:30:00.000');
        await Promise.resolve();

        const endTimeInput = element.shadowRoot.querySelector('[data-field="endTime"]');
        expect(endTimeInput.value).toBe('16:00:00.000');
    });

    it('pre-fills Shift Date from the defaultDate carried in page navigation state', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { defaultDate: '2026-09-03' } });
        await Promise.resolve();

        const shiftDateInput = element.shadowRoot.querySelector('[data-field="shiftDate"]');
        expect(shiftDateInput.value).toBe('2026-09-03');
    });

    it('blocks submission when Start Time is picked and End Time is left at its auto-filled value', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        // Only Start Time is touched - End Time is never explicitly set by
        // the user, it's left at whatever the auto-fill applied.
        setInputValue(element, '[data-field="startTime"]', '08:30:00.000');
        await Promise.resolve();

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('End time cannot be the same as start time.');
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('blocks submission with an error toast when End Time equals Start Time', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        setInputValue(element, '[data-field="startTime"]', '08:30:00.000');
        await Promise.resolve();
        setInputValue(element, '[data-field="endTime"]', '08:30:00.000');
        await Promise.resolve();

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('End time cannot be the same as start time.');
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('pre-fills and re-applies Shift Date from the defaultDate api property', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        element.defaultDate = '2026-08-14';
        document.body.appendChild(element);

        const shiftDateInput = element.shadowRoot.querySelector('[data-field="shiftDate"]');
        expect(shiftDateInput.value).toBe('2026-08-14');

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(createRequest.mock.calls[0][0].newRequest.Shift_Date__c).toBe('2026-08-14');
        // A caller like requestStaffCalendar may want to submit a second
        // request for the same day - the date should still be there after reset.
        expect(shiftDateInput.value).toBe('2026-08-14');

        // Changing the caller's selected day updates the field live, even
        // though this form instance was never re-created.
        element.defaultDate = '2026-08-21';
        await Promise.resolve();
        expect(shiftDateInput.value).toBe('2026-08-21');
    });

    it('dispatches a success toast and a requestcreated event on success', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        const createdHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        element.addEventListener('requestcreated', createdHandler);
        document.body.appendChild(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
        expect(createdHandler).toHaveBeenCalledTimes(1);
        expect(createdHandler.mock.calls[0][0].detail.requestId).toBe('a02000000000001AAA');
    });

    it('shows an error toast when submission fails', async () => {
        createRequest.mockRejectedValue({ body: { message: 'Validation failed' } });

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('Validation failed');
    });
});
