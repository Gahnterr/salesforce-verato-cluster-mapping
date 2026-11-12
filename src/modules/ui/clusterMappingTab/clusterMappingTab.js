import { LightningElement } from 'lwc';
import {
    discardAllClusterChanges,
    getAllClusters,
    getClusterAttributes,
    getLastClusterEdit,
    updateClusterMapping,
    validateAndSaveClusterChanges
} from 'data/clusters';
import { getAllVeratoDomains } from 'data/veratoDomains';

/** Edits made within this long of each other on one cluster (typing, say) undo as one step. */
const UNDO_MERGE_MS = 750;

// Placeholder until the support article exists.
const LEARN_MORE_URL = 'https://www.google.com';

/** "Cluster Mapping" tab: pick a cluster in the tree, see its mapping config beside it. */
export default class ClusterMappingTab extends LightningElement {
    learnMoreUrl = LEARN_MORE_URL;
    domains = [];
    clusters = [];
    lastRefreshed = Date.now();
    lastEdit = null;

    saveLabel = 'Save';
    discardLabel = 'Discard';

    selectedId = '';
    selectedAttributes = [];

    /** Edits since the last save, newest last: { clusterId, before, after (mappings), at }. */
    undoStack = [];
    /** Undone edits, next to redo last; emptied by any new edit. */
    redoStack = [];

    connectedCallback() {
        this.refresh();
    }

    async refresh() {
        [this.domains, this.clusters, this.lastEdit] = await Promise.all([
            getAllVeratoDomains(),
            getAllClusters(),
            getLastClusterEdit()
        ]);
        this.lastRefreshed = Date.now();
    }

    get hasUnsavedChanges() {
        return this.unsavedClusters.length > 0;
    }

    get cannotUndo() {
        return this.undoStack.length === 0;
    }

    get cannotRedo() {
        return this.redoStack.length === 0;
    }

    /**
     * Undo and redo show with the save and discard buttons, while there are unsaved changes. They also stay
     * while something can be redone, which is the case after undoing back to the saved state.
     */
    get showChangeActions() {
        return this.hasUnsavedChanges || !this.cannotRedo;
    }

    get lastEditPrefix() {
        return `Last edited by ${this.lastEdit.editedBy}`;
    }

    get unsavedClusters() {
        return this.clusters.filter((cluster) => cluster.hasUnsavedChanges);
    }

    get clustersWithIssues() {
        return this.unsavedClusters.filter((cluster) => cluster.issues.length > 0);
    }

    get hasIssues() {
        return this.clustersWithIssues.length > 0;
    }

    get issuesTitle() {
        const count = this.clustersWithIssues.length;
        return count === 1 ? 'There is 1 cluster with issues.' : `There are ${count} clusters with issues.`;
    }

    get selectedCluster() {
        return this.clusters.find((cluster) => cluster.id === this.selectedId) ?? null;
    }

    /** Other mapped clusters of the selected one's domain, as the view filter YAML has a rule for each of them. */
    get otherMappedClusters() {
        const selected = this.selectedCluster;
        return this.clusters.filter((cluster) => cluster.isMapped && cluster.domainId === selected?.domainId && cluster.id !== selected.id);
    }

    get hasRulesBefore() {
        const at = this.clusters.indexOf(this.selectedCluster);
        return this.otherMappedClusters.some((cluster) => this.clusters.indexOf(cluster) < at);
    }

    get hasRulesAfter() {
        const at = this.clusters.indexOf(this.selectedCluster);
        return this.otherMappedClusters.some((cluster) => this.clusters.indexOf(cluster) > at);
    }

    /** All clusters under the selected one, however deep. */
    get nestedClusters() {
        const nested = [];
        let parentIds = [this.selectedId];
        while (parentIds.length > 0) {
            const children = this.clusters.filter((cluster) => parentIds.includes(cluster.parentId));
            nested.push(...children);
            parentIds = children.map((cluster) => cluster.id);
        }
        return nested;
    }

    async handleMappingChange(event) {
        const { mapping } = event.detail;
        const before = this.selectedCluster.mapping;
        const now = Date.now();
        const last = this.undoStack[this.undoStack.length - 1];
        this.undoStack =
            last && last.clusterId === this.selectedId && now - last.at < UNDO_MERGE_MS
                ? [...this.undoStack.slice(0, -1), { ...last, after: mapping, at: now }]
                : [...this.undoStack, { clusterId: this.selectedId, before, after: mapping, at: now }];
        this.redoStack = [];
        await updateClusterMapping(this.selectedId, mapping);
        this.clusters = await getAllClusters();
    }

    async handleSave() {
        // Validates first: with any issues nothing is saved and the clusters with issues show them.
        const { clustersWithIssues } = await validateAndSaveClusterChanges();
        [this.clusters, this.lastEdit] = await Promise.all([getAllClusters(), getLastClusterEdit()]);
        if (clustersWithIssues === 0) {
            // The save point moved, so there is nothing before it to undo.
            this.undoStack = [];
            this.redoStack = [];
        }
    }

    async handleDiscard() {
        await discardAllClusterChanges();
        this.clusters = await getAllClusters();
        this.undoStack = [];
        this.redoStack = [];
    }

    handleUndo() {
        const entry = this.undoStack[this.undoStack.length - 1];
        this.undoStack = this.undoStack.slice(0, -1);
        this.redoStack = [...this.redoStack, entry];
        return this.applyHistory(entry.clusterId, entry.before);
    }

    handleRedo() {
        const entry = this.redoStack[this.redoStack.length - 1];
        this.redoStack = this.redoStack.slice(0, -1);
        this.undoStack = [...this.undoStack, { ...entry, at: 0 }];
        return this.applyHistory(entry.clusterId, entry.after);
    }

    /** Puts a cluster's mapping back as it was, selecting that cluster so the change is in view. */
    async applyHistory(clusterId, mapping) {
        await updateClusterMapping(clusterId, mapping);
        this.clusters = await getAllClusters();
        if (clusterId !== this.selectedId) {
            await this.handleClusterSelect({ detail: { id: clusterId } });
        }
    }

    async handleClusterSelect(event) {
        const { id } = event.detail;
        this.selectedId = id;
        const { domainId, path } = this.selectedCluster;
        const attributes = await getClusterAttributes(domainId, path);
        // Ignore the result if the user picked another cluster while this loaded.
        if (this.selectedId === id) {
            this.selectedAttributes = attributes;
        }
    }
}
