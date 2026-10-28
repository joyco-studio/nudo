const SHADER_NAME_PREFIX = 'nudo_'
/**
 * The escape letter. `$` (legal in a JS identifier, not in WGSL or GLSL) becomes `Qd`, and a `Q`
 * of the name becomes `QQ`, so no two property names share a shader name: `a$b`, `a_b` and `aQdb`
 * stay apart. A rare capital keeps most names as they are.
 */
const ESCAPE = 'Q'
const ESCAPES: Readonly<Record<string, string>> = {
  $: `${ESCAPE}d`,
  [ESCAPE]: `${ESCAPE}${ESCAPE}`,
}
const ESCAPED_CHARACTERS = new RegExp(`[$${ESCAPE}]`, 'g')

/**
 * The name a property's uniform carries into generated shader code. The prefix keeps a property
 * called `vec3`, `sample` or `fn` clear of shader keywords and built-ins. One-to-one: properties
 * with different names (the Blackboard keeps them unique) never share a uniform name.
 */
export function toShaderName(propertyName: string): string {
  const escaped = propertyName.replace(ESCAPED_CHARACTERS, (character) => ESCAPES[character] ?? '')
  return `${SHADER_NAME_PREFIX}${escaped}`
}
