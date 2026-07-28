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

function selectFacility(element, facilityId) {
    const facilityPicker = element.shadowRoot.querySelector('c-facility-picker');
    facilityPicker.dispatchEvent(new CustomEvent('facilitychange', { detail: { facilityId } }));
}

// Fills every required field with a valid value (a far-future Shift Date so
// it's never accidentally in the past relative to whenever the suite runs).
// Quantity and Priority are left alone - they already default to '1' and
// 'Medium'.
function fillRequiredFields(element, overrides = {}) {
    selectFacility(element, overrides.facilityId || 'a01000000000001AAA');
    setInputValue(element, '[data-field="role"]', overrides.role || 'Registered Nurse');
    setInputValue(element, '[data-field="shiftDate"]', overrides.shiftDate || '2030-01-01');
    setInputValue(element, '[data-field="startTime"]', overrides.startTime || '07:00:00.000');
    setInputValue(element, '[data-field="endTime"]', overrides.endTime || '15:00:00.000');
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

    it('shows a visible saving state while the request is being submitted', async () => {
        let resolveCreate;
        createRequest.mockReturnValue(
            new Promise((resolve) => {
                resolveCreate = resolve;
            })
        );

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        fillRequiredFields(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();
        await Promise.resolve();

        expect(submitButton.label).toBe('Submitting…');
        expect(submitButton.disabled).toBe(true);
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();

        resolveCreate('a02000000000001AAA');
        await Promise.resolve();
        await Promise.resolve();

        expect(submitButton.label).toBe('Submit Request');
        expect(submitButton.disabled).toBe(false);
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
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

        fillRequiredFields(element);

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

        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2030-01-01');
        setInputValue(element, '[data-field="startTime"]', '07:00:00.000');
        setInputValue(element, '[data-field="endTime"]', '15:00:00.000');

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

    it('sets the Shift Date picker\'s min attribute to today, so past dates aren\'t selectable', () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        const shiftDateInput = element.shadowRoot.querySelector('[data-field="shiftDate"]');
        const today = new Date();
        const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
            today.getDate()
        ).padStart(2, '0')}`;
        expect(shiftDateInput.min).toBe(expected);
    });

    it('blocks submission with a past Shift Date', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        selectFacility(element, 'a01000000000001AAA');
        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2020-01-01');
        setInputValue(element, '[data-field="startTime"]', '07:00:00.000');
        setInputValue(element, '[data-field="endTime"]', '15:00:00.000');
        await Promise.resolve();

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('Shift date cannot be in the past.');
        expect(createRequest).not.toHaveBeenCalled();

        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_error');
        expect(banner.textContent).toBe('Shift date cannot be in the past.');
    });

    it('blocks submission when Start Time is picked and End Time is left at its auto-filled value', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        selectFacility(element, 'a01000000000001AAA');
        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2030-01-01');

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

        selectFacility(element, 'a01000000000001AAA');
        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2030-01-01');
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

        // The toast above isn't guaranteed to render on every site type this
        // component could be used on (Experience Cloud LWR sites in
        // particular don't render platform toasts at all) - this inline
        // banner is the guaranteed feedback.
        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_error');
        expect(banner.textContent).toBe('End time cannot be the same as start time.');
    });

    it('pre-fills and re-applies Shift Date from the defaultDate api property', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        element.defaultDate = '2026-08-14';
        document.body.appendChild(element);

        const shiftDateInput = element.shadowRoot.querySelector('[data-field="shiftDate"]');
        expect(shiftDateInput.value).toBe('2026-08-14');

        selectFacility(element, 'a01000000000001AAA');
        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="startTime"]', '07:00:00.000');
        setInputValue(element, '[data-field="endTime"]', '15:00:00.000');

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

    it('dispatches a success toast on successful submission', async () => {
        createRequest.mockResolvedValue('a02000000000001AAA');

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        fillRequiredFields(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');

        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_success');
        expect(banner.textContent).toBe('Your staffing request has been submitted.');
    });

    it('shows an error toast when submission fails', async () => {
        createRequest.mockRejectedValue({ body: { message: 'Validation failed' } });

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        fillRequiredFields(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('Validation failed');

        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_error');
        expect(banner.textContent).toBe('Validation failed');
    });

    it('shows an inline error and does not submit when required fields are missing', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();

        expect(createRequest).not.toHaveBeenCalled();
        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');

        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_error');
        expect(banner.textContent).toBe(
            'Please fill in: Facility, Role, Shift Date, Start Time, End Time.'
        );
    });

    it('lists only the fields still missing once some required fields are filled in', async () => {
        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        selectFacility(element, 'a01000000000001AAA');
        setInputValue(element, '[data-field="role"]', 'Registered Nurse');

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();

        expect(createRequest).not.toHaveBeenCalled();
        const banner = element.shadowRoot.querySelector('.request-staff-form__banner_error');
        expect(banner.textContent).toBe('Please fill in: Shift Date, Start Time, End Time.');
    });

    it('clears a previous banner when a new submit attempt starts', async () => {
        createRequest.mockRejectedValueOnce({ body: { message: 'Validation failed' } });

        const element = createElement('c-request-staff-form', { is: RequestStaffForm });
        document.body.appendChild(element);

        fillRequiredFields(element);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.request-staff-form__banner_error')).not.toBeNull();

        createRequest.mockResolvedValueOnce('a02000000000001AAA');
        submitButton.click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.request-staff-form__banner_error')).toBeNull();
        expect(element.shadowRoot.querySelector('.request-staff-form__banner_success')).toBeNull();
    });
});
