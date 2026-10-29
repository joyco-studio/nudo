/** Local `Fn` helpers a generated module declares itself, mirroring the live runtime's. */
export type HelperName =
  | 'simplexNoise3'
  | 'normalFromHeight'
  | 'sceneDepthFade'
  | 'voronoiCell2'
  | 'voronoiCell3'
  | 'hashFloat'
  | 'hashVec3'

/**
 * A piece of generated JavaScript plus what it needs around it: the `three/tsl` names to import,
 * the local helpers to declare and the hoisted constants it reads. `code` is always a call, a
 * member access or an identifier, so it is safe as the receiver of a method call.
 */
export interface CodeExpression {
  readonly code: string
  readonly imports: readonly string[]
  readonly helpers: readonly HelperName[]
  readonly hoisted: readonly HoistedValue[]
}

/** A `const name = value` line of the module. */
export interface HoistedValue {
  readonly name: string
  readonly value: CodeExpression
}

interface OwnNeeds {
  readonly imports?: readonly string[]
  readonly helpers?: readonly HelperName[]
}

/** An expression built from `parts`, inheriting everything they need. */
export function compose(
  code: string,
  parts: readonly CodeExpression[],
  own: OwnNeeds = {},
): CodeExpression {
  return {
    code,
    imports: [...(own.imports ?? []), ...parts.flatMap((part) => part.imports)],
    helpers: [...(own.helpers ?? []), ...parts.flatMap((part) => part.helpers)],
    hoisted: parts.flatMap((part) => part.hoisted),
  }
}

/** A reference to a hoisted constant; the constant itself is declared where it is first needed. */
export const referenceTo = (hoisted: HoistedValue): CodeExpression => ({
  code: hoisted.name,
  imports: [],
  helpers: [],
  hoisted: [hoisted],
})

export interface ModuleDependencies {
  readonly imports: ReadonlySet<string>
  readonly helpers: ReadonlySet<HelperName>
  /** Constants in declaration order: every constant comes after the ones it reads. */
  readonly declarations: readonly HoistedValue[]
}

/** Walks the roots depth-first and gathers everything the module must declare and import. */
export function collectDependencies(roots: readonly CodeExpression[]): ModuleDependencies {
  const imports = new Set<string>()
  const helpers = new Set<HelperName>()
  const declared = new Set<HoistedValue>()
  const declarations: HoistedValue[] = []

  const visit = (expression: CodeExpression): void => {
    expression.imports.forEach((name) => imports.add(name))
    expression.helpers.forEach((name) => helpers.add(name))
    for (const hoisted of expression.hoisted) {
      if (declared.has(hoisted)) continue
      declared.add(hoisted)
      visit(hoisted.value)
      declarations.push(hoisted)
    }
  }

  roots.forEach(visit)
  return { imports, helpers, declarations }
}
