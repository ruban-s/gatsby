import { ActionsUnion, IGatsbyNode } from "../../../redux/types"
import { Database } from "lmdb-store"

type NodeId = string

export function updateNodes(
  nodesDb: Database<IGatsbyNode, NodeId>,
  action: ActionsUnion
): Promise<boolean> | boolean {
  switch (action.type) {
    case `CREATE_NODE`:
    case `ADD_FIELD_TO_NODE`:
    case `ADD_CHILD_NODE_TO_PARENT_NODE`: {
      return nodesDb.put(action.payload.id, action.payload)
    }
    case `DELETE_NODE`: {
      if (action.payload) {
        return nodesDb.remove(action.payload.id)
      }
      return false
    }
    case `MATERIALIZE_PAGE_MODE`: {
      const id = `SitePage ${action.payload.path}`
      const node = nodesDb.get(id)
      if (!node) {
        throw new Error(`Could not find SitePage node by id: ${id}`)
      }
      node.mode = action.payload.pageMode
      return nodesDb.put(id, node)
    }
  }
  return false
}
