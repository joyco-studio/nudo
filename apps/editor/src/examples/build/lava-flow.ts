import { float, vec3 } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/** How many crust plates fit across a unit of the mesh: a handful on the preview's shapes. */
const PLATE_SCALE = 2.2
/** Which way the crust drifts, per second at a flow speed of 1. */
const DRIFT = vec3(0.15, 0.05, 0.1)
/** How far the slow noise bends the plates out of straight Voronoi edges. */
const WARP = 0.35
/** Seam width at the middle crust coverage: coverage 0 doubles it, coverage 1 nearly closes it. */
const COVERAGE_WIDE = 1.6
const COVERAGE_NARROW = 0.4
/** The hot rim along a seam reaches this many seam widths into the crust. */
const RIM_REACH = 3
/** How strongly the rim glows compared with the seam itself. */
const RIM_HEAT = 0.22
/** The coolest the melt shows, in kelvin: a dull red at the edge of a seam. */
const COOLEST_KELVIN = 850
/**
 * Embers: a fine Voronoi of the drifting crust, one cell in ten lit near a seam. Each is a soft
 * round speck around its cell's feature point, this wide (as Voronoi's squared F1), glowing an
 * orange-yellow just bright enough for the tone mapping to keep its color instead of whitening it.
 */
const EMBER_DENSITY = 12
const EMBER_CHANCE = 0.85
const EMBER_RADIUS = 0.03
const EMBER_KELVIN = 1900
const EMBER_GLOW = 3
/** Fine crust detail for the normal, and when it starts to shimmer (one pixel's change). */
const DETAIL_SCALE = 7
const DETAIL_FADE_FROM = 0.15
const DETAIL_FADE_TO = 0.5
/**
 * The crust is matte; the melt is satin under a thin, soft coat with dimmed reflections, so the
 * key light and the studio never smear a white streak along a seam.
 */
const CRUST_ROUGHNESS = 0.88
const MELT_ROUGHNESS = 0.55
const MELT_COAT = 0.25
const MELT_COAT_ROUGHNESS = 0.4
const MELT_SPECULAR = 0.3
/** How far the seams sink below the crust, in object units. */
const SEAM_DEPTH = 0.035

/**
 * An original lava field, built to read well under ACES tone mapping and the studio environment.
 * Dark basalt crust breaks into drifting plates (a domain-warped Voronoi 3D); the seams between
 * them are molten, their heat travelling along them in slow pulses. Heat sets a temperature that
 * the Blackbody node turns into an HDR glow; the crust near a seam is hotter and redder, and away
 * from it cools to grey-brown with an oxide tint. The melt is satin under a thin coat, the crust
 * rough and occluded in its cracks; plates stand proud of sunken seams (vertex displacement), fine
 * crust relief comes from Normal From Height, and Derivatives fades that relief where it would
 * shimmer. Sparse round embers, anti-aliased with Derivatives, glint along the cracks. Inspired by
 * three.js's lava shader and vgpu.sh's lava material, without following either.
 */
export const LAVA_FLOW: ExampleSpec = {
  properties: [
    { name: 'temperature', label: 'Temperature', value: float(1600) },
    { name: 'crustCoverage', label: 'Crust coverage', value: float(0.55) },
    { name: 'flowSpeed', label: 'Flow speed', value: float(0.12) },
    { name: 'crackWidth', label: 'Crack width', value: float(0.14) },
    { name: 'glowIntensity', label: 'Glow intensity', value: float(6) },
    { name: 'crustColor', label: 'Crust color', value: hexColor('#2F2925'), widget: 'color' },
  ],
  groups: [
    {
      id: 'flow',
      title: 'Drifting crust',
      body:
        'The object position × plate scale, slid by Time × flow speed so the crust drifts, then ' +
        'bent by a slow noise so the plates never look like straight cells.',
      es: {
        title: 'Costra a la deriva',
        body: 'La posición del objeto × la escala de placas, deslizada por Time × flow speed para que la costra derive, y doblada por un noise lento para que las placas nunca parezcan celdas rectas.',
      },
      nodes: [
        node('position', 'input/position'),
        node('plateSpace', 'math/multiply', { b: float(PLATE_SCALE) }),
        node('time', 'input/time'),
        reader('flowSpeed', 'flowSpeed'),
        node('clock', 'math/multiply'),
        node('drift', 'math/multiply', { b: DRIFT }),
        node('drifted', 'math/add'),
        node('warpNoise', 'effects/noise', { scale: float(0.6) }, { octaves: 2 }),
        node('warpPush', 'math/multiply', { b: float(WARP) }),
        node('warped', 'math/add'),
      ],
    },
    {
      id: 'plates',
      title: 'Plates and seams',
      body:
        'Voronoi 3D splits the crust into plates; Edge is small along their borders. Crack width ' +
        '× crust coverage sets how wide the molten seam is; three times that is the hot rim the ' +
        'seam bakes into the crust.',
      es: {
        title: 'Placas y grietas',
        body: 'Voronoi 3D parte la costra en placas; Edge es chico sobre sus bordes. Crack width × crust coverage define qué tan ancha es la grieta fundida; tres veces eso es el borde caliente que la grieta cocina en la costra.',
      },
      nodes: [
        node('plates', 'effects/voronoi-3d', { scale: float(1), jitter: float(0.9) }),
        reader('crustCoverage', 'crustCoverage'),
        node('coverageWidth', 'math/remap', {
          outMin: float(COVERAGE_WIDE),
          outMax: float(COVERAGE_NARROW),
        }),
        reader('crackWidth', 'crackWidth'),
        node('seamWidth', 'math/multiply'),
        node('seamFade', 'interpolation/smoothstep'),
        node('seam', 'math/one-minus'),
        node('rimWidth', 'math/multiply', { b: float(RIM_REACH) }),
        node('rimFade', 'interpolation/smoothstep'),
        node('rim', 'math/one-minus'),
      ],
    },
    {
      id: 'heat',
      title: 'Travelling heat',
      body:
        'A sine of Time plus a noise phase sends pulses of heat along the seams. The seam carries ' +
        'the pulse; the rim keeps a third of it. The hotter of the two is the heat, 0 to 1.',
      es: {
        title: 'Calor que viaja',
        body: 'Un seno de Time más una fase de noise manda pulsos de calor por las grietas. La grieta lleva el pulso; el borde se queda con un tercio. El más caliente de los dos es el calor, de 0 a 1.',
      },
      nodes: [
        node('pulseNoise', 'effects/noise', { scale: float(1.3) }, { octaves: 2 }),
        node('pulseOffset', 'math/multiply', { b: float(6) }),
        node('pulseClock', 'math/multiply', { b: float(25) }),
        node('pulsePhase', 'math/add'),
        node('pulseWave', 'math/sin'),
        node('pulse', 'math/remap', {
          inMin: float(-1),
          inMax: float(1),
          outMin: float(0.55),
          outMax: float(1),
        }),
        node('seamHeat', 'math/multiply'),
        node('rimHeat', 'math/multiply', { b: float(RIM_HEAT) }),
        node('heat', 'math/max'),
      ],
    },
    {
      id: 'glow',
      title: 'Blackbody glow',
      body:
        'The heat picks a temperature between a dull 850 K and Temperature; Blackbody turns it ' +
        'into the color of glowing rock. Heat² × glow intensity makes it HDR, well past 1, so ' +
        'the tone mapping rolls the hottest seams off into yellow-white.',
      es: {
        title: 'Brillo de cuerpo negro',
        body: 'El calor elige una temperatura entre unos apagados 850 K y Temperature; Blackbody la convierte en el color de la roca incandescente. Calor² × glow intensity la vuelve HDR, bien por encima de 1, así el tone mapping lleva las grietas más calientes a un blanco amarillento.',
      },
      nodes: [
        reader('temperature', 'temperature'),
        node('kelvin', 'interpolation/lerp', { a: float(COOLEST_KELVIN) }),
        node('glowColor', 'color/blackbody'),
        node('heatSquared', 'math/multiply'),
        reader('glowIntensity', 'glowIntensity'),
        node('glowStrength', 'math/multiply'),
        node('glow', 'math/multiply'),
      ],
    },
    {
      id: 'embers',
      title: 'Embers',
      body:
        'A fine Voronoi 3D of the drifting crust; its Random lights one cell in ten. F1 draws a ' +
        'soft round speck around each lit point, and Derivatives widens its edge by one pixel ' +
        '(Fwidth) so small specks never alias. Only those along a seam show, flickering with Time.',
      es: {
        title: 'Brasas',
        body: 'Un Voronoi 3D fino de la costra a la deriva; su Random enciende una celda de cada diez. F1 dibuja una mota redonda y suave alrededor de cada punto encendido, y Derivatives ensancha su borde un píxel (Fwidth) para que las motas chicas nunca se serruchen. Solo se ven las que están junto a una grieta, titilando con Time.',
      },
      nodes: [
        node('emberCells', 'effects/voronoi-3d', {
          scale: float(EMBER_DENSITY),
          jitter: float(0.8),
        }),
        node('emberLit', 'interpolation/step', { edge: float(EMBER_CHANCE) }),
        node('emberPixel', 'math/derivatives'),
        node('emberEdge', 'math/add', { b: float(EMBER_RADIUS) }),
        node('emberFade', 'interpolation/smoothstep'),
        node('emberSpeck', 'math/one-minus'),
        node('emberFlickerPhase', 'math/multiply', { b: float(40) }),
        node('emberFlickerClock', 'math/multiply', { b: float(90) }),
        node('emberFlickerSum', 'math/add'),
        node('emberFlickerWave', 'math/sin'),
        node('emberFlicker', 'math/remap', {
          inMin: float(-1),
          inMax: float(1),
          outMin: float(0.3),
        }),
        node('emberNearSeam', 'math/multiply'),
        node('emberLitSpeck', 'math/multiply'),
        node('ember', 'math/multiply'),
        node('emberColor', 'color/blackbody', { temperature: float(EMBER_KELVIN) }),
        node('emberStrength', 'math/multiply', { b: float(EMBER_GLOW) }),
        node('emberGlow', 'math/multiply'),
        node('emission', 'math/add'),
      ],
    },
    {
      id: 'crust',
      title: 'Crust',
      body:
        "Crust color, a little lighter or darker per plate (Voronoi's Random), rusted in patches " +
        'by an oxide tint, reddened by the rim, and nearly black inside the seam where only the ' +
        'glow shows.',
      es: {
        title: 'Costra',
        body: 'Crust color, un poco más claro u oscuro en cada placa (el Random de Voronoi), oxidado a manchas por un tinte de óxido, enrojecido por el borde y casi negro dentro de la grieta, donde solo se ve el brillo.',
      },
      nodes: [
        reader('crustColor', 'crustColor'),
        node('plateShade', 'math/remap', { outMin: float(0.7), outMax: float(1.2) }),
        node('shadedCrust', 'math/multiply'),
        node('oxideNoise', 'effects/noise', { scale: float(3) }, { octaves: 3 }),
        node('oxide', 'interpolation/smoothstep', { edge0: float(0.1), edge1: float(0.6) }),
        node('oxideAmount', 'math/multiply', { b: float(0.5) }),
        node('oxidized', 'interpolation/lerp', { b: hexColor('#5B3A27') }),
        node('rimTint', 'math/multiply', { b: float(0.55) }),
        node('baked', 'interpolation/lerp', { b: hexColor('#5A1606') }),
        node('crustOrMelt', 'interpolation/lerp', { b: hexColor('#140805') }),
      ],
    },
    {
      id: 'surface',
      title: 'Gloss, coat and occlusion',
      body:
        'Rough, matte crust; a satin melt under a thin, soft clear coat, its Specular Intensity ' +
        'turned down so the glow, not a reflection, lights the seam; Ambient Occlusion darkens ' +
        'the crust along the rim, where it folds down into the seam.',
      es: {
        title: 'Brillo, laca y oclusión',
        body: 'Costra rugosa y mate; un fundido satinado bajo una laca transparente fina y suave, con la Specular Intensity baja para que la grieta la ilumine el brillo y no un reflejo; Ambient Occlusion oscurece la costra sobre el borde, donde se pliega hacia la grieta.',
      },
      nodes: [
        node('roughness', 'interpolation/lerp', {
          a: float(CRUST_ROUGHNESS),
          b: float(MELT_ROUGHNESS),
        }),
        node('coat', 'math/multiply', { b: float(MELT_COAT) }),
        node('specular', 'interpolation/lerp', { a: float(1), b: float(MELT_SPECULAR) }),
        node('occlusion', 'math/remap', { outMin: float(1), outMax: float(0.55) }),
      ],
    },
    {
      id: 'relief',
      title: 'Relief',
      body:
        "The seams sink: the position moves in along the mesh's own (object) normal by the seam × " +
        'depth. A fine noise ' +
        'gives the crust its grain through Normal From Height; Derivatives measures how much that ' +
        'noise changes per pixel and fades it out before it shimmers.',
      es: {
        title: 'Relieve',
        body: 'Las grietas se hunden: la posición se mueve hacia adentro sobre la normal propia de la malla (objeto) según la grieta × la profundidad. Un noise fino le da grano a la costra con Normal From Height; Derivatives mide cuánto cambia ese noise por píxel y lo apaga antes de que titile.',
      },
      nodes: [
        node('normal', 'input/normal', {}, { space: 'object' }),
        node('sink', 'math/multiply', { b: float(-SEAM_DEPTH) }),
        node('sunk', 'math/multiply'),
        node('displaced', 'math/add'),
        node('detailNoise', 'effects/noise', { scale: float(DETAIL_SCALE) }, { octaves: 3 }),
        node('detailChange', 'math/derivatives'),
        node('detailFade', 'interpolation/smoothstep', {
          edge0: float(DETAIL_FADE_FROM),
          edge1: float(DETAIL_FADE_TO),
        }),
        node('detailKeep', 'math/one-minus'),
        node('crustOnly', 'math/one-minus'),
        node('detailMask', 'math/multiply'),
        node('detailHeight', 'math/multiply'),
        node('crustNormal', 'normal/normal-from-height', { strength: float(0.35) }),
      ],
    },
  ],
  wires: [
    // Drifting crust.
    ['position.out', 'plateSpace.a'],
    ['time.out', 'clock.a'],
    ['flowSpeed.out', 'clock.b'],
    ['clock.out', 'drift.a'],
    ['plateSpace.out', 'drifted.a'],
    ['drift.out', 'drifted.b'],
    ['drifted.out', 'warpNoise.p'],
    ['warpNoise.out', 'warpPush.a'],
    ['drifted.out', 'warped.a'],
    ['warpPush.out', 'warped.b'],
    // Plates and seams.
    ['warped.out', 'plates.position'],
    ['crustCoverage.out', 'coverageWidth.in'],
    ['crackWidth.out', 'seamWidth.a'],
    ['coverageWidth.out', 'seamWidth.b'],
    ['seamWidth.out', 'seamFade.edge1'],
    ['plates.edge', 'seamFade.in'],
    ['seamFade.out', 'seam.in'],
    ['seamWidth.out', 'rimWidth.a'],
    ['rimWidth.out', 'rimFade.edge1'],
    ['plates.edge', 'rimFade.in'],
    ['rimFade.out', 'rim.in'],
    // Travelling heat.
    ['warped.out', 'pulseNoise.p'],
    ['pulseNoise.out', 'pulseOffset.a'],
    ['clock.out', 'pulseClock.a'],
    ['pulseOffset.out', 'pulsePhase.a'],
    ['pulseClock.out', 'pulsePhase.b'],
    ['pulsePhase.out', 'pulseWave.in'],
    ['pulseWave.out', 'pulse.in'],
    ['seam.out', 'seamHeat.a'],
    ['pulse.out', 'seamHeat.b'],
    ['rim.out', 'rimHeat.a'],
    ['seamHeat.out', 'heat.a'],
    ['rimHeat.out', 'heat.b'],
    // Blackbody glow.
    ['temperature.out', 'kelvin.b'],
    ['heat.out', 'kelvin.t'],
    ['kelvin.out', 'glowColor.temperature'],
    ['heat.out', 'heatSquared.a'],
    ['heat.out', 'heatSquared.b'],
    ['heatSquared.out', 'glowStrength.a'],
    ['glowIntensity.out', 'glowStrength.b'],
    ['glowColor.color', 'glow.a'],
    ['glowStrength.out', 'glow.b'],
    // Embers.
    ['warped.out', 'emberCells.position'],
    ['emberCells.random', 'emberLit.in'],
    ['emberCells.f1', 'emberPixel.in'],
    ['emberPixel.fwidth', 'emberEdge.a'],
    ['emberEdge.out', 'emberFade.edge1'],
    ['emberCells.f1', 'emberFade.in'],
    ['emberFade.out', 'emberSpeck.in'],
    ['emberCells.random', 'emberFlickerPhase.a'],
    ['clock.out', 'emberFlickerClock.a'],
    ['emberFlickerPhase.out', 'emberFlickerSum.a'],
    ['emberFlickerClock.out', 'emberFlickerSum.b'],
    ['emberFlickerSum.out', 'emberFlickerWave.in'],
    ['emberFlickerWave.out', 'emberFlicker.in'],
    ['emberLit.out', 'emberNearSeam.a'],
    ['rim.out', 'emberNearSeam.b'],
    ['emberNearSeam.out', 'emberLitSpeck.a'],
    ['emberSpeck.out', 'emberLitSpeck.b'],
    ['emberLitSpeck.out', 'ember.a'],
    ['emberFlicker.out', 'ember.b'],
    ['ember.out', 'emberStrength.a'],
    ['emberColor.color', 'emberGlow.a'],
    ['emberStrength.out', 'emberGlow.b'],
    ['glow.out', 'emission.a'],
    ['emberGlow.out', 'emission.b'],
    // Crust.
    ['plates.random', 'plateShade.in'],
    ['crustColor.out', 'shadedCrust.a'],
    ['plateShade.out', 'shadedCrust.b'],
    ['warped.out', 'oxideNoise.p'],
    ['oxideNoise.out', 'oxide.in'],
    ['oxide.out', 'oxideAmount.a'],
    ['shadedCrust.out', 'oxidized.a'],
    ['oxideAmount.out', 'oxidized.t'],
    ['rim.out', 'rimTint.a'],
    ['oxidized.out', 'baked.a'],
    ['rimTint.out', 'baked.t'],
    ['baked.out', 'crustOrMelt.a'],
    ['seam.out', 'crustOrMelt.t'],
    // Gloss, coat and occlusion.
    ['seam.out', 'roughness.t'],
    ['seam.out', 'coat.a'],
    ['seam.out', 'specular.t'],
    ['rim.out', 'occlusion.in'],
    // Relief.
    ['seam.out', 'sink.a'],
    ['normal.out', 'sunk.a'],
    ['sink.out', 'sunk.b'],
    ['position.out', 'displaced.a'],
    ['sunk.out', 'displaced.b'],
    ['warped.out', 'detailNoise.p'],
    ['detailNoise.out', 'detailChange.in'],
    ['detailChange.fwidth', 'detailFade.in'],
    ['detailFade.out', 'detailKeep.in'],
    ['seam.out', 'crustOnly.in'],
    ['detailKeep.out', 'detailMask.a'],
    ['crustOnly.out', 'detailMask.b'],
    ['detailNoise.out', 'detailHeight.a'],
    ['detailMask.out', 'detailHeight.b'],
    ['detailHeight.out', 'crustNormal.height'],
    // Master.
    ['displaced.out', 'master.position'],
    ['crustOrMelt.out', 'master.baseColor'],
    ['emission.out', 'master.emission'],
    ['roughness.out', 'master.roughness'],
    ['crustNormal.out', 'master.normal'],
    ['occlusion.out', 'master.ambientOcclusion'],
    ['coat.out', 'master.clearcoat'],
    ['specular.out', 'master.specularIntensity'],
  ],
  master: {
    inputs: { metalness: float(0), clearcoatRoughness: float(MELT_COAT_ROUGHNESS) },
    params: { lighting: 'physical', useClearcoat: true },
  },
}
