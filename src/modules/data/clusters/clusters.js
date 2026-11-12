import { getAll, upsert } from 'data/db';
import { logViewFilterChanges, recordPrioritizedSources } from 'data/viewFilters';

/** Flat list of every cluster; nesting is expressed through parentId, ownership through domainId. */
export async function getAllClusters() {
    return getAll('clusters');
}

const TYPE_LABELS = {
    TEXT: 'Text',
    NUMBER: 'Number',
    BOOLEAN: 'Boolean',
    CODE_SET: 'Code Set',
    DATE: 'Date',
    TIME: 'Time',
    'DATE-TIME': 'Date Time'
};

/**
 * Attributes of one cluster, read from the domain's reference schema. Nested
 * clusters are not attributes, so they are left out. Each attribute has its
 * schema `type`, a display `typeLabel` and, for code sets, the `codeSetValues`
 * (display names) it accepts. `example` is the attribute's example value (FHIR-style, or the
 * code for a code set), or '' when it has none.
 */
export async function getClusterAttributes(domainId, path) {
    const domain = getAll('veratoDomains').find((d) => d.id === domainId);
    const node = path.split('.').reduce((current, key) => current?.[key], domain?.schema);
    if (!node) {
        return [];
    }
    const codeSets = getAll('codeSets');
    const examples = new Map(getAll('attributeExamples').map((row) => [row.id, row.example]));
    return Object.entries(node)
        .filter(([, type]) => typeof type === 'string')
        .map(([name, type]) => {
            const codeSet = codeSets.find((candidate) => candidate.usedBy.includes(`${domainId}:${path}.${name}`));
            return {
                name,
                type,
                typeLabel: TYPE_LABELS[type] ?? type,
                example: examples.get(`${domainId}:${path}.${name}`) ?? '',
                codeSetValues: type === 'CODE_SET' ? (codeSet?.values.map((value) => value.display) ?? []) : null
            };
        });
}

// Placeholder for the signed-in user until the prototype has real auth.
const CURRENT_USER = 'Austin Guevara';

/** An attribute row is complete once the value it maps to (Salesforce field or static value) is filled in. */
const isAttributeMapped = ({ mapTo, field, staticValue } = {}) => (mapTo === 'static' ? !!staticValue : !!field);

/** Attributes grouped together share one value: { id, name, members: attribute names in concatenation order, mapTo, field, staticValue }. */
const groupsOf = (mapping) => mapping.groups ?? [];

const countMappedAttributes = (isMapped, mapping) =>
    isMapped
        ? Object.values(mapping.attributes).filter(isAttributeMapped).length +
          groupsOf(mapping)
              .filter(isAttributeMapped)
              .reduce((count, group) => count + group.members.length, 0)
        : 0;

/** Who last saved cluster mapping changes and when ({ editedAt, editedBy }), or null if never. */
export async function getLastClusterEdit() {
    return getAll('clusterMappingEdits')[0] ?? null;
}

/**
 * Validation of a cluster's mapping. Returns the list of problems (empty when
 * valid), each as { target, message }. The target says which element needs fixing:
 * 'attributes' (the grid has no rows), 'attribute:<name>' (that row is incomplete), 'group:<id>' (that group is), or
 * 'method:<id>|<name>' / 'regex:<id>|<name>' (that group member has no mapping method / custom regex).
 * Nothing to validate while the cluster is not mapped.
 */
export function validateMapping(isMapped, mapping) {
    if (!isMapped) {
        return [];
    }
    // The child object fields (object, relationship, lookup, match key) are in the form but aren't validated yet.
    const attributes = Object.entries(mapping.attributes);
    const groups = groupsOf(mapping);
    if (attributes.length === 0 && groups.length === 0) {
        return [{ target: 'attributes', message: 'Add at least one attribute.' }];
    }
    const incomplete = ([, row]) => !isAttributeMapped(row);
    const message = ({ mapTo }) => (mapTo === 'static' ? 'Enter a static value.' : 'Select a Salesforce field.');
    return [
        ...attributes.filter(incomplete).map(([name, row]) => ({ target: `attribute:${name}`, message: message(row) })),
        ...groups.filter((group) => incomplete([null, group])).map((group) => ({ target: `group:${group.id}`, message: message(group) })),
        // Inbound values only go from Verato to Salesforce, so there is nothing to split back and no method to choose.
        ...(mapping.direction === 'inbound' ? [] : groups.flatMap(memberMethodIssues))
    ];
}

/**
 * A group mapped to a Salesforce field splits that field's value back into its attributes, so each attribute needs
 * a mapping method, and a custom regex method needs its regular expression.
 */
function memberMethodIssues(group) {
    if (group.mapTo !== 'field' || !group.field) {
        return [];
    }
    return group.members.flatMap((name) => {
        const target = `${group.id}|${name}`;
        const method = group.methods?.[name];
        if (!method) {
            return [{ target: `method:${target}`, message: 'Select a mapping method.' }];
        }
        return method === 'regex' && !group.regexes?.[name]?.trim()
            ? [{ target: `regex:${target}`, message: 'Enter a regular expression.' }]
            : [];
    });
}

/** A cluster counts as mapped once any part of its config is filled in. */
function hasAnyMapping(mapping) {
    const { attributes, groups = [], order, direction, shape, childObjectEnabled, viewFilter, ...config } = mapping;
    return Object.values(config).some(Boolean) || Object.keys(attributes).length > 0 || groups.length > 0;
}

/**
 * Store the cluster's working (unsaved) mapping and recompute the mapped flag,
 * the unsaved-changes flag and the mapped-attribute count. Editing clears the
 * cluster's issues; they come back the next time the changes are validated.
 */
export async function updateClusterMapping(clusterId, mapping) {
    const cluster = getAll('clusters').find((c) => c.id === clusterId);
    if (!cluster) {
        return;
    }
    const isMapped = hasAnyMapping(mapping);
    upsert('clusters', {
        ...cluster,
        isMapped,
        mapping,
        hasUnsavedChanges: JSON.stringify({ isMapped, mapping }) !== JSON.stringify(cluster.savedState),
        issues: [],
        mappedCount: countMappedAttributes(isMapped, mapping)
    });
}

/**
 * Validate every cluster with unsaved changes, then save them. All-or-nothing:
 * while any cluster has issues nothing is saved, and the issues are stored on
 * the clusters. Resolves to { saved, clustersWithIssues }.
 */
export async function validateAndSaveClusterChanges() {
    const unsaved = getAll('clusters')
        .filter((cluster) => cluster.hasUnsavedChanges)
        .map((cluster) => ({ ...cluster, issues: validateMapping(cluster.isMapped, cluster.mapping) }));
    const withIssues = unsaved.filter((cluster) => cluster.issues.length > 0);
    if (withIssues.length > 0) {
        withIssues.forEach((cluster) => upsert('clusters', cluster));
        return { saved: 0, clustersWithIssues: withIssues.length };
    }
    const savedAt = new Date().toISOString();
    unsaved.forEach((cluster) => {
        logViewFilterChanges(cluster.id, cluster.savedState.mapping.viewFilter, cluster.mapping.viewFilter, savedAt, CURRENT_USER);
        recordPrioritizedSources(cluster.savedState.mapping.viewFilter, cluster.mapping.viewFilter, savedAt);
        upsert('clusters', {
            ...cluster,
            hasUnsavedChanges: false,
            savedState: { isMapped: cluster.isMapped, mapping: cluster.mapping }
        });
    });
    if (unsaved.length > 0) {
        upsert('clusterMappingEdits', { id: 'last-edit', editedAt: new Date().toISOString(), editedBy: CURRENT_USER });
    }
    return { saved: unsaved.length, clustersWithIssues: 0 };
}

/** Drop every unsaved change: each cluster goes back to its last saved state. */
export async function discardAllClusterChanges() {
    getAll('clusters')
        .filter((cluster) => cluster.hasUnsavedChanges)
        .forEach((cluster) => {
            const { isMapped, mapping } = cluster.savedState;
            upsert('clusters', {
                ...cluster,
                isMapped,
                mapping,
                hasUnsavedChanges: false,
                issues: [],
                mappedCount: countMappedAttributes(isMapped, mapping)
            });
        });
}
