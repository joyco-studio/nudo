type LightVector = readonly [number, number, number]

export interface MainLightDefaults {
  /** Unit vector from the surface toward the light, in world space. */
  readonly direction: LightVector
  /** Linear color times intensity. */
  readonly color: LightVector
}

/**
 * Where the Main Light starts, in the preview and in exported modules: the preview's key light
 * at [3, 4, 5], normalized, and white at the key light's intensity of 2.5.
 */
export const MAIN_LIGHT_DEFAULTS: MainLightDefaults = {
  direction: [0.424264, 0.565685, 0.707107],
  color: [2.5, 2.5, 2.5],
}
