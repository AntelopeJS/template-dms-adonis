import type {
  ProcedureDataEdge,
  ProcedureGraph,
  ProcedureGraphNode,
  ProcedureTriggerEdge,
} from "@antelopejs/interface-dms-automation";

const COLUMN_PX = 300;
const ROW_PX = 160;

type NodeKind = "trigger" | "action" | "data" | "if";

/** A node on the canvas grid, `column` from the left and `row` from the top. */
export function node(
  id: string,
  kind: NodeKind,
  typeId: string | undefined,
  at: [column: number, row: number],
  config: ProcedureGraphNode["config"] = {},
): ProcedureGraphNode {
  const [column, row] = at;
  const placed: ProcedureGraphNode = {
    id,
    kind,
    config,
    position: { x: column * COLUMN_PX, y: row * ROW_PX },
  };
  if (typeId) placed.typeId = typeId;
  return placed;
}

/** Runs `to` after `from` (`branch`: "then" / "else" of an If node). */
export function next(
  from: string,
  to: string,
  branch?: string,
): ProcedureTriggerEdge {
  const edge: ProcedureTriggerEdge = {
    id: `t-${from}-${branch ?? "next"}-${to}`,
    from: { node: from },
    to: { node: to },
  };
  if (branch) edge.from.branch = branch;
  return edge;
}

/** Feeds the `port` output of `from` into the `field` input of `to`. */
export function wire(
  from: string,
  port: string,
  to: string,
  field: string,
): ProcedureDataEdge {
  return {
    id: `d-${from}-${port}-${to}-${field}`,
    from: { node: from, port },
    to: { node: to, field },
  };
}

/**
 * Assembles a procedure graph in the shape the builder's "Export JSON"
 * produces, from nodes and edges written with `node`, `next` and `wire`. Their
 * node and edge ids are stable because `DeclareProcedure` compares the
 * declaration with the last one to decide whether to refresh it.
 */
export function graph(
  nodes: ProcedureGraphNode[],
  triggerEdges: ProcedureTriggerEdge[],
  dataEdges: ProcedureDataEdge[] = [],
): ProcedureGraph {
  return { nodes, triggerEdges, dataEdges };
}
