import { float, vec3 } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * three.js's lava shader (threejs.org/examples/webgl_shader_lava.html) without its two textures:
 * a slow cloud noise swirls the surface, a pulse read through the swirl brightens and dims the
 * lava, and ridged noise stands in for the lava tile's glowing veins. The heat formula is the
 * original's, `color × pulse × 2 + color² − 0.1`, and red burning past 1 spills into the other
 * channels, so the hottest veins turn white. Every pattern reads Position, so the torus the original wears has
 * no UV seam to break it.
 */
export const MAGMA: ExampleSpec = {
  properties: [
    { name: 'flowSpeed', label: 'Flow speed', value: float(0.12) },
    { name: 'swirl', label: 'Swirl', value: float(1.2) },
    { name: 'veinScale', label: 'Vein scale', value: float(3) },
    { name: 'crustColor', label: 'Crust color', value: hexColor('#1A0503'), widget: 'color' },
    { name: 'lavaColor', label: 'Lava color', value: hexColor('#FF7A1F'), widget: 'color' },
  ],
  groups: [
    {
      id: 'clouds',
      title: 'Clouds',
      es: {
        title: 'Nubes',
        body: 'Un noise lento que se desliza con Time: el original lo lee de una textura de nubes. Todo lo demás se deforma con él.',
      },
      body:
        'A slow noise sliding with Time: the original reads it from a cloud texture. ' +
        'Everything else bends with it.',
      nodes: [
        node('position', 'input/position'),
        node('time', 'input/time'),
        reader('flowSpeed', 'flowSpeed'),
        node('drift', 'math/multiply'),
        node('drifting', 'math/add'),
        node('clouds', 'effects/noise', { scale: float(1.4) }, { kind: 'simplex' }),
      ],
    },
    {
      id: 'pulse',
      title: 'Pulse',
      es: {
        title: 'Pulso',
        body: 'Position más nubes × swirl: un remolino fuerte. Otro noise leído a través de él da el pulso que aviva y apaga la lava.',
      },
      body:
        'Position plus clouds × swirl: a strong swirl. Another noise read through it gives the ' +
        'pulse that stokes and dims the lava.',
      nodes: [
        reader('swirl', 'swirl'),
        node('swirlOffset', 'math/multiply'),
        node('swirled', 'math/add'),
        node('pulseNoise', 'effects/noise', { scale: float(2) }, { kind: 'simplex' }),
        node('pulse', 'math/remap', { inMin: float(-1), inMax: float(1) }),
      ],
    },
    {
      id: 'veins',
      title: 'Veins',
      es: {
        title: 'Venas',
        body: 'Las nubes empujan apenas a la posición que se desliza. 1 − |noise| es 1 sobre los cruces por cero: venas finas, más finas con Power. Pintan de costra a lava.',
      },
      body:
        'The clouds nudge the drifting position a little. 1 − |noise| is 1 along its zero crossings: thin ' +
        'veins, thinner through Power. They paint from crust to lava.',
      nodes: [
        node('nudge', 'math/multiply', { b: float(0.2) }),
        node('nudged', 'math/subtract'),
        reader('veinScale', 'veinScale'),
        node('veinNoise', 'effects/noise', {}, { kind: 'simplex' }),
        node('veinDistance', 'math/abs'),
        node('vein', 'math/one-minus'),
        node('veinSharp', 'math/power', { b: float(4) }),
        reader('crust', 'crustColor'),
        reader('lava', 'lavaColor'),
        node('veinColor', 'interpolation/lerp'),
      ],
    },
    {
      id: 'heat',
      title: 'Heat',
      es: {
        title: 'Calor',
        body: 'La fórmula del original: color × pulso × 2 + color² − 0.1. Puede pasar de 1: el paso siguiente usa ese exceso.',
      },
      body:
        "The original's formula: color × pulse × 2 + color² − 0.1. It can pass 1: the next " +
        'step uses what is over.',
      nodes: [
        node('pulseTwice', 'math/multiply', { b: float(2) }),
        node('stoked', 'math/multiply'),
        node('colorSquared', 'math/multiply'),
        node('heatSum', 'math/add'),
        node('heat', 'math/subtract', { b: float(0.1) }),
      ],
    },
    {
      id: 'white-hot',
      title: 'White-hot',
      es: {
        title: 'Al rojo blanco',
        body: 'Como en el original, lo que el rojo pasa de 1 se derrama sobre todo al verde: las venas más calientes viran a amarillo y después a blanco.',
      },
      body:
        'As in the original, whatever red has past 1 spills over, mostly into green: the ' +
        'hottest veins turn yellow, then white.',
      nodes: [
        node('heatChannels', 'vector/split'),
        node('redOver', 'math/subtract', { b: float(1) }),
        node('spill', 'math/max', { b: float(0) }),
        node('spillTint', 'math/multiply', { b: vec3(0.2, 0.75, 0.3) }),
        node('burning', 'math/add'),
      ],
    },
  ],
  wires: [
    ['time.out', 'drift.a'],
    ['flowSpeed.out', 'drift.b'],
    ['position.out', 'drifting.a'],
    ['drift.out', 'drifting.b'],
    ['drifting.out', 'clouds.p'],
    ['clouds.out', 'swirlOffset.a'],
    ['swirl.out', 'swirlOffset.b'],
    ['drifting.out', 'swirled.a'],
    ['swirlOffset.out', 'swirled.b'],
    ['swirled.out', 'pulseNoise.p'],
    ['pulseNoise.out', 'pulse.in'],
    ['clouds.out', 'nudge.a'],
    ['drifting.out', 'nudged.a'],
    ['nudge.out', 'nudged.b'],
    ['nudged.out', 'veinNoise.p'],
    ['veinScale.out', 'veinNoise.scale'],
    ['veinNoise.out', 'veinDistance.in'],
    ['veinDistance.out', 'vein.in'],
    ['vein.out', 'veinSharp.a'],
    ['crust.out', 'veinColor.a'],
    ['lava.out', 'veinColor.b'],
    ['veinSharp.out', 'veinColor.t'],
    ['pulse.out', 'pulseTwice.a'],
    ['veinColor.out', 'stoked.a'],
    ['pulseTwice.out', 'stoked.b'],
    ['veinColor.out', 'colorSquared.a'],
    ['veinColor.out', 'colorSquared.b'],
    ['stoked.out', 'heatSum.a'],
    ['colorSquared.out', 'heatSum.b'],
    ['heatSum.out', 'heat.a'],
    ['heat.out', 'heatChannels.in'],
    ['heatChannels.x', 'redOver.a'],
    ['redOver.out', 'spill.a'],
    ['heat.out', 'burning.a'],
    ['spill.out', 'spillTint.a'],
    ['spillTint.out', 'burning.b'],
    ['burning.out', 'master.baseColor'],
  ],
  master: { params: { lighting: 'unlit' } },
}
