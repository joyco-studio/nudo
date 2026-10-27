import { asEdgeId, asNodeId, asPropertyId } from '@nudo-tsl/core'
import type { EdgeId, NodeId, PropertyId } from '@nudo-tsl/core'
import { nanoid } from 'nanoid'

export const createNodeId = (): NodeId => asNodeId(nanoid())

export const createEdgeId = (): EdgeId => asEdgeId(nanoid())

export const createPropertyId = (): PropertyId => asPropertyId(nanoid())
