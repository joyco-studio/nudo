import type { NodeTranslations, ParamTexts, PortTexts } from './node-texts'

/*
 * Spanish node texts. Shader terms that Spanish-speaking artists use as they are (Lerp, Fresnel,
 * Smoothstep, Fract, Clamp, UV, Voronoi, Float, the vec types) keep their English names; plain
 * words (Add, Time, Position) are translated. Single-letter ports (A, B, T, X…) stay as they are.
 * Formulas keep their function names (sin, clamp, lerp) and use the Spanish port names.
 */

const PROPERTY_OUT: Readonly<Record<string, PortTexts>> = {
  out: {
    label: 'Salida',
    description:
      'El valor actual de la propiedad; al cambiarlo en el panel Propiedades, la vista previa lo sigue al instante.',
  },
}

const VALUE_INPUT: Readonly<Record<string, PortTexts>> = {
  value: { label: 'Valor', description: 'El vector que sale del nodo.' },
}
const VALUE_OUTPUT: Readonly<Record<string, PortTexts>> = {
  out: { label: 'Salida', description: 'El vector fijado.' },
}

/** The distance param of both Voronoi nodes. */
const VORONOI_DISTANCE_ES: ParamTexts = {
  label: 'Distancia',
  options: { euclidean: 'Euclídea', manhattan: 'Manhattan', chebyshev: 'Chebyshev' },
}

const ANGLE_IN = 'El ángulo; una vuelta completa es unos 6,28. Con Tiempo conectado, se mueve.'

/** The universal params every node accepts (see `UNIVERSAL_PARAMS` in core). */
export const UNIVERSAL_PARAMS_ES: Readonly<Record<string, ParamTexts>> = {
  collapsed: { label: 'Contraído' },
  showPreview: { label: 'Mostrar vista previa' },
  previewMode: {
    label: 'Modo de vista previa',
    options: { auto: 'Automático', '2d': '2D', '3d': '3D' },
  },
}

export const NODES_ES: NodeTranslations = {
  'master/stack': {
    label: 'Master',
    description: 'El material terminado: lo que llega a estas entradas es lo que muestra la malla.',
    keywords: ['salida', 'material', 'superficie', 'maestro'],
    inputs: {
      position: {
        label: 'Posición',
        description:
          'Adónde va cada vértice, en espacio de objeto; vacía, la malla queda como está.',
      },
      baseColor: { label: 'Color base', description: 'El color de la superficie antes de la luz.' },
      emission: {
        label: 'Emisión',
        description:
          'La luz que la superficie emite por sí sola, incluso a oscuras; negro no suma nada.',
      },
      metalness: {
        label: 'Metalicidad',
        description: '0 = plástico, madera o piedra; 1 = metal desnudo.',
      },
      roughness: {
        label: 'Rugosidad',
        description: '0 = reflejos nítidos de espejo; 1 = totalmente mate.',
      },
      normal: {
        label: 'Normal',
        description:
          'Hacia dónde cree la iluminación que mira la superficie; Normal desde altura agrega relieve.',
      },
      opacity: {
        label: 'Opacidad',
        description: 'Qué tan sólida es la superficie: 0 = invisible, 1 = totalmente sólida.',
      },
      alphaClip: {
        label: 'Umbral de recorte alfa',
        description: 'Los píxeles con opacidad menor que este valor se recortan por completo.',
      },
      transmission: {
        label: 'Transmisión',
        description: 'Cuánta luz atraviesa la superficie, como el vidrio: 0 = nada, 1 = toda.',
      },
      ior: {
        label: 'IOR',
        description: 'Cuánto se desvía la luz al atravesarla: 1.5 es vidrio, 1.33 es agua.',
      },
      thickness: {
        label: 'Espesor',
        description:
          'Qué tan profundo es el volumen detrás de la superficie; más profundo desvía más la luz.',
      },
      clearcoat: {
        label: 'Barniz',
        description:
          'Una capa de barniz transparente sobre la superficie: 0 = nada, 1 = capa completa.',
      },
      clearcoatRoughness: {
        label: 'Rugosidad del barniz',
        description: '0 = barniz brillante, 1 = barniz esmerilado.',
      },
      sheen: {
        label: 'Brillo de tela',
        description:
          'El brillo suave que toman telas como el terciopelo en ángulos rasantes, como color; negro no suma nada.',
      },
      sheenRoughness: {
        label: 'Rugosidad del brillo de tela',
        description: 'Cuánto se abre el brillo: 0 = un borde fino, 1 = suave y amplio.',
      },
      iridescence: {
        label: 'Iridiscencia',
        description:
          'Colores de arcoíris como los de una burbuja de jabón o una mancha de aceite: 0 = nada, 1 = completa.',
      },
      iridescenceIOR: {
        label: 'IOR de iridiscencia',
        description: 'Cuánto desvía la luz la película fina, lo que corre sus colores de arcoíris.',
      },
      outlineWidth: {
        label: 'Grosor del contorno',
        description: 'Cuánto sobresale la línea de la superficie, en unidades de escena.',
      },
      outlineColor: {
        label: 'Color del contorno',
        description: 'El color plano de la línea; la luz nunca lo cambia.',
      },
      outlineWobble: {
        label: 'Vibración del contorno',
        description:
          'Cuánto engorda y adelgaza la línea con un ruido que se mueve, en unidades de escena: 0 = fija.',
      },
    },
    params: {
      lighting: {
        label: 'Iluminación',
        options: { standard: 'Estándar', unlit: 'Sin iluminación', physical: 'Física' },
      },
      surface: {
        label: 'Superficie',
        options: { auto: 'Automática', opaque: 'Opaca', transparent: 'Transparente' },
      },
      twoSided: { label: 'Doble cara' },
      outline: {
        label: 'Contorno',
        description:
          'Dibuja una línea plana alrededor de la silueta dibujando la malla una segunda vez. En una superficie transparente, la línea se ve a través.',
      },
      useTransmission: {
        label: 'Activar transmisión',
        description:
          'Deja pasar la luz a través de la superficie. Para hacerlo, three renderiza la escena de fondo una vez más.',
      },
      useClearcoat: { label: 'Activar barniz' },
      useSheen: { label: 'Activar brillo de tela' },
      useIridescence: { label: 'Activar iridiscencia' },
    },
  },

  // Input
  'input/float': {
    label: 'Float',
    description: 'Un número constante que se puede editar y conectar a otros nodos.',
    keywords: ['número', 'escalar', 'constante', 'valor'],
    inputs: { x: { label: 'X', description: 'El número que sale del nodo.' } },
    outputs: { out: { label: 'Salida', description: 'El número fijado.' } },
  },
  'input/color': {
    label: 'Color',
    description: 'Un color RGB constante, elegido con una muestra de color.',
    keywords: ['color', 'rgb', 'constante', 'muestra'],
    inputs: { color: { label: 'Color', description: 'El color que sale del nodo.' } },
    outputs: {
      out: { label: 'Salida', description: 'El color elegido, como rojo, verde y azul.' },
    },
  },
  'input/time': {
    label: 'Tiempo',
    description: 'Segundos transcurridos desde que comenzó el shader, para animar valores.',
    keywords: ['tiempo', 'segundos', 'animar', 'reloj', 'delta'],
    outputs: {
      out: {
        label: 'Salida',
        description: 'Segundos desde que comenzó el shader; no deja de crecer.',
      },
      sineTime: {
        label: 'Tiempo seno',
        description: 'El seno de Tiempo: una onda que va de -1 a 1.',
      },
      cosineTime: {
        label: 'Tiempo coseno',
        description: 'El coseno de Tiempo: la misma onda que Tiempo seno, pero empieza en 1.',
      },
      deltaTime: {
        label: 'Tiempo delta',
        description:
          'Segundos desde el cuadro anterior, para movimientos que no dependen de los FPS.',
      },
    },
  },
  'input/uv': {
    label: 'UV',
    description: 'Coordenadas de textura de la superficie, de 0 a 1 a lo largo de la malla.',
    keywords: ['coordenadas', 'textura'],
    outputs: {
      out: {
        label: 'Salida',
        description:
          'El UV de la superficie: x recorre la textura a lo ancho e y a lo alto, de 0 a 1.',
      },
    },
  },
  'input/normal': {
    label: 'Normal',
    description: 'La dirección hacia la que mira la superficie, en espacio de mundo.',
    keywords: ['normal', 'superficie', 'dirección', 'mundo'],
    outputs: {
      out: {
        label: 'Salida',
        description: 'La dirección de la superficie en espacio de mundo, con longitud 1.',
      },
    },
  },
  'input/vector2': {
    label: 'Vector 2',
    description:
      'Un vec2 fijo que se escribe a mano y se conecta a otros nodos, como un desplazamiento o una dirección.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: VALUE_INPUT,
    outputs: VALUE_OUTPUT,
  },
  'input/vector3': {
    label: 'Vector 3',
    description:
      'Un vec3 fijo que se escribe a mano y se conecta a otros nodos, como un desplazamiento o una dirección.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: VALUE_INPUT,
    outputs: VALUE_OUTPUT,
  },
  'input/vector4': {
    label: 'Vector 4',
    description:
      'Un vec4 fijo que se escribe a mano y se conecta a otros nodos, como un desplazamiento o una dirección.',
    keywords: ['vector', 'constante', 'valor'],
    inputs: VALUE_INPUT,
    outputs: VALUE_OUTPUT,
  },
  'input/position': {
    label: 'Posición',
    description:
      'La posición del punto de la superficie, en espacio de objeto, de mundo o de vista.',
    keywords: ['posición', 'vértice', 'objeto', 'mundo', 'vista', 'espacio', 'coordenadas'],
    outputs: {
      out: {
        label: 'Salida',
        description: 'Dónde está el punto de la superficie, en el espacio elegido en Espacio.',
      },
    },
    params: {
      space: { label: 'Espacio', options: { object: 'Objeto', world: 'Mundo', view: 'Vista' } },
    },
  },
  'input/view-direction': {
    label: 'Dirección de vista',
    description:
      'La dirección desde el punto de la superficie hacia la cámara, en espacio de vista.',
    keywords: ['vista', 'dirección', 'cámara', 'ojo', 'incidente'],
    outputs: {
      out: {
        label: 'Salida',
        description:
          'La dirección desde el punto de la superficie hacia la cámara, con longitud 1.',
      },
    },
  },
  'input/screen-uv': {
    label: 'UV de pantalla',
    description: 'La posición del píxel en pantalla, de 0 a 1 a lo largo del viewport.',
    keywords: ['pantalla', 'viewport', 'píxel', 'coordenadas'],
    outputs: {
      out: {
        label: 'Salida',
        description:
          'Dónde está el píxel en pantalla, de 0 a 1 a lo ancho y a lo alto de la vista.',
      },
    },
  },
  'input/camera-position': {
    label: 'Posición de cámara',
    description: 'Dónde está la cámara, en espacio de mundo.',
    keywords: ['cámara', 'posición', 'ojo', 'mundo'],
    outputs: {
      out: { label: 'Salida', description: 'La posición de la cámara en espacio de mundo.' },
    },
  },
  'input/main-light': {
    label: 'Luz principal',
    description:
      'La luz clave de la escena: su dirección y su color, más un sombreado Lambert y half-Lambert listo para iluminación propia y estilos toon.',
    keywords: ['luz', 'sol', 'direccional', 'lambert', 'difusa', 'sombreado', 'toon'],
    inputs: {
      normal: {
        label: 'Normal',
        description:
          'La normal de la superficie a sombrear, en espacio de mundo; la normal de mundo si no hay nada conectado.',
      },
    },
    outputs: {
      direction: {
        label: 'Dirección',
        description:
          'Dirección desde la superficie hacia la luz, en espacio de mundo, con longitud 1.',
      },
      color: { label: 'Color', description: 'El color de la luz multiplicado por su intensidad.' },
      lambert: {
        label: 'Lambert',
        description:
          'Cuánto mira la superficie hacia la luz: 1 de frente, 0 de canto o de espaldas.',
      },
      halfLambert: {
        label: 'Half Lambert',
        description:
          'Lambert comprimido entre 0 y 1 para que el lado oscuro conserve un degradado suave.',
      },
    },
  },

  'color/color-ramp': {
    label: 'Rampa de color',
    description:
      'Lleva un valor de 0 a 1 a un degradado de hasta ocho colores, cada uno con su propia posición.',
    formula: 'rampa(Entrada)',
    keywords: ['rampa', 'color', 'degradado', 'gradiente', 'paleta', 'paradas', 'mapa'],
    inputs: {
      in: {
        label: 'Entrada',
        description: 'El valor a buscar en la rampa: 0 es la primera parada, 1 la última.',
      },
      stop0Position: {
        label: 'Posición 1',
        description: 'Dónde queda la parada 1 a lo largo de la rampa, de 0 a 1.',
      },
      stop0Color: { label: 'Color 1', description: 'El color de la parada 1.' },
      stop1Position: {
        label: 'Posición 2',
        description: 'Dónde queda la parada 2 a lo largo de la rampa, de 0 a 1.',
      },
      stop1Color: { label: 'Color 2', description: 'El color de la parada 2.' },
      stop2Position: {
        label: 'Posición 3',
        description: 'Dónde queda la parada 3 a lo largo de la rampa, de 0 a 1.',
      },
      stop2Color: { label: 'Color 3', description: 'El color de la parada 3.' },
      stop3Position: {
        label: 'Posición 4',
        description: 'Dónde queda la parada 4 a lo largo de la rampa, de 0 a 1.',
      },
      stop3Color: { label: 'Color 4', description: 'El color de la parada 4.' },
      stop4Position: {
        label: 'Posición 5',
        description: 'Dónde queda la parada 5 a lo largo de la rampa, de 0 a 1.',
      },
      stop4Color: { label: 'Color 5', description: 'El color de la parada 5.' },
      stop5Position: {
        label: 'Posición 6',
        description: 'Dónde queda la parada 6 a lo largo de la rampa, de 0 a 1.',
      },
      stop5Color: { label: 'Color 6', description: 'El color de la parada 6.' },
      stop6Position: {
        label: 'Posición 7',
        description: 'Dónde queda la parada 7 a lo largo de la rampa, de 0 a 1.',
      },
      stop6Color: { label: 'Color 7', description: 'El color de la parada 7.' },
      stop7Position: {
        label: 'Posición 8',
        description: 'Dónde queda la parada 8 a lo largo de la rampa, de 0 a 1.',
      },
      stop7Color: { label: 'Color 8', description: 'El color de la parada 8.' },
    },
    outputs: { out: { label: 'Salida', description: 'El color de la rampa en la Entrada.' } },
    params: {
      interpolation: {
        label: 'Interpolación',
        options: { linear: 'Lineal', constant: 'Constante', smooth: 'Suave' },
      },
    },
  },

  // Math
  'math/add': {
    label: 'Sumar',
    description: 'Suma dos valores, componente a componente.',
    keywords: ['sumar', 'suma', 'más', '+'],
    inputs: {
      a: { label: 'A', description: 'El valor de partida.' },
      b: { label: 'B', description: 'Lo que se suma a A; un número negativo resta.' },
    },
    outputs: { out: { label: 'Salida', description: 'La suma de A y B.' } },
  },
  'math/subtract': {
    label: 'Restar',
    description: 'Resta B de A, componente a componente.',
    keywords: ['restar', 'resta', 'menos', 'diferencia', '-'],
    inputs: {
      a: { label: 'A', description: 'El valor del que se resta.' },
      b: { label: 'B', description: 'Lo que se le quita a A.' },
    },
    outputs: { out: { label: 'Salida', description: 'A menos B.' } },
  },
  'math/multiply': {
    label: 'Multiplicar',
    description:
      'Multiplica dos valores, componente a componente: sirve para escalar, teñir o enmascarar.',
    keywords: ['multiplicar', 'producto', 'por', 'escalar', '*'],
    inputs: {
      a: { label: 'A', description: 'El valor a escalar.' },
      b: {
        label: 'B',
        description: 'Por cuánto se escala A: 0 lo anula, 1 lo deja igual, 2 lo duplica.',
      },
    },
    outputs: { out: { label: 'Salida', description: 'A por B.' } },
  },
  'math/divide': {
    label: 'Dividir',
    description: 'Divide A por B, componente a componente.',
    keywords: ['dividir', 'división', 'cociente', '/'],
    inputs: {
      a: { label: 'A', description: 'El valor a dividir.' },
      b: { label: 'B', description: 'Por cuánto se divide A; conviene que no se acerque a 0.' },
    },
    outputs: { out: { label: 'Salida', description: 'A dividido por B.' } },
  },
  'math/power': {
    label: 'Potencia',
    description: 'Eleva A a la potencia B.',
    keywords: ['potencia', 'exponente', 'cuadrado', 'elevar'],
    inputs: {
      a: { label: 'A', description: 'El valor a elevar; conviene que sea 0 o más.' },
      b: {
        label: 'B',
        description:
          'El exponente: por encima de 1 oscurece un valor de 0 a 1, por debajo de 1 lo aclara.',
      },
    },
    outputs: { out: { label: 'Salida', description: 'A elevado a la potencia B.' } },
  },
  'math/sin': {
    label: 'Seno',
    description: 'El seno de la entrada: una onda suave entre -1 y 1.',
    formula: 'sin(Entrada)',
    keywords: ['seno', 'onda', 'oscilar'],
    inputs: { in: { label: 'Entrada', description: ANGLE_IN } },
    outputs: { out: { label: 'Salida', description: 'Una onda entre -1 y 1 que empieza en 0.' } },
  },
  'math/cos': {
    label: 'Coseno',
    description: 'El coseno de la entrada: una onda suave entre -1 y 1 que empieza en 1.',
    formula: 'cos(Entrada)',
    keywords: ['coseno', 'onda', 'oscilar'],
    inputs: { in: { label: 'Entrada', description: ANGLE_IN } },
    outputs: { out: { label: 'Salida', description: 'Una onda entre -1 y 1 que empieza en 1.' } },
  },
  'math/abs': {
    label: 'Absoluto',
    description: 'Quita el signo de la entrada, así el resultado nunca es negativo.',
    formula: 'abs(Entrada)',
    keywords: ['absoluto', 'valor absoluto', 'magnitud', 'positivo'],
    inputs: { in: { label: 'Entrada', description: 'El valor a volver positivo.' } },
    outputs: {
      out: { label: 'Salida', description: 'Entrada sin su signo: -0,3 pasa a 0,3.' },
    },
  },
  'math/fract': {
    label: 'Fract',
    description:
      'Conserva solo la parte fraccionaria de la entrada, útil para patrones que se repiten.',
    formula: 'Entrada − floor(Entrada)',
    keywords: ['fracción', 'fraccionaria', 'repetir', 'mosaico'],
    inputs: {
      in: {
        label: 'Entrada',
        description: 'El valor a envolver; multiplicar antes el UV repite un patrón.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'Lo que queda después de la coma, de 0 hasta casi 1.',
      },
    },
  },
  'math/floor': {
    label: 'Floor',
    description: 'Redondea la entrada hacia abajo, al número entero más cercano.',
    formula: 'floor(Entrada)',
    keywords: ['redondear', 'entero', 'piso', 'cuantizar'],
    inputs: { in: { label: 'Entrada', description: 'El valor a redondear hacia abajo.' } },
    outputs: {
      out: {
        label: 'Salida',
        description:
          'El entero más cercano igual o menor que Entrada: 2,7 pasa a 2 y -0,5 pasa a -1.',
      },
    },
  },
  'math/one-minus': {
    label: 'Uno menos',
    description: 'Calcula 1 menos la entrada, lo que invierte un valor de 0 a 1.',
    formula: '1 − Entrada',
    keywords: ['uno menos', 'invertir', 'inverso', 'complemento'],
    inputs: {
      in: { label: 'Entrada', description: 'El valor a invertir, por lo general entre 0 y 1.' },
    },
    outputs: {
      out: { label: 'Salida', description: '1 menos Entrada: 0 pasa a 1 y 1 pasa a 0.' },
    },
  },
  'math/exp': {
    label: 'Exponencial',
    description:
      'Eleva e (unos 2,718) a la potencia de la entrada, para curvas que crecen o caen rápido.',
    formula: 'exp(Entrada)',
    keywords: ['exponencial', 'e', 'caída'],
    inputs: {
      in: {
        label: 'Entrada',
        description: 'El exponente; los valores negativos caen suavemente hacia 0.',
      },
    },
    outputs: {
      out: { label: 'Salida', description: 'Siempre mayor que 0: e elevado a Entrada.' },
    },
  },
  'math/min': {
    label: 'Mínimo',
    description: 'Toma el menor de dos valores, componente a componente.',
    keywords: ['mínimo', 'menor', 'más bajo'],
    inputs: {
      a: { label: 'A', description: 'El valor a limitar.' },
      b: { label: 'B', description: 'El techo: el resultado nunca lo supera.' },
    },
    outputs: { out: { label: 'Salida', description: 'El menor entre A y B.' } },
  },
  'math/max': {
    label: 'Máximo',
    description: 'Toma el mayor de dos valores, componente a componente.',
    keywords: ['máximo', 'mayor', 'más alto'],
    inputs: {
      a: { label: 'A', description: 'El valor a limitar.' },
      b: { label: 'B', description: 'El piso: el resultado nunca baja de él.' },
    },
    outputs: { out: { label: 'Salida', description: 'El mayor entre A y B.' } },
  },
  'math/clamp': {
    label: 'Clamp',
    description: 'Limita la entrada para que quede entre un mínimo y un máximo.',
    formula: 'clamp(Entrada, Mín, Máx)',
    keywords: ['limitar', 'acotar', 'saturar', 'rango'],
    inputs: {
      in: { label: 'Entrada', description: 'El valor a limitar.' },
      min: { label: 'Mín', description: 'Lo más bajo que puede dar el resultado.' },
      max: { label: 'Máx', description: 'Lo más alto que puede dar el resultado.' },
    },
    outputs: { out: { label: 'Salida', description: 'Entrada, sostenida entre Mín y Máx.' } },
  },
  'math/remap': {
    label: 'Remapear',
    description: 'Lleva la entrada de un rango de valores a otro.',
    formula: '[Entrada mín–máx] → [Salida mín–máx]',
    keywords: ['remapear', 'mapear', 'rango', 'reescalar', 'normalizar'],
    inputs: {
      in: { label: 'Entrada', description: 'El valor a convertir.' },
      inMin: {
        label: 'Entrada mín',
        description: 'El valor de Entrada que cae en Salida mín.',
      },
      inMax: {
        label: 'Entrada máx',
        description: 'El valor de Entrada que cae en Salida máx.',
      },
      outMin: { label: 'Salida mín', description: 'Adónde va a parar Entrada mín.' },
      outMax: { label: 'Salida máx', description: 'Adónde va a parar Entrada máx.' },
    },
    outputs: {
      out: {
        label: 'Salida',
        description:
          'Entrada llevada al rango nuevo; lo que queda fuera del rango viejo cae fuera del nuevo.',
      },
    },
  },
  'math/distance': {
    label: 'Distancia',
    description: 'Mide qué tan lejos están dos puntos.',
    keywords: ['distancia', 'longitud', 'separación', 'entre'],
    inputs: {
      a: { label: 'A', description: 'El primer punto.' },
      b: { label: 'B', description: 'El segundo punto.' },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'La distancia en línea recta entre A y B; nunca es negativa.',
      },
    },
  },
  'math/posterize': {
    label: 'Posterizar',
    description: 'Ajusta la entrada a una cantidad fija de niveles planos, como un afiche impreso.',
    formula: 'floor(Entrada × Pasos) / Pasos',
    keywords: ['posterizar', 'cuantizar', 'pasos', 'bandas', 'niveles', 'toon'],
    inputs: {
      in: { label: 'Entrada', description: 'El valor a ajustar, por lo general entre 0 y 1.' },
      steps: {
        label: 'Pasos',
        description: 'A cuántos niveles se ajusta: 2 da dos bandas planas, 8 da ocho.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description:
          'Entrada redondeada hacia abajo al nivel más cercano, así el degradado queda en bandas.',
      },
    },
  },
  'math/modulo': {
    label: 'Módulo',
    description: 'El resto de dividir A por B; el resultado siempre tiene el signo de B.',
    keywords: ['módulo', 'mod', 'resto', 'envolver', 'repetir', '%'],
    inputs: {
      a: { label: 'A', description: 'El valor a envolver.' },
      b: {
        label: 'B',
        description: 'El largo de cada repetición; conviene que no se acerque a 0.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'A envuelto en el rango de 0 hasta B, igual en WebGPU y en WebGL.',
      },
    },
  },

  // Interpolation
  'interpolation/lerp': {
    label: 'Lerp',
    description: 'Mezcla de A a B según el factor T, donde 0 es A y 1 es B.',
    keywords: ['mezclar', 'mezcla', 'interpolar', 'fundir'],
    inputs: {
      a: { label: 'A', description: 'El resultado cuando T es 0.' },
      b: { label: 'B', description: 'El resultado cuando T es 1.' },
      t: {
        label: 'T',
        description: 'Cuánto de B: 0 = todo A, 1 = todo B, 0,5 = mitad y mitad.',
      },
    },
    outputs: { out: { label: 'Salida', description: 'La mezcla de A y B.' } },
  },
  'interpolation/step': {
    label: 'Step',
    description: 'Devuelve 0 por debajo del borde y 1 en el borde o por encima: un umbral duro.',
    formula: 'Entrada < Borde ? 0 : 1',
    keywords: ['escalón', 'umbral', 'corte', 'máscara'],
    inputs: {
      edge: {
        label: 'Borde',
        description: 'El umbral: los valores de Entrada por debajo dan 0.',
      },
      in: { label: 'Entrada', description: 'El valor que se compara con Borde.' },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: '0 donde Entrada está por debajo de Borde, 1 en todo lo demás.',
      },
    },
  },
  'interpolation/smoothstep': {
    label: 'Smoothstep',
    description: 'Pasa de 0 a 1 entre dos bordes con una curva suave en forma de S.',
    formula: 'smoothstep(Borde 0, Borde 1, Entrada)',
    keywords: ['suave', 'suavizar', 'umbral', 'caída'],
    inputs: {
      edge0: {
        label: 'Borde 0',
        description: 'Donde empieza la rampa: Entrada igual o menor da 0.',
      },
      edge1: {
        label: 'Borde 1',
        description: 'Donde termina la rampa: Entrada igual o mayor da 1.',
      },
      in: {
        label: 'Entrada',
        description: 'El valor a suavizar, muchas veces un gradiente o un ruido.',
      },
    },
    outputs: {
      out: { label: 'Salida', description: 'Una rampa suave de 0 a 1 entre los dos bordes.' },
    },
  },
  'interpolation/aa-step': {
    label: 'AA Step',
    description:
      'Un step con antialiasing: mantiene el borde nítido pero lo suaviza en alrededor de un píxel.',
    formula: 'Entrada < Borde ? 0 : 1, borde suave',
    keywords: ['antialiasing', 'escalón', 'borde', 'umbral'],
    inputs: {
      edge: {
        label: 'Borde',
        description: 'El umbral: los valores de Entrada por debajo dan 0.',
      },
      in: {
        label: 'Entrada',
        description: 'El valor a comparar; funcionan mejor las entradas suaves, como un gradiente.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: '0 por debajo de Borde y 1 por encima, con un borde suave de un píxel.',
      },
    },
  },

  // Logic
  'logic/select': {
    label: 'Seleccionar',
    description: 'Elige uno de dos valores según cómo se compara A con B.',
    formula: 'Comparar(A, B) ? Verdadero : Falso',
    keywords: ['seleccionar', 'si', 'condición', 'comparar', 'rama', 'lógica'],
    inputs: {
      a: { label: 'A', description: 'El número a comparar.' },
      b: { label: 'B', description: 'El número con el que se compara A.' },
      whenTrue: {
        label: 'Si es verdadero',
        description: 'El resultado cuando la comparación se cumple.',
      },
      whenFalse: { label: 'Si es falso', description: 'El resultado cuando no se cumple.' },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'Si es verdadero o Si es falso, según la comparación.',
      },
    },
    params: { op: { label: 'Comparar' } },
  },

  // Vector
  'vector/split': {
    label: 'Separar',
    description: 'Separa un vector en sus componentes X, Y, Z y W.',
    formula: 'Entrada → X, Y, Z, W',
    keywords: ['separar', 'dividir', 'componentes', 'canales'],
    inputs: { in: { label: 'Entrada', description: 'El vector a desarmar.' } },
    outputs: {
      x: { label: 'X', description: 'La primera componente: el rojo en un color.' },
      y: { label: 'Y', description: 'La segunda componente: el verde en un color.' },
      z: {
        label: 'Z',
        description: 'La tercera componente: el azul en un color; 0 si Entrada tiene solo dos.',
      },
      w: {
        label: 'W',
        description:
          'La cuarta componente: el alfa en un color; 0 si Entrada tiene menos de cuatro.',
      },
    },
  },
  'vector/combine': {
    label: 'Combinar',
    description: 'Arma un vector de 2, 3 o 4 componentes a partir de valores X, Y, Z y W sueltos.',
    keywords: ['combinar', 'unir', 'juntar', 'componer', 'construir', 'vector'],
    inputs: {
      x: { label: 'X', description: 'La primera componente: el rojo en un color.' },
      y: { label: 'Y', description: 'La segunda componente: el verde en un color.' },
      z: {
        label: 'Z',
        description: 'La tercera componente: el azul en un color; Vec2 la deja afuera.',
      },
      w: {
        label: 'W',
        description: 'La cuarta componente: el alfa en un color; solo la usa Vec4.',
      },
    },
    outputs: {
      vec2: { label: 'Vec2', description: 'X e Y en un vec2.' },
      vec3: { label: 'Vec3', description: 'X, Y y Z en un vec3.' },
      vec4: { label: 'Vec4', description: 'X, Y, Z y W en un vec4.' },
    },
  },
  'vector/dot': {
    label: 'Producto punto',
    description:
      'Mide cuánto coinciden dos direcciones: 1 si son iguales, 0 en ángulo recto y -1 si son opuestas (con direcciones de longitud 1).',
    keywords: ['producto escalar', 'producto punto', 'ángulo', 'alineación'],
    inputs: {
      a: { label: 'A', description: 'La primera dirección.' },
      b: { label: 'B', description: 'La segunda dirección.' },
    },
    outputs: {
      out: {
        label: 'Salida',
        description:
          'Positivo si A y B apuntan hacia el mismo lado, 0 en ángulo recto, negativo si se oponen.',
      },
    },
  },
  'vector/length': {
    label: 'Longitud',
    description: 'La longitud de un vector: su distancia al origen.',
    keywords: ['longitud', 'magnitud', 'tamaño', 'norma'],
    inputs: { in: { label: 'Entrada', description: 'El vector a medir.' } },
    outputs: {
      out: { label: 'Salida', description: 'Qué tan largo es Entrada; nunca es negativo.' },
    },
  },
  'vector/normalize': {
    label: 'Normalizar',
    description: 'Lleva un vector a longitud 1 sin cambiar su dirección.',
    formula: 'Entrada ÷ length(Entrada)',
    keywords: ['normalizar', 'unitario', 'dirección'],
    inputs: { in: { label: 'Entrada', description: 'La dirección a normalizar.' } },
    outputs: {
      out: {
        label: 'Salida',
        description: 'Entrada llevada a longitud 1, apuntando hacia el mismo lado.',
      },
    },
  },
  'vector/rotate-2d': {
    label: 'Rotar 2D',
    description: 'Rota un punto 2D alrededor de un centro, según un ángulo en radianes.',
    formula: 'Entrada ↻ Ángulo alrededor de Centro',
    keywords: ['rotar', 'rotación', 'girar', 'ángulo'],
    inputs: {
      in: { label: 'Entrada', description: 'El punto 2D a rotar, por lo general el UV.' },
      angle: {
        label: 'Ángulo',
        description: 'Cuánto girar, en radianes: 3,14 es media vuelta.',
      },
      center: {
        label: 'Centro',
        description: 'El punto alrededor del que se gira; 0,5, 0,5 es el medio del UV.',
      },
    },
    outputs: {
      out: { label: 'Salida', description: 'Entrada girada según Ángulo alrededor de Centro.' },
    },
  },

  // Properties (added from the Properties panel, named after their property)
  'property/float': {
    label: 'Propiedad float',
    description:
      'Lee una propiedad float del panel Propiedades, para que un mismo valor alimente muchos nodos.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: PROPERTY_OUT,
  },
  'property/vec2': {
    label: 'Propiedad vec2',
    description:
      'Lee una propiedad vec2 del panel Propiedades, para que un mismo valor alimente muchos nodos.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: PROPERTY_OUT,
  },
  'property/vec3': {
    label: 'Propiedad vec3',
    description:
      'Lee una propiedad vec3 del panel Propiedades, para que un mismo valor alimente muchos nodos.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: PROPERTY_OUT,
  },
  'property/vec4': {
    label: 'Propiedad vec4',
    description:
      'Lee una propiedad vec4 del panel Propiedades, para que un mismo valor alimente muchos nodos.',
    keywords: ['propiedad', 'parámetro', 'uniform'],
    outputs: PROPERTY_OUT,
  },
  'property/texture': {
    label: 'Propiedad de textura',
    description:
      'Lee una propiedad de textura del panel Propiedades, para que un mismo valor alimente muchos nodos.',
    keywords: ['propiedad', 'parámetro', 'uniform', 'textura'],
    outputs: PROPERTY_OUT,
  },

  // Effects
  'effects/fresnel': {
    label: 'Fresnel',
    description:
      'Brilla donde la superficie se aleja de la cámara, para luz de borde y contornos suaves.',
    formula: 'pow(1 − N·V, Potencia)',
    keywords: ['borde', 'contorno', 'brillo', 'luz de borde'],
    inputs: {
      normal: {
        label: 'Normal',
        description:
          'Hacia dónde mira la superficie; la normal de la malla si no hay nada conectado.',
      },
      viewDir: {
        label: 'Dir. de vista',
        description: 'La dirección hacia la cámara; se completa sola si no hay nada conectado.',
      },
      power: {
        label: 'Potencia',
        description: 'Qué tan ceñido es el borde: más alto = borde más fino.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: '0 donde la superficie mira a la cámara, y sube hacia 1 en los bordes.',
      },
    },
  },
  'effects/noise': {
    label: 'Ruido',
    description: 'Valores aleatorios suaves que varían en el espacio, con ruido Perlin o simplex.',
    formula: 'noise(P × Escala)',
    keywords: ['ruido', 'aleatorio', 'nubes', 'procedural'],
    inputs: {
      p: {
        label: 'P',
        description: 'Dónde se muestrea el ruido; con Posición queda pegado a la superficie.',
      },
      scale: {
        label: 'Escala',
        description: 'Qué tan cargado es el ruido: más alto = manchas más chicas y densas.',
      },
      roughness: {
        label: 'Rugosidad',
        description: 'Con más de una octava, cuánto pesa cada capa más fina.',
      },
      lacunarity: {
        label: 'Lacunaridad',
        description: 'Con más de una octava, cuánto más densa es cada capa que la anterior.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'Valores aleatorios suaves, más o menos entre -1 y 1.',
      },
    },
    params: {
      kind: { label: 'Tipo', options: { perlin: 'Perlin', simplex: 'Simplex' } },
      octaves: { label: 'Octavas' },
    },
  },
  'effects/voronoi': {
    label: 'Voronoi',
    description:
      'Patrón celular: la distancia al centro de celda más cercano y al segundo más cercano.',
    formula: 'voronoi(UV × Escala)',
    keywords: ['celular', 'celdas', 'distancia', 'borde', 'procedural'],
    inputs: {
      uv: {
        label: 'UV',
        description: 'Dónde se muestrean las celdas; el UV de la malla si no hay nada conectado.',
      },
      scale: { label: 'Escala', description: 'Cuántas celdas entran a lo ancho del UV.' },
      jitter: {
        label: 'Dispersión',
        description: 'Qué tan irregulares son las celdas: 0 = grilla cuadrada, 1 = al azar.',
      },
    },
    outputs: {
      f1: {
        label: 'F1',
        description: 'La distancia al centro de celda más cercano: 0 en el medio de cada celda.',
      },
      f2: { label: 'F2', description: 'La distancia al segundo centro de celda más cercano.' },
      edge: {
        label: 'Borde',
        description:
          'F2 menos F1: casi 0 sobre los límites entre celdas, para grietas y contornos.',
      },
      cell: {
        label: 'Celda',
        description:
          'El centro de la celda más cercana, en unidades de UV × Escala: uno por celda.',
      },
      random: {
        label: 'Aleatorio',
        description: 'Un valor al azar de 0 a 1 por celda, para darle a cada una su propio color.',
      },
    },
    params: { distance: VORONOI_DISTANCE_ES },
  },
  'effects/voronoi-3d': {
    label: 'Voronoi 3D',
    description:
      'Patrón celular en el espacio 3D: celdas que llenan el volumen, sin estirarse sobre el UV.',
    formula: 'voronoi(Posición × Escala)',
    keywords: ['celular', 'celdas', 'volumen', 'piedra', 'distancia', 'borde', 'procedural'],
    inputs: {
      position: {
        label: 'Posición',
        description:
          'Dónde se muestrean las celdas; la posición del objeto si no hay nada conectado.',
      },
      scale: { label: 'Escala', description: 'Cuántas celdas entran en una unidad de espacio.' },
      jitter: {
        label: 'Dispersión',
        description: 'Qué tan irregulares son las celdas: 0 = grilla de cubos, 1 = al azar.',
      },
    },
    outputs: {
      f1: {
        label: 'F1',
        description: 'La distancia al centro de celda más cercano: 0 en el medio de cada celda.',
      },
      f2: { label: 'F2', description: 'La distancia al segundo centro de celda más cercano.' },
      edge: {
        label: 'Borde',
        description:
          'F2 menos F1: casi 0 sobre las paredes entre celdas, para grietas y contornos.',
      },
      cell: {
        label: 'Celda',
        description:
          'El centro de la celda más cercana, en unidades de Posición × Escala: uno por celda.',
      },
      random: {
        label: 'Aleatorio',
        description: 'Un valor al azar de 0 a 1 por celda, para darle a cada una su propio color.',
      },
    },
    params: { distance: VORONOI_DISTANCE_ES },
  },
  'effects/checkerboard': {
    label: 'Damero',
    description: 'Cuadrados que alternan entre 0 y 1 a lo largo del UV.',
    formula: 'checker(UV × Escala)',
    keywords: ['damero', 'tablero', 'ajedrez', 'cuadros', 'grilla', 'patrón'],
    inputs: {
      uv: {
        label: 'UV',
        description: 'Dónde se muestrea el patrón; el UV de la malla si no hay nada conectado.',
      },
      scale: { label: 'Escala', description: 'Cuántos cuadrados entran a lo ancho del UV.' },
    },
    outputs: {
      out: { label: 'Salida', description: '1 en un grupo de cuadrados y 0 en el otro.' },
    },
  },
  'effects/gradient': {
    label: 'Gradiente',
    description: 'Una rampa de 0 a 1 a lo largo de X, de Y o hacia afuera desde el centro del UV.',
    keywords: ['gradiente', 'degradé', 'rampa', 'lineal', 'radial', 'viñeta'],
    inputs: {
      uv: {
        label: 'UV',
        description: 'Dónde se muestrea la rampa; el UV de la malla si no hay nada conectado.',
      },
    },
    outputs: { out: { label: 'Salida', description: 'Una rampa de 0 a 1 en el modo elegido.' } },
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
    description:
      'Lee el color de una textura en un UV. Las superficies lejanas reciben una versión más suave, o se elige el nivel de desenfoque.',
    keywords: ['textura', 'muestrear', 'imagen', 'mapa'],
    inputs: {
      texture: { label: 'Textura', description: 'La imagen a leer.' },
      uv: {
        label: 'UV',
        description: 'Dónde se lee la imagen; el UV de la malla si no hay nada conectado.',
      },
      level: {
        label: 'Nivel',
        description:
          'Qué mip se lee cuando Mip está en Nivel: 0 = el más nítido, más alto = más borroso.',
      },
    },
    outputs: {
      rgba: { label: 'RGBA', description: 'El color y el alfa en el UV.' },
      rgb: { label: 'RGB', description: 'El color en el UV.' },
      a: { label: 'A', description: 'El alfa (opacidad) en el UV.' },
    },
    params: { mip: { label: 'Mip', options: { auto: 'Automático', level: 'Nivel' } } },
  },

  'texture/triplanar': {
    label: 'Triplanar',
    description:
      'Proyecta una textura sobre los tres ejes y mezcla los resultados según la normal de la superficie: sin UVs y sin estirarse en las caras empinadas.',
    formula: 'Σ tex(plano) × peso',
    keywords: ['triplanar', 'textura', 'proyección', 'cubo', 'mapeo', 'roca'],
    inputs: {
      texture: { label: 'Textura', description: 'La imagen a proyectar.' },
      position: {
        label: 'Posición',
        description:
          'Dónde se proyecta la imagen; la posición del objeto si no hay nada conectado.',
      },
      normal: {
        label: 'Normal',
        description: 'Decide qué proyección se ve en cada cara; la normal del objeto por defecto.',
      },
      scale: {
        label: 'Escala',
        description: 'Cuántas veces se repite la imagen por unidad de espacio.',
      },
      sharpness: {
        label: 'Nitidez',
        description:
          'Qué tan cerrada es la mezcla entre proyecciones: más alto = uniones más finas.',
      },
    },
    outputs: {
      rgba: { label: 'RGBA', description: 'El color y el alfa mezclados.' },
      rgb: { label: 'RGB', description: 'El color mezclado.' },
      a: { label: 'A', description: 'El alfa (opacidad) mezclado.' },
    },
  },

  // Color
  'color/color-space': {
    label: 'Espacio de color',
    description:
      'Convierte un color entre sRGB, como lo guardan los selectores y las imágenes, y lineal, como lo necesita el cálculo de la luz.',
    keywords: ['color', 'espacio', 'lineal', 'gamma', 'convertir'],
    inputs: { in: { label: 'Entrada', description: 'El color a convertir.' } },
    outputs: { out: { label: 'Salida', description: 'El mismo color en el otro espacio.' } },
    params: {
      direction: {
        label: 'Dirección',
        options: { 'srgb-to-linear': 'sRGB a lineal', 'linear-to-srgb': 'Lineal a sRGB' },
      },
    },
  },

  'color/blend': {
    label: 'Mezcla',
    description:
      'Superpone un color sobre otro con un modo de mezcla estilo Photoshop, atenuado por la Opacidad.',
    formula: 'mix(Base, modo, Opacidad)',
    keywords: ['mezcla', 'mezclar', 'capa', 'multiplicar', 'trama', 'superponer', 'componer'],
    inputs: {
      base: { label: 'Base', description: 'El color de abajo, sobre el que se aplica la capa.' },
      blend: { label: 'Mezcla', description: 'El color que se superpone a la Base.' },
      opacity: {
        label: 'Opacidad',
        description: 'Cuánto se nota la mezcla: 0 = solo la Base, 1 = el modo completo.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'La Base con el modo de mezcla aplicado a la opacidad elegida.',
      },
    },
    params: {
      mode: {
        label: 'Modo',
        options: {
          multiply: 'Multiplicar',
          screen: 'Trama',
          overlay: 'Superponer',
          'soft-light': 'Luz suave',
          'linear-light': 'Luz lineal',
          'color-burn': 'Subexponer color',
          'color-dodge': 'Sobreexponer color',
          darken: 'Oscurecer',
          lighten: 'Aclarar',
          difference: 'Diferencia',
          add: 'Sumar',
          subtract: 'Restar',
        },
      },
    },
  },

  // Scene
  'scene/scene-color': {
    label: 'Color de escena',
    description: 'El color renderizado detrás de la superficie, para refracción y transparencias.',
    formula: 'scene(UV + Desplazamiento)',
    keywords: ['escena', 'color', 'pantalla', 'refracción', 'fondo', 'detrás'],
    inputs: {
      uv: {
        label: 'UV',
        description: 'Dónde se lee en pantalla; este píxel si no hay nada conectado.',
      },
      offset: {
        label: 'Desplazamiento',
        description: 'Corre el punto donde se lee la escena; un poco de ruido acá da refracción.',
      },
    },
    outputs: {
      out: { label: 'Salida', description: 'El color de lo que haya detrás de la superficie.' },
    },
  },
  'scene/depth-fade': {
    label: 'Fundido por profundidad',
    description: 'Pasa de 0 a 1 a medida que la escena detrás de la superficie se aleja.',
    keywords: ['profundidad', 'fundido', 'suave', 'intersección', 'orilla', 'espuma', 'borde'],
    inputs: {
      distance: {
        label: 'Distancia',
        description:
          'Qué tan detrás de la superficie, en unidades de escena, el fundido llega a 1.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: '0 donde la superficie toca lo que tiene detrás, 1 a partir de Distancia.',
      },
    },
  },

  // Normal
  'normal/normal-from-height': {
    label: 'Normal desde altura',
    description:
      'Convierte un valor de altura, como un ruido, en relieve que la iluminación puede ver.',
    keywords: ['normal', 'altura', 'relieve', 'derivada', 'ondas'],
    inputs: {
      height: {
        label: 'Altura',
        description: 'La altura en este punto: los valores más altos sobresalen más.',
      },
      strength: {
        label: 'Intensidad',
        description: 'Cuánto relieve se ve en el resultado: 0 = plano.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'Una dirección de superficie para la entrada Normal del Master Stack.',
      },
    },
  },

  // Utility
  'utility/comment': {
    label: 'Comentario',
    description: 'Una nota redimensionable en el lienzo. No afecta al shader.',
    keywords: ['comentario', 'nota', 'anotación', 'etiqueta', 'grupo', 'marco'],
  },
  'utility/reroute': {
    label: 'Reroute',
    description: 'Un punto que desvía una conexión. Deja pasar su valor sin cambios.',
    formula: 'Entrada',
    keywords: ['reroute', 'punto', 'nudo', 'codo', 'desviar', 'cable', 'pasar'],
    inputs: {
      in: {
        label: 'Entrada',
        description: 'El valor que lleva la conexión, de cualquier tipo vectorial.',
      },
    },
    outputs: {
      out: {
        label: 'Salida',
        description: 'El mismo valor, sin cambios, hacia donde siga la conexión.',
      },
    },
  },
}
