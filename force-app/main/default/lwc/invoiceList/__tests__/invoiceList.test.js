import { createElement } from 'lwc';
import InvoiceList from 'c/invoiceList';
import { CurrentPageReference } from 'lightning/navigation';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';

const mockInvoices = require('./data/getInvoices.json');

jest.mock(
    '@salesforce/apex/InvoiceController.getInvoices',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

// The default lightning/navigation stub's Navigate method is a frozen no-op,
// so it can't be jest.spyOn'd directly - swap in an instrumented mixin instead.
// CurrentPageReference is reconstructed the same way the real stub builds it,
// since we're replacing the whole module.
const mockNavigate = jest.fn();
jest.mock('lightning/navigation', () => {
    const { createTestWireAdapter } = require('@salesforce/wire-service-jest-util');
    const Navigate = Symbol('Navigate');
    const NavigationMixin = (Base) =>
        class extends Base {
            [Navigate](pageReference) {
                mockNavigate(pageReference);
            }
        };
    NavigationMixin.Navigate = Navigate;
    return {
        NavigationMixin,
        CurrentPageReference: createTestWireAdapter(jest.fn())
    };
});

describe('c-invoice-list', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders one row per invoice, unfiltered by default', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(3);
            expect(element.shadowRoot.querySelector('.invoice-list__filter-banner')).toBeNull();
        });
    });

    it('shows only overdue invoices when the page reference filter is "overdue"', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'overdue' } });
        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            expect(rows[0].textContent).toContain('2CL-10005');

            const banner = element.shadowRoot.querySelector('.invoice-list__filter-banner');
            expect(banner.textContent).toContain('Overdue Invoices');
        });
    });

    it('clears the filter and shows all invoices when "Show all invoices" is clicked', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'overdue' } });
        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const clearButton = element.shadowRoot.querySelector('.invoice-list__clear-filter');
            clearButton.click();

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(3);
                expect(element.shadowRoot.querySelector('.invoice-list__filter-banner')).toBeNull();
            });
        });
    });

    it('navigates to the invoice record when View / Download is clicked', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const button = element.shadowRoot.querySelector('lightning-button');
            button.click();

            expect(mockNavigate).toHaveBeenCalledTimes(1);
            expect(mockNavigate.mock.calls[0][0]).toEqual({
                type: 'standard__recordPage',
                attributes: {
                    recordId: mockInvoices[0].Id,
                    objectApiName: 'Invoice__c',
                    actionName: 'view'
                }
            });
        });
    });

    it('shows an empty state message when there are no invoices', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit([]);

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.invoice-list__empty');
            expect(empty).not.toBeNull();
        });
    });
});
