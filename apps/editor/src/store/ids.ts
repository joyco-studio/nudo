import { asEdgeId, asNodeId } from '@nudo-tsl/core'
import type { EdgeId, NodeId } from '@nudo-tsl/core'
import { nanoid } from 'nanoid'

export const createNodeId = (): NodeId => asNodeId(nanoid())

export const createEdgeId = (): EdgeId => asEdgeId(nanoid())
