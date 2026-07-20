import { LightningElement, wire } from 'lwc';
import getFacilitiesForCurrentUser from '@salesforce/apex/FacilityController.getFacilitiesForCurrentUser';

export default class FacilityPicker extends LightningElement {
    facilities = [];
    error;

    @wire(getFacilitiesForCurrentUser)
    wiredFacilities({ data, error }) {
        if (data) {
            this.facilities = data.map((facility) => ({
                label: facility.Name,
                value: facility.Id
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.facilities = [];
        }
    }

    handleChange(event) {
        this.dispatchEvent(
            new CustomEvent('facilitychange', {
                detail: { facilityId: event.detail.value }
            })
        );
    }
}
