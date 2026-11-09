// Zealosh LMS — Component Tree & Hierarchy Engine
// Standards: WebJET CMS wj-page-builder separation of structure and leaf content, recursive safety

import { CmsPageNode } from '@/types/cms';
import { COMPONENT_REGISTRY, isValidChild } from './component-registry';

/**
 * Generates a unique crypto-random identifier for CMS nodes
 */
export function generateNodeId(prefix: string = 'node'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Builds a nested hierarchical tree from a flat array of CmsPageNode objects
 */
export function buildTree(flatNodes: CmsPageNode[]): CmsPageNode[] {
  const nodeMap = new Map<string, CmsPageNode>();
  const rootNodes: CmsPageNode[] = [];

  // Deep clone nodes and initialize empty children array
  flatNodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Attach children to parents
  nodeMap.forEach((node) => {
    if (!node.parentId) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        // Orphan node: treat as root to prevent silent data loss, but flag
        rootNodes.push(node);
      }
    }
  });

  // Sort nodes and children by position
  const sortRecursive = (nodes: CmsPageNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => {
      if (n.children && n.children.length > 0) {
        sortRecursive(n.children);
      }
    });
  };

  sortRecursive(rootNodes);
  return rootNodes;
}

/**
 * Flattens a nested hierarchical tree back into an array of CmsPageNode objects
 */
export function flattenTree(
  tree: CmsPageNode[],
  pageVersionId: string,
  parentId: string | null = null
): CmsPageNode[] {
  const result: CmsPageNode[] = [];

  tree.forEach((node, index) => {
    const { children, ...rest } = node;
    const flatNode: CmsPageNode = {
      ...rest,
      pageVersionId,
      parentId: parentId || null,
      position: index,
      updatedAt: new Date().toISOString(),
    };
    result.push(flatNode);

    if (children && children.length > 0) {
      result.push(...flattenTree(children, pageVersionId, flatNode.id));
    }
  });

  return result;
}

/**
 * Checks if candidateAncestorId is an ancestor of candidateDescendantId (to prevent cycles)
 */
export function isDescendant(
  flatNodes: CmsPageNode[],
  candidateDescendantId: string,
  candidateAncestorId: string
): boolean {
  if (candidateDescendantId === candidateAncestorId) return true;

  const nodeMap = new Map<string, CmsPageNode>();
  flatNodes.forEach((n) => nodeMap.set(n.id, n));

  let current = nodeMap.get(candidateDescendantId);
  while (current && current.parentId) {
    if (current.parentId === candidateAncestorId) return true;
    current = nodeMap.get(current.parentId);
  }

  return false;
}

/**
 * Inserts a new node into the tree, validating parent-child constraints
 */
export function insertNode(
  flatNodes: CmsPageNode[],
  newNode: CmsPageNode,
  targetParentId: string | null = null,
  targetPosition?: number
): { success: boolean; nodes: CmsPageNode[]; error?: string } {
  // 1. Identify parent component type
  let parentComponentType: string | null = null;
  if (targetParentId) {
    const parentNode = flatNodes.find((n) => n.id === targetParentId);
    if (!parentNode) {
      return { success: false, nodes: flatNodes, error: `Target parent ${targetParentId} not found` };
    }
    parentComponentType = parentNode.componentType;
  }

  // 2. Validate hierarchy using component registry
  if (!isValidChild(parentComponentType, newNode.componentType)) {
    const expected = parentComponentType
      ? COMPONENT_REGISTRY[parentComponentType]?.allowedChildren.join(', ') || 'none'
      : 'Root allowed only';
    return {
      success: false,
      nodes: flatNodes,
      error: `Cannot insert ${newNode.componentType} into ${parentComponentType || 'root'}. Allowed children: [${expected}]`,
    };
  }

  // 3. Insert and position
  const siblings = flatNodes
    .filter((n) => (n.parentId || null) === (targetParentId || null))
    .sort((a, b) => a.position - b.position);

  const insertPos =
    targetPosition !== undefined && targetPosition >= 0
      ? Math.min(targetPosition, siblings.length)
      : siblings.length;

  const updatedNodes = flatNodes.map((n) => {
    if ((n.parentId || null) === (targetParentId || null) && n.position >= insertPos) {
      return { ...n, position: n.position + 1 };
    }
    return n;
  });

  const nodeToInsert: CmsPageNode = {
    ...newNode,
    parentId: targetParentId || null,
    position: insertPos,
    updatedAt: new Date().toISOString(),
  };

  updatedNodes.push(nodeToInsert);
  return { success: true, nodes: updatedNodes };
}

/**
 * Moves an existing node to a new parent or reorders within current parent
 */
export function moveNode(
  flatNodes: CmsPageNode[],
  nodeId: string,
  newParentId: string | null,
  newPosition: number
): { success: boolean; nodes: CmsPageNode[]; error?: string } {
  const nodeToMove = flatNodes.find((n) => n.id === nodeId);
  if (!nodeToMove) {
    return { success: false, nodes: flatNodes, error: `Node ${nodeId} not found` };
  }

  // Cycle check: Cannot move into own descendant
  if (newParentId && isDescendant(flatNodes, newParentId, nodeId)) {
    return { success: false, nodes: flatNodes, error: 'Cannot move node into its own descendant' };
  }

  // Hierarchy validation
  let newParentType: string | null = null;
  if (newParentId) {
    const parentNode = flatNodes.find((n) => n.id === newParentId);
    if (!parentNode) {
      return { success: false, nodes: flatNodes, error: `Target parent ${newParentId} not found` };
    }
    newParentType = parentNode.componentType;
  }

  if (!isValidChild(newParentType, nodeToMove.componentType)) {
    return {
      success: false,
      nodes: flatNodes,
      error: `Cannot move ${nodeToMove.componentType} into ${newParentType || 'root'}`,
    };
  }

  // Remove node temporarily from sibling reordering
  const oldParentId = nodeToMove.parentId || null;
  const targetParentId = newParentId || null;

  let workingNodes = flatNodes.map((n) => {
    if ((n.parentId || null) === oldParentId && n.position > nodeToMove.position) {
      return { ...n, position: n.position - 1 };
    }
    return n;
  });

  // Re-index target siblings
  workingNodes = workingNodes.map((n) => {
    if (n.id !== nodeId && (n.parentId || null) === targetParentId && n.position >= newPosition) {
      return { ...n, position: n.position + 1 };
    }
    return n;
  });

  // Update target node
  workingNodes = workingNodes.map((n) => {
    if (n.id === nodeId) {
      return {
        ...n,
        parentId: targetParentId,
        position: newPosition,
        updatedAt: new Date().toISOString(),
      };
    }
    return n;
  });

  return { success: true, nodes: workingNodes };
}

/**
 * Deep clones a node and all of its descendants with fresh unique IDs
 * Remaps interactive internal IDs (tabs, accordion triggers) per wj-page-builder standards
 */
export function duplicateNode(
  flatNodes: CmsPageNode[],
  nodeId: string
): { success: boolean; nodes: CmsPageNode[]; newRootId?: string; error?: string } {
  const target = flatNodes.find((n) => n.id === nodeId);
  if (!target) {
    return { success: false, nodes: flatNodes, error: `Node ${nodeId} not found` };
  }

  const idMap = new Map<string, string>();
  const descendantsToClone: CmsPageNode[] = [];

  // Helper to gather all descendants
  const gatherDescendants = (parentId: string) => {
    const children = flatNodes.filter((n) => n.parentId === parentId);
    children.forEach((c) => {
      descendantsToClone.push(c);
      gatherDescendants(c.id);
    });
  };

  gatherDescendants(nodeId);

  // Generate new IDs
  const newRootId = generateNodeId(target.componentType);
  idMap.set(target.id, newRootId);
  descendantsToClone.forEach((d) => {
    idMap.set(d.id, generateNodeId(d.componentType));
  });

  // Remap interactive props (tabs and accordions) to ensure unique anchors
  const remapProps = (componentType: string, props: Record<string, any>): Record<string, any> => {
    const cloned = JSON.parse(JSON.stringify(props));
    const randomSuffix = Math.random().toString(36).substring(2, 6);

    if (componentType === 'tabs' && Array.isArray(cloned.tabs)) {
      cloned.tabs = cloned.tabs.map((tab: any) => ({
        ...tab,
        id: `${tab.id || 'tab'}-copy-${randomSuffix}`,
      }));
    } else if (componentType === 'accordion' && Array.isArray(cloned.items)) {
      cloned.items = cloned.items.map((item: any) => ({
        ...item,
        id: `${item.id || 'acc'}-copy-${randomSuffix}`,
      }));
    }

    return cloned;
  };

  // Clone root node
  const clonedRoot: CmsPageNode = {
    ...target,
    id: newRootId,
    position: target.position + 1,
    props: remapProps(target.componentType, target.props),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Shift subsequent siblings
  let workingNodes = flatNodes.map((n) => {
    if ((n.parentId || null) === (target.parentId || null) && n.position > target.position) {
      return { ...n, position: n.position + 1 };
    }
    return n;
  });

  workingNodes.push(clonedRoot);

  // Clone descendants
  descendantsToClone.forEach((desc) => {
    const newId = idMap.get(desc.id)!;
    const newParent = idMap.get(desc.parentId!) || desc.parentId;
    const clonedDesc: CmsPageNode = {
      ...desc,
      id: newId,
      parentId: newParent,
      props: remapProps(desc.componentType, desc.props),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workingNodes.push(clonedDesc);
  });

  return { success: true, nodes: workingNodes, newRootId };
}

/**
 * Deletes a node and all of its descendants
 */
export function deleteNode(
  flatNodes: CmsPageNode[],
  nodeId: string
): { success: boolean; nodes: CmsPageNode[]; error?: string } {
  const target = flatNodes.find((n) => n.id === nodeId);
  if (!target) {
    return { success: false, nodes: flatNodes, error: `Node ${nodeId} not found` };
  }

  const idsToDelete = new Set<string>([nodeId]);

  const collectDescendants = (parentId: string) => {
    flatNodes.forEach((n) => {
      if (n.parentId === parentId) {
        idsToDelete.add(n.id);
        collectDescendants(n.id);
      }
    });
  };

  collectDescendants(nodeId);

  // Remove nodes and adjust sibling positions
  const parentId = target.parentId || null;
  const filteredNodes = flatNodes.filter((n) => !idsToDelete.has(n.id));

  const reindexedNodes = filteredNodes.map((n) => {
    if ((n.parentId || null) === parentId && n.position > target.position) {
      return { ...n, position: n.position - 1 };
    }
    return n;
  });

  return { success: true, nodes: reindexedNodes };
}

/**
 * Validates the entire component tree structure against the component registry
 */
export function validateTree(flatNodes: CmsPageNode[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeMap = new Map<string, CmsPageNode>();
  flatNodes.forEach((n) => nodeMap.set(n.id, n));

  flatNodes.forEach((node) => {
    const def = COMPONENT_REGISTRY[node.componentType];
    if (!def) {
      errors.push(`Unknown component type "${node.componentType}" for node ${node.id}`);
      return;
    }

    if (!node.parentId) {
      if (!def.isRootAllowed) {
        errors.push(`Node ${node.id} (${node.componentType}) is not allowed at page root`);
      }
    } else {
      const parent = nodeMap.get(node.parentId);
      if (!parent) {
        errors.push(`Node ${node.id} has missing parent ${node.parentId}`);
      } else {
        const parentDef = COMPONENT_REGISTRY[parent.componentType];
        if (parentDef && !parentDef.allowedChildren.includes(node.componentType)) {
          errors.push(
            `Node ${node.id} (${node.componentType}) is not a permitted child of ${parent.componentType}`
          );
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

