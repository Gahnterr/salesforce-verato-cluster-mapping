import { LightningElement, api } from 'lwc';

/** Subsequence match: "adr" finds "addresses". Case-insensitive. */
function fuzzyMatch(query, text) {
    const haystack = text.toLowerCase();
    let position = 0;
    for (const char of query.toLowerCase()) {
        position = haystack.indexOf(char, position);
        if (position === -1) {
            return false;
        }
        position += 1;
    }
    return true;
}

const MAPPED_ICON = { iconName: 'utility:success', variant: 'success', alternativeText: 'Mapped' };
// No blue icon variant exists; clusterTree.css colors the default variant with an accent hook.
// The variant is explicit because the tree reuses icon elements and would keep a previous one.
const CHANGED_ICON = { iconName: 'utility:edit', variant: '', alternativeText: 'Unsaved changes' };
const ISSUES_ICON = { iconName: 'utility:warning', variant: 'warning', alternativeText: 'Has issues that prevent saving' };

/**
 * Trailing tree icon from the cluster's mapping state: unsaved changes show
 * whether they can be saved (edit) or not (warning); otherwise a mapped
 * cluster shows a check and an unmapped one nothing.
 */
function statusIcon({ isMapped, hasUnsavedChanges, issues }) {
    if (hasUnsavedChanges) {
        return issues.length > 0 ? ISSUES_ICON : CHANGED_ICON;
    }
    return isMapped ? MAPPED_ICON : null;
}

export default class ClusterTree extends LightningElement {
    @api selectedId = '';

    _domains = [];
    _clusters = [];
    searchTerm = '';

    /** Domains ({ id, name }); each becomes a collapsible header in the tree. */
    @api
    get domains() {
        return this._domains;
    }
    set domains(value) {
        this._domains = Array.isArray(value) ? value : [];
    }

    /** Flat clusters ({ id, domainId, parentId, name }); nesting comes from parentId. */
    @api
    get clusters() {
        return this._clusters;
    }
    set clusters(value) {
        this._clusters = Array.isArray(value) ? value : [];
    }

    /**
     * One tree per domain, so the domain name can be the tree's own (non-collapsible) header.
     * A domain with no matching clusters is left out.
     */
    get groups() {
        return this._domains
            .map((domain) => ({ id: domain.id, header: this.domainHeader(domain), issueCount: this.issueCount(domain), items: this.buildClusterItems(domain, null) }))
            .filter((group) => group.items.length > 0);
    }

    /** "Core Person (23/59)": clusters mapped out of all clusters in the domain, however deeply nested. */
    domainHeader(domain) {
        const clusters = this._clusters.filter((cluster) => cluster.domainId === domain.id);
        const mapped = clusters.filter((cluster) => cluster.isMapped).length;
        return `${domain.name} (${mapped}/${clusters.length})`;
    }

    /** Issues across all of a domain's clusters at any depth, or null (no attribute) when there are none. */
    issueCount(domain) {
        const count = this._clusters
            .filter((cluster) => cluster.domainId === domain.id)
            .reduce((total, cluster) => total + cluster.issues.length, 0);
        return count > 0 ? String(count) : null;
    }

    /** All clusters under a cluster, at any depth. */
    nestedClusters(cluster) {
        return this._clusters
            .filter((candidate) => candidate.parentId === cluster.id)
            .flatMap((child) => [child, ...this.nestedClusters(child)]);
    }

    /** "23/59 Clusters Mapped": every cluster in every domain, at any nesting depth; ignores the search. */
    get mappedSummary() {
        const mapped = this._clusters.filter((cluster) => cluster.isMapped).length;
        return `${mapped}/${this._clusters.length} Clusters Mapped`;
    }

    get hasGroups() {
        return this.groups.length > 0;
    }

    get isSearching() {
        return this.searchTerm.length > 0;
    }

    /**
     * Tree items for a domain's clusters under a parent. With a search term, a
     * cluster stays when its name or its domain's name matches, or when a
     * descendant does; matches open their ancestors. Without one, all is collapsed.
     */
    buildClusterItems(domain, parentId) {
        return this._clusters
            .filter((cluster) => cluster.domainId === domain.id && cluster.parentId === parentId)
            .map((cluster) => {
                const children = this.buildClusterItems(domain, cluster.id);
                const matches =
                    !this.isSearching ||
                    fuzzyMatch(this.searchTerm, cluster.name) ||
                    fuzzyMatch(this.searchTerm, domain.name);
                if (!matches && children.length === 0) {
                    return null;
                }
                // "(3/6)" = nested clusters mapped; only clusters that have nested clusters show it.
                const nested = this.nestedClusters(cluster);
                const counts = nested.length > 0 ? ` (${nested.filter((n) => n.isMapped).length}/${nested.length})` : '';
                const item = { label: `${cluster.name}${counts}`, name: cluster.id, expanded: this.isSearching && children.length > 0 };
                const endIcon = statusIcon(cluster);
                if (endIcon) {
                    item.endIcon = endIcon;
                }
                if (children.length > 0) {
                    item.items = children;
                }
                return item;
            })
            .filter(Boolean);
    }

    renderedCallback() {
        // The header's counter is drawn by global.css from this custom property (see the data-issues rule there).
        this.template.querySelectorAll('lightning-tree').forEach((tree) => {
            const count = tree.dataset.issues;
            if (count) {
                tree.style.setProperty('--c-domain-issues', `"${count}"`);
            } else {
                tree.style.removeProperty('--c-domain-issues');
            }
        });
    }

    handleSearch(event) {
        this.searchTerm = event.target.value.trim();
    }

    handleSelect(event) {
        this.dispatchEvent(new CustomEvent('clusterselect', { detail: { id: event.detail.name } }));
    }
}
