import { LightningElement, api } from 'lwc';

const DIRECTION_OPTIONS = [
    { label: 'Inbound', value: 'inbound', help: 'From Verato MDM Cloud to Salesforce.' },
    { label: 'Outbound', value: 'outbound', help: 'From Salesforce to Verato MDM Cloud.' },
    { label: 'Both', value: 'both', help: 'Between Salesforce and Verato MDM Cloud.' }
];

/**
 * Cluster mapping form: direction, child object and the attributes grid. Controlled: shows `mapping` and reports every edit as
 * a `mappingchange` event ({ mapping }); the owner stores and validates it.
 */
export default class ClusterMappingForm extends LightningElement {
    /** Working mapping config (see the clusters seed data for its shape). */
    @api mapping;
    /** Validation problems of the working mapping ({ target, message }), shown inline by the elements they name. */
    @api issues = [];

    _attributes = [];

    @api
    get attributes() {
        return this._attributes;
    }
    set attributes(value) {
        this._attributes = Array.isArray(value) ? value : [];
    }

    directionOptions = DIRECTION_OPTIONS.map(({ label, value }) => ({ label, value }));

    get directionHelp() {
        return DIRECTION_OPTIONS.find((option) => option.value === this.mapping.direction).help;
    }

    emit(mapping) {
        this.dispatchEvent(new CustomEvent('mappingchange', { detail: { mapping } }));
    }

    handleDirection(event) {
        this.emit({ ...this.mapping, direction: event.detail.value });
    }

    /** The child object part reports the whole mapping, so its edit is passed on as is. */
    handleChildObject(event) {
        this.emit(event.detail.mapping);
    }

    handleAttributes(event) {
        this.emit({ ...this.mapping, attributes: event.detail.attributes, groups: event.detail.groups, order: event.detail.order });
    }
}
