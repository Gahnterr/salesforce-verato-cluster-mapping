import { LightningElement, api } from 'lwc';

// Placeholder Salesforce fields until the org's real schema is available.
const toOption = (value) => ({ label: value, value });
const LOOKUP_OPTIONS = ['Contact__c', 'Account__c', 'Lead__c'].map(toOption);
const MATCH_KEY_OPTIONS = ['External_Id__c', 'Citizenship_Id__c'].map(toOption);

const EMPTY_CHILD = { childObject: '', childRelationship: '', lookupToRoot: '', matchKey: '' };

/**
 * The child object part of a cluster's mapping config. Controlled like the cluster mapping form:
 * shows `mapping` and reports every edit as a `mappingchange` event ({ mapping }).
 */
export default class ClusterChildObjectForm extends LightningElement {
    /** Working mapping config (see the clusters seed data for its shape). */
    @api mapping;

    lookupOptions = LOOKUP_OPTIONS;
    matchKeyOptions = MATCH_KEY_OPTIONS;

    /** Mappings saved before the switch existed are on when they name a child object. */
    get isEnabled() {
        return this.mapping.childObjectEnabled ?? !!this.mapping.childObject;
    }

    /** Switching off clears the child object's fields, so a disabled child object leaves nothing behind. */
    handleToggle(event) {
        const mapping = event.target.checked
            ? { ...this.mapping, childObjectEnabled: true }
            : { ...this.mapping, childObjectEnabled: false, ...EMPTY_CHILD };
        this.dispatchEvent(new CustomEvent('mappingchange', { detail: { mapping } }));
    }

    handleField(event) {
        const mapping = { ...this.mapping, [event.target.dataset.field]: event.detail.value };
        this.dispatchEvent(new CustomEvent('mappingchange', { detail: { mapping } }));
    }
}
