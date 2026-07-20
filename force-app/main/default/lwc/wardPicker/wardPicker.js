import { LightningElement, api, wire } from 'lwc';
import getWardsForFacility from '@salesforce/apex/FacilityController.getWardsForFacility';

export default class WardPicker extends LightningElement {
    @api facilityId;

    wards = [];
    error;

    @wire(getWardsForFacility, { facilityId: '$facilityId' })
    wiredWards({ data, error }) {
        if (data) {
            this.wards = data.map((ward) => ({
                label: ward.Name,
                value: ward.Id
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.wards = [];
        }
    }

    get hasFacility() {
        return !!this.facilityId;
    }

    get hasWards() {
        return this.wards.length > 0;
    }

    get isDisabled() {
        return !this.hasFacility || !this.hasWards;
    }

    get placeholder() {
        if (!this.hasFacility) {
            return 'Select a facility first';
        }
        return this.hasWards ? 'Select a ward' : 'No wards on file for this facility';
    }

    handleChange(event) {
        this.dispatchEvent(
            new CustomEvent('wardchange', {
                detail: { wardId: event.detail.value }
            })
        );
    }
}
