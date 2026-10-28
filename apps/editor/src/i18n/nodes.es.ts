import type { NodeTranslations, ParamTexts } from './node-texts'

/*
 * Spanish node texts. Shader terms that Spanish-speaking artists use as they are (Lerp, Fresnel,
 * Smoothstep, Fract, Clamp, UV, Voronoi, Float, the vec types) keep their English names; plain
 * words (Add, Time, Position) are translated. Single-letter ports (A, B, T, X…) stay as they are.
 */

const IN = { in: 'Entrada' }
const OUT = { out: 'Salida' }
const A_B = { a: 'A', b: 'B' }

/** The universal params every node accepts (see `UNIVERSAL_PARAMS` in core). */
export const UNIVERSAL_PARAMS_ES: Readonly<Record<string, ParamTexts>> = {
  collapsed: { label: 'Contraído' },
  previewMode: {
    label: 'Modo de vista previa',
    options: { auto: 'Automático', '2d': '2D', '3d': '3D' },
  },
}

export const NODES_ES: NodeTranslations = {
  'master/stack': {
    label: 'Master',
    description: 'La salida final de la superficie, donde termina todo grafo de shader.',
    keywords: ['salida', 'material', 'superficie', 'maestro'],
    inputs: {
      position: 'Posición',
      baseColor: 'Color base',
      emission: 'Emisión',
      metalness: 'Metalicidad',
      roughness: 'Rugosidad',
      normal: 'Normal',
      opacity: 'Opacidad',
      alphaClip: 'Umbral de recorte alfa',
    },
    params: {
      lighting: {
        label: 'Iluminación',
        options: { standard: 'Estándar', unlit: 'Sin iluminación' },
      },
      surface: {
        label: 'Superficie',
        options: { auto: 'Automática', opaque: 'Opaca', transparent: 'Transparente' },
      },
      twoSided: { label: 'Doble cara' },
    },
  },

  // Input
  'input/float': {
    label: 'Float',
    description: 'Un número constante que se puede editar y conectar a otros nodos.',
    keywords: ['número', 'escalar', 'constante', 'valor'],
    inputs: { x: 'X' },
    outputs: OUT,
  },
  'input/color': {
    label: 'Color',
    description: 'Un color RGB constante, elegido con una muestra de color.',
    keywords: ['color', 'rgb', 'constante', 'muestra'],
    inputs: { color: 'Color' },
    outputs: OUT,
  },
  'input/time': {
    label: 'Tiempo',
    description: 'Segundos transcurridos desde que arrancó el shader, para animar valores.',
    keywords: ['tiempo', 'segundos', 'animar', 'reloj', 'delta'],
    outputs: {
      out: 'Salida',
      sineTime: 'Tiempo seno',
      cosineTime: 'Tiempo coseno',
      deltaTime: 'Tiempo delta',
    },
  },
  'input/uv': {
    label: 'UV',
    description: 'Coordenadas de textura de la superficie, de 0 a 1 a lo largo de la malla.',
    keywords: ['coordenadas', 'textura'],
    outputs: OUT,
  },
  'input/normal': {
    label: 'Normal',
    description: 'La dirección hacia la que mira la superficie, en espacio de mundo.',
    keywords: ['normal', 'superficie', 'dirección', 'mundo'],
    outputs: OUT,
  },
  'input/vector2': {
    label: 'Vector 2',
    description: 'Un vec2 constante que se puede editar y conectar a otros nodos.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: { value: 'Valor' },
    outputs: OUT,
  },
  'input/vector3': {
    label: 'Vector 3',
    description: 'Un vec3 constante que se puede editar y conectar a otros nodos.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: { value: 'Valor' },
    outputs: OUT,
  },
  'input/vector4': {
    label: 'Vector 4',
    description: 'Un vec4 constante que se puede editar y conectar a otros nodos.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: { value: 'Valor' },
    outputs: OUT,
  },
  'input/position': {
    label: 'Posición',
    description:
      'La posición del punto de la superficie, en espacio de objeto, de mundo o de vista.',
    keywords: ['posición', 'vértice', 'objeto', 'mundo', 'vista', 'espacio', 'coordenadas'],
    outputs: OUT,
    params: {
      space: { label: 'Espacio', options: { object: 'Objeto', world: 'Mundo', view: 'Vista' } },
    },
  },
  'input/view-direction': {
    label: 'Dirección de vista',
    description:
      'La dirección desde el punto de la superficie hacia la cámara, en espacio de vista.',
    keywords: ['vista', 'dirección', 'cámara', 'ojo', 'incidente'],
    outputs: OUT,
  },
  'input/screen-uv': {
    label: 'UV de pantalla',
    description: 'La posición del píxel en pantalla, de 0 a 1 a lo largo del viewport.',
    keywords: ['pantalla', 'viewport', 'píxel', 'coordenadas'],
    outputs: OUT,
  },
  'input/camera-position': {
    label: 'Posición de cámara',
    description: 'La posición de la cámara en espacio de mundo.',
    keywords: ['cámara', 'posición', 'ojo', 'mundo'],
    outputs: OUT,
  },

  // Math
  'math/add': {
    label: 'Sumar',
    description: 'Suma dos valores, componente a componente.',
    keywords: ['sumar', 'suma', 'más', '+'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/subtract': {
    label: 'Restar',
    description: 'Resta B de A, componente a componente.',
    keywords: ['restar', 'resta', 'menos', 'diferencia', '-'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/multiply': {
    label: 'Multiplicar',
    description: 'Multiplica dos valores, componente a componente.',
    keywords: ['multiplicar', 'producto', 'por', 'escalar', '*'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/divide': {
    label: 'Dividir',
    description: 'Divide A por B, componente a componente.',
    keywords: ['dividir', 'división', 'cociente', '/'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/power': {
    label: 'Potencia',
    description: 'Eleva A a la potencia B.',
    keywords: ['potencia', 'exponente', 'cuadrado', 'elevar'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/sin': {
    label: 'Seno',
    description: 'El seno de la entrada: una onda suave entre -1 y 1.',
    keywords: ['seno', 'onda', 'oscilar'],
    inputs: IN,
    outputs: OUT,
  },
  'math/cos': {
    label: 'Coseno',
    description: 'El coseno de la entrada: una onda suave entre -1 y 1 que empieza en 1.',
    keywords: ['coseno', 'onda', 'oscilar'],
    inputs: IN,
    outputs: OUT,
  },
  'math/abs': {
    label: 'Absoluto',
    description: 'Quita el signo de la entrada, así el resultado nunca es negativo.',
    keywords: ['absoluto', 'valor absoluto', 'magnitud', 'positivo'],
    inputs: IN,
    outputs: OUT,
  },
  'math/fract': {
    label: 'Fract',
    description:
      'Conserva solo la parte fraccionaria de la entrada, útil para patrones que se repiten.',
    keywords: ['fracción', 'fraccionaria', 'repetir', 'mosaico'],
    inputs: IN,
    outputs: OUT,
  },
  'math/floor': {
    label: 'Floor',
    description: 'Redondea la entrada hacia abajo, al número entero más cercano.',
    keywords: ['redondear', 'entero', 'piso', 'cuantizar'],
    inputs: IN,
    outputs: OUT,
  },
  'math/one-minus': {
    label: 'Uno menos',
    description: 'Calcula 1 menos la entrada, lo que invierte un valor de 0 a 1.',
    keywords: ['uno menos', 'invertir', 'inverso', 'complemento'],
    inputs: IN,
    outputs: OUT,
  },
  'math/exp': {
    label: 'Exponencial',
    description: 'Eleva e a la potencia de la entrada.',
    keywords: ['exponencial', 'e', 'caída'],
    inputs: IN,
    outputs: OUT,
  },
  'math/min': {
    label: 'Mínimo',
    description: 'Toma el menor de dos valores, componente a componente.',
    keywords: ['mínimo', 'menor', 'más bajo'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/max': {
    label: 'Máximo',
    description: 'Toma el mayor de dos valores, componente a componente.',
    keywords: ['máximo', 'mayor', 'más alto'],
    inputs: A_B,
    outputs: OUT,
  },
  'math/clamp': {
    label: 'Clamp',
    description: 'Limita la entrada para que quede entre un mínimo y un máximo.',
    keywords: ['limitar', 'acotar', 'saturar', 'rango'],
    inputs: { in: 'Entrada', min: 'Mín', max: 'Máx' },
    outputs: OUT,
  },
  'math/remap': {
    label: 'Remapear',
    description: 'Lleva la entrada de un rango de valores a otro.',
    keywords: ['remapear', 'mapear', 'rango', 'reescalar', 'normalizar'],
    inputs: {
      in: 'Entrada',
      inMin: 'Entrada mín',
      inMax: 'Entrada máx',
      outMin: 'Salida mín',
      outMax: 'Salida máx',
    },
    outputs: OUT,
  },
  'math/distance': {
    label: 'Distancia',
    description: 'Mide la distancia entre dos puntos.',
    keywords: ['distancia', 'longitud', 'separación', 'entre'],
    inputs: A_B,
    outputs: OUT,
  },

  // Interpolation
  'interpolation/lerp': {
    label: 'Lerp',
    description: 'Mezcla de A a B según el factor T, donde 0 es A y 1 es B.',
    keywords: ['mezclar', 'mezcla', 'interpolar', 'fundir'],
    inputs: { a: 'A', b: 'B', t: 'T' },
    outputs: OUT,
  },
  'interpolation/step': {
    label: 'Step',
    description: 'Devuelve 0 por debajo del borde y 1 en el borde o por encima: un umbral duro.',
    keywords: ['escalón', 'umbral', 'corte', 'máscara'],
    inputs: { edge: 'Borde', in: 'Entrada' },
    outputs: OUT,
  },
  'interpolation/smoothstep': {
    label: 'Smoothstep',
    description: 'Pasa de 0 a 1 entre dos bordes con una curva suave en forma de S.',
    keywords: ['suave', 'suavizar', 'umbral', 'caída'],
    inputs: { edge0: 'Borde 0', edge1: 'Borde 1', in: 'Entrada' },
    outputs: OUT,
  },
  'interpolation/aa-step': {
    label: 'AA Step',
    description:
      'Un step con antialiasing: mantiene el borde nítido pero lo suaviza en alrededor de un píxel.',
    keywords: ['antialiasing', 'escalón', 'borde', 'umbral'],
    inputs: { edge: 'Borde', in: 'Entrada' },
    outputs: OUT,
  },

  // Logic
  'logic/select': {
    label: 'Seleccionar',
    description: 'Elige uno de dos valores según cómo se compara A con B.',
    keywords: ['seleccionar', 'si', 'condición', 'comparar', 'rama'],
    inputs: { a: 'A', b: 'B', whenTrue: 'Si es verdadero', whenFalse: 'Si es falso' },
    outputs: OUT,
    params: { op: { label: 'Comparar' } },
  },

  // Vector
  'vector/split': {
    label: 'Separar',
    description: 'Separa un vector en sus componentes X, Y, Z y W.',
    keywords: ['separar', 'dividir', 'componentes', 'canales'],
    inputs: IN,
    outputs: { x: 'X', y: 'Y', z: 'Z', w: 'W' },
  },
  'vector/combine': {
    label: 'Combinar',
    description: 'Arma un vector de 2, 3 o 4 componentes a partir de valores X, Y, Z y W sueltos.',
    keywords: ['combinar', 'unir', 'juntar', 'componer', 'construir', 'vector'],
    inputs: { x: 'X', y: 'Y', z: 'Z', w: 'W' },
    outputs: { vec2: 'Vec2', vec3: 'Vec3', vec4: 'Vec4' },
  },
  'vector/dot': {
    label: 'Producto punto',
    description: 'El producto punto de dos vectores: mide cuánto apuntan hacia el mismo lado.',
    keywords: ['producto escalar', 'producto punto', 'ángulo', 'alineación'],
    inputs: A_B,
    outputs: OUT,
  },
  'vector/length': {
    label: 'Longitud',
    description: 'La longitud de un vector: su distancia al origen.',
    keywords: ['longitud', 'magnitud', 'tamaño', 'norma'],
    inputs: IN,
    outputs: OUT,
  },
  'vector/normalize': {
    label: 'Normalizar',
    description: 'Lleva un vector a longitud 1 sin cambiar su dirección.',
    keywords: ['normalizar', 'unitario', 'dirección'],
    inputs: IN,
    outputs: OUT,
  },
  'vector/rotate-2d': {
    label: 'Rotar 2D',
    description: 'Rota un punto 2D alrededor de un centro, según un ángulo en radianes.',
    keywords: ['rotar', 'rotación', 'girar', 'ángulo'],
    inputs: { in: 'Entrada', angle: 'Ángulo', center: 'Centro' },
    outputs: OUT,
  },

  // Properties (added from the Properties panel, named after their property)
  'property/float': {
    label: 'Propiedad float',
    description: 'Lee una propiedad float del panel Propiedades.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: OUT,
  },
  'property/vec2': {
    label: 'Propiedad vec2',
    description: 'Lee una propiedad vec2 del panel Propiedades.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: OUT,
  },
  'property/vec3': {
    label: 'Propiedad vec3',
    description: 'Lee una propiedad vec3 del panel Propiedades.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: OUT,
  },
  'property/vec4': {
    label: 'Propiedad vec4',
    description: 'Lee una propiedad vec4 del panel Propiedades.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: OUT,
  },
  'property/texture': {
    label: 'Propiedad de textura',
    description: 'Lee una propiedad de textura del panel Propiedades.',
    keywords: ['propiedad', 'parámetro', 'uniform', 'textura'],
    outputs: OUT,
  },

  // Effects
  'effects/fresnel': {
    label: 'Fresnel',
    description: 'Ilumina las superficies vistas en ángulo rasante; útil para luz de borde.',
    keywords: ['borde', 'contorno', 'brillo', 'luz de borde'],
    inputs: { normal: 'Normal', viewDir: 'Dir. de vista', power: 'Potencia' },
    outputs: OUT,
  },
  'effects/noise': {
    label: 'Ruido',
    description: 'Valores aleatorios suaves que varían en el espacio, con ruido Perlin o simplex.',
    keywords: ['ruido', 'aleatorio', 'nubes', 'procedural'],
    inputs: { p: 'P', scale: 'Escala' },
    outputs: OUT,
    params: { kind: { label: 'Tipo', options: { perlin: 'Perlin', simplex: 'Simplex' } } },
  },
  'effects/voronoi': {
    label: 'Voronoi',
    description:
      'Patrón celular: la distancia al centro de celda más cercano y al segundo más cercano.',
    keywords: ['celular', 'celdas', 'distancia', 'borde', 'procedural'],
    inputs: { uv: 'UV', scale: 'Escala', jitter: 'Dispersión' },
    outputs: { f1: 'F1', f2: 'F2', edge: 'Borde' },
  },
  'effects/checkerboard': {
    label: 'Damero',
    description: 'Cuadrados que alternan entre 0 y 1 a lo largo del UV.',
    keywords: ['damero', 'tablero', 'ajedrez', 'cuadros', 'grilla', 'patrón'],
    inputs: { uv: 'UV', scale: 'Escala' },
    outputs: OUT,
  },
  'effects/gradient': {
    label: 'Gradiente',
    description: 'Una rampa de 0 a 1 a lo largo de X, de Y o hacia afuera desde el centro del UV.',
    keywords: ['gradiente', 'degradé', 'rampa', 'lineal', 'radial', 'viñeta'],
    inputs: { uv: 'UV' },
    outputs: OUT,
    params: {
      mode: {
        label: 'Modo',
        options: { 'linear-x': 'Lineal X', 'linear-y': 'Lineal Y', radial: 'Radial' },
      },
    },
  },

  // Texture
  'texture/sample-texture-2d': {
    label: 'Muestrear textura 2D',
    description: 'Lee el color de una textura en un UV, con nivel de mip automático o elegido.',
    keywords: ['textura', 'muestrear', 'imagen', 'mapa'],
    inputs: { texture: 'Textura', uv: 'UV', level: 'Nivel' },
    outputs: { rgba: 'RGBA', rgb: 'RGB', a: 'A' },
    params: { mip: { label: 'Mip', options: { auto: 'Automático', level: 'Nivel' } } },
  },

  // Color
  'color/color-space': {
    label: 'Espacio de color',
    description: 'Convierte un color entre los espacios sRGB y lineal.',
    keywords: ['color', 'espacio', 'lineal', 'gamma', 'convertir'],
    inputs: IN,
    outputs: OUT,
    params: {
      direction: {
        label: 'Dirección',
        options: { 'srgb-to-linear': 'sRGB a lineal', 'linear-to-srgb': 'Lineal a sRGB' },
      },
    },
  },

  // Scene
  'scene/scene-color': {
    label: 'Color de escena',
    description: 'El color renderizado detrás de la superficie, para refracción y transparencias.',
    keywords: ['escena', 'color', 'pantalla', 'refracción', 'fondo', 'detrás'],
    inputs: { uv: 'UV', offset: 'Desplazamiento' },
    outputs: OUT,
  },
  'scene/depth-fade': {
    label: 'Fundido por profundidad',
    description: 'Pasa de 0 a 1 a medida que la escena detrás de la superficie se aleja.',
    keywords: ['profundidad', 'fundido', 'suave', 'intersección', 'orilla', 'espuma', 'borde'],
    inputs: { distance: 'Distancia' },
    outputs: OUT,
  },

  // Normal
  'normal/normal-from-height': {
    label: 'Normal desde altura',
    description:
      'Arma una normal en espacio de vista a partir de cómo cambia una altura sobre la superficie.',
    keywords: ['normal', 'altura', 'relieve', 'derivada', 'ondas'],
    inputs: { height: 'Altura', strength: 'Intensidad' },
    outputs: OUT,
  },

  // Utility
  'utility/comment': {
    label: 'Comentario',
    description: 'Una nota redimensionable en el lienzo. No afecta al shader.',
    keywords: ['comentario', 'nota', 'anotación', 'etiqueta', 'grupo', 'marco'],
  },
}
