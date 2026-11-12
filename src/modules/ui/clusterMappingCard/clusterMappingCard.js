import { LightningElement, api } from 'lwc';

/** Right-hand card: the selected cluster's mapping config, or an empty message. */
export default class ClusterMappingCard extends LightningElement {
    /** Selected cluster record (name, isMapped, mapping, issues, ...), or null when nothing is selected. */
    @api cluster = null;
    /** The cluster's schema attributes ({ name, type, example }). */
    @api attributes = [];
    /** Every cluster nested under the selected one, at any depth ({ isMapped }). */
    @api nestedClusters = [];

    /** Whether the view has rules for other mapped clusters listed before / after this one (the YAML editor marks them with "..."). */
    @api hasRulesBefore = false;
    @api hasRulesAfter = false;

    get hasCluster() {
        return !!this.cluster;
    }

    /** A cluster with its child object switched on holds many values; the same default as the child object form's switch. */
    get isMultiValued() {
        const mapping = this.cluster?.mapping;
        return Boolean(mapping?.childObjectEnabled ?? mapping?.childObject);
    }

    get title() {
        const name = this.cluster?.name ?? '';
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    /** Every attribute's example value joined into one, e.g. "official, Dr., Maria, ..."; empty when none has one. */
    get exampleText() {
        const values = this.attributes.map((attribute) => attribute.example).filter(Boolean);
        return values.length ? `Example: ${values.join(', ')}` : '';
    }

    /** Re-sent so the tab can store it: the form's { mapping } edit. */
    handleMappingChange(event) {
        this.dispatchEvent(new CustomEvent('mappingchange', { detail: event.detail }));
    }

    /** The view filter is part of the mapping, so its edit is sent as a mapping edit. */
    handleViewFilterChange(event) {
        const mapping = { ...this.cluster.mapping, viewFilter: event.detail.filter };
        this.dispatchEvent(new CustomEvent('mappingchange', { detail: { mapping } }));
    }

    /** "phoneNumbers • 1/2 nested clusters mapped"; the count only appears when there are nested clusters. */
    get subtitle() {
        const { name } = this.cluster;
        const total = this.nestedClusters.length;
        if (total === 0) {
            return name;
        }
        const mapped = this.nestedClusters.filter((nested) => nested.isMapped).length;
        return `${name} \u2022 ${mapped}/${total} nested clusters mapped`;
    }
}
