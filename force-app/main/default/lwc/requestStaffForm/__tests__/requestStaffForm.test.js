import { createElement } from 'lwc';
import RequestStaffForm from 'c/requestStaffForm';
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

        setInputValue(element, '[data-field="role"]', 'Registered Nurse');
        setInputValue(element, '[data-field="shiftDate"]', '2026-08-01');
        setInputValue(element, '[data-field="startTime"]', '07:00:00.000');
        setInputValue(element, '[data-field="endTime"]', '15:00:00.000');
        setInputValue(element, '[data-field="quantity"]', 2);

        const submitButton = element.shadowRoot.querySelector('lightning-button');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(createRequest).toHaveBeenCalledTimes(1);
        const callArg = createRequest.mock.calls[0][0].newRequest;
        expect(callArg.Facility__c).toBe('a01000000000001AAA');
        expect(callArg.Role__c).toBe('Registered Nurse');
        expect(callArg.Shift_Date__c).toBe('2026-08-01');
        expect(callArg.Quantity__c).toBe(2);
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
