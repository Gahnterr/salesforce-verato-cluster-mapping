import { getAll, upsert, replaceAll, defaultViewFilter } from 'data/db';

export { defaultViewFilter };

/**
 * View filter config of a cluster: which values of the cluster are sent to / received from Salesforce, and in what order.
 * The filter is part of the cluster's mapping (`mapping.viewFilter`), so it is edited and saved with it;
 * saving also appends every change to the `viewFilterChanges` table.
 */

export const SORT_BY_OPTIONS = [
    { value: 'recent', label: 'Most Recently Asserted' },
    { value: 'priority', label: 'Source Priority Order' },
    { value: 'both', label: 'Both' }
];

export const SORT_FIRST_OPTIONS = [
    { value: 'priority', label: 'Source Priority Order, then by Most Recently Asserted' },
    { value: 'recent', label: 'Most Recently Asserted, then by Source Priority Order' }
];

/** Placeholder sources until the org's real ones are available. */
export const SOURCES = ['cerner', 'ehr', 'epic', 'Patient Records', 'Clinical Trials', 'Medication Database', 'Lab Results Archive', 'Treatment Guidelines'];

/** How many recently prioritized sources the source search offers before anything is typed. */
const RECENT_SOURCES_LIMIT = 5;
/** Stands in for the round trip of the real source search. */
const SEARCH_LATENCY_MS = 400;

/**
 * Mock of the source search API: the sources matching `term` that are not in `exclude`, best match first
 * (exact name, then names starting with it, then words starting with it, then the rest, alphabetically).
 */
export function searchSources(term, exclude = []) {
    const query = term.trim().toLowerCase();
    const rank = (name) => {
        const lower = name.toLowerCase();
        if (lower === query) {
            return 0;
        }
        if (lower.startsWith(query)) {
            return 1;
        }
        return lower.split(/[\s_-]+/).some((word) => word.startsWith(query)) ? 2 : 3;
    };
    const matches = SOURCES.filter((name) => !exclude.includes(name) && name.toLowerCase().includes(query));
    matches.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return new Promise((resolve) => setTimeout(() => resolve(matches), SEARCH_LATENCY_MS));
}

/** The sources saved as prioritized most recently, newest first (at most RECENT_SOURCES_LIMIT). */
export function getRecentSources() {
    return getAll('recentSources')
        .sort((a, b) => b.prioritizedAt.localeCompare(a.prioritizedAt) || b.order - a.order)
        .map(({ name }) => name);
}

/**
 * Remember the sources a save added to a view filter's prioritized list, oldest to newest as they were listed.
 * A source already remembered moves to the newest place; past the limit, the oldest are forgotten.
 */
export function recordPrioritizedSources(before = defaultViewFilter(), after = defaultViewFilter(), prioritizedAt) {
    const added = after.sort.sources.filter((name) => !before.sort.sources.includes(name));
    if (added.length === 0) {
        return;
    }
    const oldestFirst = getRecentSources().reverse().filter((name) => !added.includes(name));
    const kept = [...oldestFirst, ...added].slice(-RECENT_SOURCES_LIMIT);
    replaceAll(
        'recentSources',
        kept.map((name, order) => ({ id: name, name, prioritizedAt, order }))
    );
}

// Placeholder for the signed-in user until the prototype has real auth.
const CURRENT_USER = 'Austin Guevara';

const FIELD_LABELS = {
    activeOnly: 'Only active values',
    filter: 'Attribute filter',
    sort: 'Sort order'
};

/** Log what changed between two view filters of a cluster, one row per changed setting. A missing filter counts as the default. */
export function logViewFilterChanges(clusterId, before = defaultViewFilter(), after = defaultViewFilter(), changedAt, changedBy = CURRENT_USER) {
    Object.keys(FIELD_LABELS)
        .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
        .forEach((field) =>
            upsert('viewFilterChanges', {
                id: `${clusterId}|${changedAt}|${field}`,
                clusterId,
                field,
                fieldLabel: FIELD_LABELS[field],
                from: before[field],
                to: after[field],
                changedAt,
                changedBy
            })
        );
}

/** Every logged change, newest first. */
export async function getViewFilterChanges() {
    return getAll('viewFilterChanges').sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

/** Short texts for the Visual Editor's overview rows. */
export function describeFilter({ attribute, value }) {
    return attribute && value ? `${attribute}: ${value}` : 'No Filter Applied';
}

export function describeSort({ by, first }) {
    if (by === 'both') {
        const labels = first === 'recent' ? ['Most Recently Asserted', 'Source Priority Order'] : ['Source Priority Order', 'Most Recently Asserted'];
        return `First: ${labels[0]}, Then: ${labels[1]}`;
    }
    return SORT_BY_OPTIONS.find((option) => option.value === by).label;
}

/**
 * The YAML editor shows the cluster's rule the way Verato's smart view config (CustomViewsConfig.yaml) writes it:
 * one entry of a view's `rules` list, named by the smart view attribute of the cluster.
 */
const SMART_VIEW_ATTRIBUTES = {
    names: 'PERSON_NAME',
    addresses: 'ADDRESS',
    datesOfBirth: 'BIRTH_DETAILS',
    ssns: 'CREDENTIALS_SSN',
    phoneNumbers: 'CONTACT_PHONE',
    emails: 'CONTACT_EMAIL',
    deathDetails: 'DEATH_DETAILS',
    externalUniqueIdentifier: 'EXTERNAL_UNIQUE_IDENTIFIER',
    alternateIdentifiers: 'ALTERNATE_IDENTIFIERS',
    multipleBirthIndicator: 'MULTIPLE_BIRTH_INDICATOR'
};

/** The smart view `attributeName` of a cluster; clusters without a built-in name are custom clusters. */
export const smartViewAttributeName = (clusterName) => SMART_VIEW_ATTRIBUTES[clusterName] ?? `custom.${clusterName}`;

const SORT_ORDERS = { priority: 'SOURCE_PRIORITY_ORDER', recent: 'MOST_RECENTLY_ASSERTED' };
const ELLIPSIS = '...';
const WILDCARD = '*';

/** Plain words stay bare; anything else (spaces, "*", numbers, true/false) is quoted so it reads back as text. */
const yamlText = (value) => (/^[A-Za-z][\w.-]*$/.test(value) && !/^(true|false|null|yes|no)$/i.test(value) ? value : JSON.stringify(String(value)));
const yamlList = (values) => `[${values.map(yamlText).join(', ')}]`;

/**
 * The view filter as the smart view rule for `attributeName`, in the shape parseViewFilterYaml reads back.
 * Since the editor shows only this rule, an ellipsis line goes above and/or below it when the view has other rules there.
 */
export function viewFilterToYaml({ activeOnly, filter, sort }, { attributeName, multiValued = false, hasRulesBefore = false, hasRulesAfter = false }) {
    const orders = sort.by === 'both' ? (sort.first === 'recent' ? ['recent', 'priority'] : ['priority', 'recent']) : [sort.by];
    const lines = [
        `- attributeName: ${yamlText(attributeName)}`,
        // Not edited in the Visual Editor: a cluster with a child object holds many values (-1), any other holds one.
        `  cardinality: ${multiValued ? -1 : 1}`,
        '  sorting:',
        `    sortBy: ${yamlList(orders.map((order) => SORT_ORDERS[order]))}`
    ];
    if (orders.includes('priority')) {
        const priorities = sort.includeUnprioritized ? [...sort.sources, WILDCARD] : sort.sources;
        lines.push(`    sourcePriorities: ${yamlList(priorities)}`);
    }
    const hasValueFilter = filter.attribute !== '' && filter.value !== '';
    if (activeOnly || hasValueFilter) {
        lines.push('  filtering:');
        if (activeOnly) {
            lines.push('    filterBy: [ACTIVE_ONLY]');
        }
        if (hasValueFilter) {
            lines.push(
                '    filterByValues:',
                `      - attributeName: ${yamlText(filter.attribute)}`,
                `        values: ${yamlList([filter.value])}`
            );
        }
    }
    return [...(hasRulesBefore ? [ELLIPSIS] : []), ...lines, ...(hasRulesAfter ? [ELLIPSIS] : [])].join('\n') + '\n';
}

/** One YAML scalar: quoted text, or bare text taken as is. */
function textOf(raw) {
    const text = raw.trim();
    if (text.startsWith('"')) {
        try {
            return JSON.parse(text);
        } catch {
            throw new Error('That text is missing its closing quote.');
        }
    }
    return text;
}

/** A `[a, b, "c, d"]` list. */
function listOf(raw) {
    const text = raw.trim();
    if (!text.startsWith('[') || !text.endsWith(']')) {
        throw new Error('Write the list in brackets, like [a, b].');
    }
    const items = text.slice(1, -1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g) ?? [];
    return items.map(textOf).filter((item) => item !== '');
}

const SECTION_KEYS = { sorting: ['sortBy', 'sourcePriorities'], filtering: ['filterBy', 'filterByValues'] };

/** Reads the rule text into { attributeName, cardinality, sorting, filtering } (only what is written), or { error } naming the line. */
function readRule(text) {
    const rule = {};
    const lines = text.split('\n');
    let base = null;
    let section = null;
    let subDepth = null;
    let item = null;
    for (let index = 0; index < lines.length; index += 1) {
        const raw = lines[index];
        let body = raw.trim();
        if (body === '' || body.startsWith('#') || body === ELLIPSIS) {
            continue;
        }
        const fail = (message) => ({ error: `Line ${index + 1}: ${message}` });
        try {
            let depth = raw.length - raw.trimStart().length;
            const isEntry = body.startsWith('- ');
            if (isEntry) {
                body = body.slice(2).trim();
            }
            if (base === null) {
                base = depth + (isEntry ? 2 : 0);
                depth = base;
            } else if (isEntry) {
                if (!(rule.filtering?.filterByValues && depth >= subDepth)) {
                    return fail('A "- " entry belongs under filterByValues.');
                }
                item = {};
                rule.filtering.filterByValues.push(item);
                depth = Infinity;
            }
            const [, key, rest] = body.match(/^(\w+):\s*(.*)$/) ?? [];
            if (!key) {
                return fail('Expected "key: value".');
            }
            if (depth === Infinity || (item && depth > subDepth)) {
                if (key === 'attributeName') {
                    item.attributeName = textOf(rest);
                } else if (key === 'values') {
                    item.values = listOf(rest);
                } else {
                    return fail(`Unknown key "${key}".`);
                }
            } else if (depth === base) {
                section = null;
                item = null;
                if (key === 'attributeName') {
                    rule.attributeName = textOf(rest);
                } else if (key === 'cardinality') {
                    // Whatever is typed is ignored (and rewritten when the editor loses focus): the child object switch decides it.
                    rule.cardinality = rest.trim();
                } else if (SECTION_KEYS[key]) {
                    if (rest.trim() !== '') {
                        return fail(`Put the settings of ${key} on the lines below it.`);
                    }
                    rule[key] = {};
                    section = key;
                    subDepth = null;
                } else {
                    return fail(`Unknown key "${key}".`);
                }
            } else if (depth > base && section) {
                if (!SECTION_KEYS[section].includes(key)) {
                    return fail(`Unknown key "${key}".`);
                }
                subDepth = depth;
                item = null;
                if (key === 'filterByValues') {
                    if (rest.trim() !== '') {
                        return fail('Put the entries of filterByValues on the lines below it, one "- " each.');
                    }
                    rule[section][key] = [];
                } else {
                    rule[section][key] = listOf(rest);
                }
            } else {
                return fail('Unexpected indentation.');
            }
        } catch (error) {
            return fail(error.message);
        }
    }
    return { rule };
}

/**
 * Read a smart view rule written in the shape of viewFilterToYaml (a deliberately small subset of YAML, and of the
 * smart view config). Returns { filter } or { error }. Settings left out keep their value from `current`, except that
 * a rule with no `filtering` has no filters. `attributeName` is the cluster's own, so it can't be changed here.
 */
export function parseViewFilterYaml(text, current, attributeName) {
    const { rule, error } = readRule(text);
    if (error) {
        return { error };
    }
    if (rule.attributeName !== undefined && rule.attributeName !== attributeName) {
        return { error: `attributeName must stay ${attributeName}, the attribute of this cluster.` };
    }
    // `cardinality` follows the child object switch, so a typed value (or its absence) is ignored.
    const next = { ...current, filter: { attribute: '', value: '' }, sort: { ...current.sort }, activeOnly: false };

    const { sortBy, sourcePriorities } = rule.sorting ?? {};
    if (sortBy) {
        const orders = sortBy.map((order) => Object.keys(SORT_ORDERS).find((key) => SORT_ORDERS[key] === order));
        if (orders.length < 1 || orders.length > 2 || orders.includes(undefined) || new Set(orders).size !== orders.length) {
            return { error: 'sortBy must list SOURCE_PRIORITY_ORDER and/or MOST_RECENTLY_ASSERTED, each once.' };
        }
        next.sort.by = orders.length === 2 ? 'both' : orders[0];
        if (orders.length === 2) {
            next.sort.first = orders[0];
        }
    }
    if (sourcePriorities) {
        next.sort.includeUnprioritized = sourcePriorities.includes(WILDCARD);
        next.sort.sources = [...new Set(sourcePriorities.filter((source) => source !== WILDCARD))];
    }

    const { filterBy = [], filterByValues = [] } = rule.filtering ?? {};
    if (filterBy.some((name) => name !== 'ACTIVE_ONLY')) {
        return { error: 'filterBy only supports ACTIVE_ONLY.' };
    }
    next.activeOnly = filterBy.includes('ACTIVE_ONLY');
    if (filterByValues.length > 1 || filterByValues.some(({ values = [] }) => values.length > 1)) {
        return { error: 'Only one attribute value filter is supported: one attributeName with one value.' };
    }
    if (filterByValues.length === 1) {
        const [{ attributeName: name = '', values = [] }] = filterByValues;
        next.filter = { attribute: name, value: values[0] ?? '' };
    }
    return { filter: next };
}
