
export const welcome =
  'Bienvenida, bienvenido a Arte al oído. Esta galería está diseñada para explorar obras de arte mediante narraciones, sonidos y descripciones espaciales. Puedes recorrer las obras, escuchar sus detalles y descubrir cada elemento a tu propio ritmo.';

export const works = [
  {
    id: 'gran-ola',
    title: 'La gran ola de Kanagawa',
    artist: 'Katsushika Hokusai',
    year: '1831',
    technique: 'Xilografía en color',
    category: 'Paisaje marino',
    sound: 'mar',

    image: '/media/gran-ola.jpg',
    source: 'https://www.artic.edu/artworks/24645',

    summary:
      'Una enorme ola azul se eleva sobre tres embarcaciones. A lo lejos, el monte Fuji permanece inmóvil. La escena contrasta la fuerza de la naturaleza con la fragilidad humana.',

    intro:
      'Imagina que estás frente a un mar agitado. Una enorme ola azul se levanta y curva su cresta hacia el centro de la escena. La espuma blanca parece extenderse como dedos sobre el agua. Debajo de ella, varias embarcaciones avanzan entre las olas con sus tripulantes. Al fondo, pequeño y aparentemente tranquilo, aparece el monte Fuji. La composición transmite movimiento, tensión y la inmensidad de la naturaleza.',

    zones: [
      {
        id: 'ola',
        label: 'La gran ola',
        position: 'Izquierda',
        bounds: [0, 0, 0.43, 1],

        text:
          'A la izquierda se levanta una enorme ola azul. Su cuerpo se curva hacia adelante y la espuma blanca de la cresta se divide en pequeñas puntas que parecen dedos. El movimiento del agua domina la composición y transmite una sensación de fuerza y peligro.'
      },
      {
        id: 'fuji',
        label: 'El monte Fuji',
        position: 'Centro',
        bounds: [0.43, 0, 0.24, 1],

        text:
          'En el centro, cerca del horizonte, aparece el monte Fuji. Su silueta triangular y nevada parece diminuta frente a la enorme ola. Aunque todo a su alrededor transmite movimiento, la montaña permanece inmóvil, creando un contraste entre la estabilidad y la fuerza del mar.'
      },
      {
        id: 'barcas',
        label: 'Las embarcaciones',
        position: 'Derecha',
        bounds: [0.67, 0, 0.33, 1],

        text:
          'En la parte derecha se distinguen varias embarcaciones largas y estrechas. Sus tripulantes se inclinan hacia adelante mientras intentan atravesar el mar agitado. La espuma de la ola parece estar a punto de alcanzarlos.'
      }
    ]
  },

  {
    id: 'dormitorio',
    title: 'El dormitorio',
    artist: 'Vincent van Gogh',
    year: '1889',
    technique: 'Óleo sobre lienzo',
    category: 'Interior',
    sound: 'cuarto',

    image: '/media/dormitorio.jpg',
    source: 'https://www.artic.edu/artworks/28560',

    summary:
      'Una habitación sencilla con una cama de madera, sillas, una mesa y una ventana. Los colores intensos y las perspectivas inclinadas crean una atmósfera íntima.',

    intro:
      'Estás frente a una habitación pequeña y acogedora. Una cama de madera ocupa buena parte del lado derecho. Frente a ti hay una ventana de color verde y, alrededor, paredes azules decoradas con cuadros. A la izquierda aparecen sillas y una pequeña mesa. Las líneas del suelo y los muebles parecen inclinarse ligeramente, creando una perspectiva particular. Van Gogh pintó esta habitación en Arlés, Francia, en 1889.',

    zones: [
      {
        id: 'sillas',
        label: 'Las sillas y la mesa',
        position: 'Izquierda',
        bounds: [0, 0, 0.33, 1],

        text:
          'A la izquierda se encuentra una silla de madera cercana al borde inferior de la pintura. Detrás aparece una pequeña mesa con objetos personales, entre ellos una jarra y una palangana. Los muebles tienen contornos marcados y colores intensos.'
      },
      {
        id: 'ventana',
        label: 'La ventana',
        position: 'Centro',
        bounds: [0.33, 0, 0.34, 1],

        text:
          'En la pared del fondo aparece una ventana con un marco verde. Su presencia introduce un punto de luz en la habitación. Alrededor se observan paredes azules y varios cuadros pequeños que decoran el espacio.'
      },
      {
        id: 'cama',
        label: 'La cama',
        position: 'Derecha',
        bounds: [0.67, 0, 0.33, 1],

        text:
          'A la derecha destaca una cama de madera amarilla. Su estructura ocupa una parte importante de la habitación y está cubierta por una colcha rojiza. Sobre la pared se observan pequeños cuadros que complementan la decoración.'
      }
    ]
  },

  {
    id: 'nenufares',
    title: 'Nenúfares',
    artist: 'Claude Monet',
    year: '1906',
    technique: 'Óleo sobre lienzo',
    category: 'Paisaje acuático',
    sound: 'estanque',

    image: '/media/nenufares.jpg',
    source: 'https://www.artic.edu/artworks/16568',

    summary:
      'Un estanque cubierto de nenúfares, hojas y reflejos. Los tonos verdes, azules y violetas crean una escena tranquila que invita a contemplar la naturaleza.',

    intro:
      'Imagina que estás frente a un estanque tranquilo. El agua ocupa toda la superficie de la pintura y sobre ella flotan hojas y flores de nenúfar. Los colores verdes, azules y violetas se mezclan con los reflejos de la vegetación y del cielo. No existe una línea de horizonte claramente definida. La escena invita a observar los pequeños cambios de luz, color y movimiento sobre el agua.',

    zones: [
      {
        id: 'hojas',
        label: 'Las hojas',
        position: 'Izquierda',
        bounds: [0, 0, 0.34, 1],

        text:
          'A la izquierda aparecen grupos de hojas de nenúfar que flotan sobre el agua. Algunas son grandes y oscuras, mientras otras tienen tonos más claros. Sus formas se distribuyen irregularmente y parecen descansar sobre la superficie del estanque.'
      },
      {
        id: 'reflejos',
        label: 'Los reflejos',
        position: 'Centro',
        bounds: [0.34, 0, 0.32, 1],

        text:
          'En el centro se mezclan pinceladas azules, verdes y violetas. Estos colores representan los reflejos de la vegetación y del cielo sobre el agua. Las pinceladas crean una sensación de profundidad y movimiento.'
      },
      {
        id: 'flores',
        label: 'Las flores',
        position: 'Derecha',
        bounds: [0.66, 0, 0.34, 1],

        text:
          'A la derecha se distinguen pequeños grupos de flores claras entre las hojas. Sus tonos blancos y rosados destacan sobre los colores más oscuros del agua. Parecen pequeños puntos de luz distribuidos sobre el estanque.'
      }
    ]
  }
];

/*
 * Generación de rutas de audio.
 * Se conservan los nombres utilizados por el proyecto.
 */

for (const work of works) {
  work.introAudio = `/media/${work.id}-intro.wav`;

  work.summaryAudio = `/media/${work.id}-ficha.wav`;

  for (const zone of work.zones) {
    zone.audio = `/media/${work.id}-${zone.id}.wav`;
  }
}
