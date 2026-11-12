/**
 * What a cluster's view filter is before anyone configures it (a cluster's mapping carries it as `viewFilter`).
 * (Cardinality is not part of it: the cluster's child object switch decides it.) `filter` keeps only the values whose
 * attribute equals `value`; with either one empty nothing is filtered out. `sort.by` is 'recent' (most recently
 * asserted), 'priority' (source priority order) or 'both'; `sort.first` says which wins when it is 'both'.
 * `sort.sources` are the prioritized sources, in order; other sources come after them (sorted by most
 * recently asserted) only while `includeUnprioritized` is on.
 */
export const defaultViewFilter = () => ({
    activeOnly: false,
    filter: { attribute: '', value: '' },
    sort: { by: 'both', first: 'priority', sources: [], includeUnprioritized: true }
});
