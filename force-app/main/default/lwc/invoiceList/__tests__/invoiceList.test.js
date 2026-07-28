import { createElement } from 'lwc';
import InvoiceList from 'c/invoiceList';
import { CurrentPageReference } from 'lightning/navigation';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';
import getInvoiceFileIds from '@salesforce/apex/InvoiceController.getInvoiceFileIds';
import getInvoiceFileData from '@salesforce/apex/InvoiceController.getInvoiceFileData';

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

jest.mock(
    '@salesforce/apex/InvoiceController.getInvoiceFileIds',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/InvoiceController.getInvoiceFileData',
    () => ({ default: jest.fn() }),
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
    let createdLinks;

    beforeEach(() => {
        createdLinks = [];
        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                jest.spyOn(el, 'click').mockImplementation(() => {});
                createdLinks.push(el);
            }
            return el;
        });
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        if (document.createElement.mockRestore) {
            document.createElement.mockRestore();
        }
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

    it('shows Invoice Date and Due Date in DD/MM/YYYY format regardless of Locale', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            const cells = rows[0].querySelectorAll('td');
            // Invoice Number, Invoice Date, Due Date, ...
            expect(cells[1].textContent).toBe('01/07/2026');
            expect(cells[2].textContent).toBe('15/07/2026');
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

    it('shows "View" and navigates to the invoice record when there is no attached file', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);
        getInvoiceFileIds.emit({});

        return Promise.resolve().then(() => {
            const button = element.shadowRoot.querySelector('lightning-button');
            expect(button.label).toBe('View');
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
            expect(createdLinks).toHaveLength(0);
        });
    });

    it('shows "Download PDF" and downloads the file directly when an invoice has an attached file', async () => {
        getInvoiceFileData.mockResolvedValue({ fileName: 'INV-0001.pdf', base64Data: 'ZmFrZS1wZGYtYnl0ZXM=' });

        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);
        getInvoiceFileIds.emit({ [mockInvoices[0].Id]: '069000000000001AAA' });
        await Promise.resolve();

        const button = element.shadowRoot.querySelector('lightning-button');
        expect(button.label).toBe('Download PDF');
        button.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(getInvoiceFileData).toHaveBeenCalledWith({ invoiceId: mockInvoices[0].Id });
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(createdLinks).toHaveLength(1);
        expect(createdLinks[0].href).toBe('data:application/octet-stream;base64,ZmFrZS1wZGYtYnl0ZXM=');
        expect(createdLinks[0].download).toBe('INV-0001.pdf');
    });

    it('shows an inline error banner if fetching the file fails', async () => {
        getInvoiceFileData.mockRejectedValue({ body: { message: 'No file is attached to this invoice.' } });

        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);
        getInvoiceFileIds.emit({ [mockInvoices[0].Id]: '069000000000001AAA' });
        await Promise.resolve();

        const button = element.shadowRoot.querySelector('lightning-button');
        button.click();
        await Promise.resolve();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.invoice-list__banner_error');
        expect(banner.textContent).toBe('No file is attached to this invoice.');
        expect(createdLinks).toHaveLength(0);
    });

    it('logs an error and leaves every row on "View" if getInvoiceFileIds itself errors', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);
        getInvoiceFileIds.error(new Error('insufficient access'));

        return Promise.resolve().then(() => {
            const button = element.shadowRoot.querySelector('lightning-button');
            expect(button.label).toBe('View');
            expect(console.error).toHaveBeenCalled();
            console.error.mockRestore();
        });
    });

    it('filters rows by search term across invoice number and status', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const searchInput = element.shadowRoot.querySelector('lightning-input');
            searchInput.value = '10019';
            searchInput.dispatchEvent(new CustomEvent('change'));

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(1);
                expect(rows[0].textContent).toContain('2CL-10019');
            });
        });
    });

    it('shows a search-aware empty state message when the search term matches nothing', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const searchInput = element.shadowRoot.querySelector('lightning-input');
            searchInput.value = 'no-such-invoice';
            searchInput.dispatchEvent(new CustomEvent('change'));

            return Promise.resolve().then(() => {
                const empty = element.shadowRoot.querySelector('.invoice-list__empty');
                expect(empty.textContent).toContain('no-such-invoice');
            });
        });
    });

    it('sorts by a clicked column, toggling direction on a second click', () => {
        const element = createElement('c-invoice-list', { is: InvoiceList });
        document.body.appendChild(element);

        getInvoices.emit(mockInvoices);

        return Promise.resolve().then(() => {
            const amountHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                th.textContent.includes('Amount')
            );
            amountHeader.click();

            return Promise.resolve().then(() => {
                let rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows[0].textContent).toContain('2CL-10005'); // 3210.00, lowest
                expect(rows[2].textContent).toContain('2CL-10019'); // 6180.00, highest

                amountHeader.click();

                return Promise.resolve().then(() => {
                    rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows[0].textContent).toContain('2CL-10019');
                    expect(rows[2].textContent).toContain('2CL-10005');
                });
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
