export const welcome = 'Bienvenida, bienvenido a Arte al oído. Puedes explorar la galería, buscar una obra por voz o ajustar la narración y los sonidos.';

export const works = [
  {
    id: 'gran-ola', title: 'La gran ola de Kanagawa', artist: 'Katsushika Hokusai', year: '1831',
    technique: 'Xilografía en color', category: 'Paisaje marino', sound: 'mar',
    image: '/media/gran-ola.jpg', source: 'https://www.artic.edu/artworks/24645',
    summary: 'Una ola enorme se curva sobre tres barcas. A lo lejos, el monte Fuji parece inmóvil.',
    intro: 'Frente a ti hay un mar agitado. Una ola azul se levanta a la izquierda y se curva hacia la derecha sobre tres barcas muy estrechas. En el centro bajo, el monte Fuji apenas asoma en el horizonte. La espuma blanca y el perfil de la montaña se parecen, aunque uno está a punto de caer y el otro parece inmóvil.',
    zones: [
      { id: 'ola', label: 'La ola', position: 'Izquierda', bounds: [0, 0, .43, 1],
        text: 'A la izquierda sube la gran ola. Primero se alza como una pared de agua oscura y luego se dobla sobre sí misma. La espuma de la cresta se separa en puntas blancas, parecidas a dedos que se extienden hacia las barcas.' },
      { id: 'fuji', label: 'El monte Fuji', position: 'Centro', bounds: [.43, 0, .24, 1],
        text: 'En el centro, cerca del horizonte, el monte Fuji tiene la forma de un pequeño triángulo nevado. Parece diminuto junto a la ola. Su silueta firme y el cielo claro detrás de él hacen que el movimiento del agua se sienta todavía más brusco.' },
      { id: 'barcas', label: 'Las barcas', position: 'Derecha', bounds: [.67, 0, .33, 1],
        text: 'A la derecha se distinguen las barcas, largas y estrechas. Los remeros se agachan siguiendo la línea del casco. Sobre sus cabezas, gotas de espuma quedan suspendidas en el aire, justo antes de que caiga la ola.' }
    ]
  },
  {
    id: 'dormitorio', title: 'El dormitorio', artist: 'Vincent van Gogh', year: '1889',
    technique: 'Óleo sobre lienzo', category: 'Interior', sound: 'cuarto',
    image: '/media/dormitorio.jpg', source: 'https://www.artic.edu/artworks/28560',
    summary: 'Una cama de madera, dos sillas y una ventana componen el cuarto de Van Gogh en Arlés.',
    intro: 'Estás en una habitación pequeña. Una cama amarilla ocupa el lado derecho y una ventana verde está frente a ti. Las líneas del piso se inclinan hacia el fondo, como si el cuarto tuviera una ligera pendiente. Van Gogh pintó más de una versión de este dormitorio en Arlés. Esta versión, de 1889, está en el Art Institute of Chicago.',
    zones: [
      { id: 'sillas', label: 'Las sillas y la mesa', position: 'Izquierda', bounds: [0, 0, .33, 1],
        text: 'A la izquierda, una silla se acerca al borde inferior del cuadro. Detrás de ella, una mesita sostiene una jarra, una palangana y otros objetos de aseo. Las patas de madera forman líneas oblicuas que repiten la inclinación de las tablas del suelo.' },
      { id: 'ventana', label: 'La ventana', position: 'Centro', bounds: [.33, 0, .34, 1],
        text: 'En la pared del fondo hay una ventana con dos hojas verdes. Debajo queda un espacio abierto entre los muebles. Las paredes azules y el verde del marco rodean ese hueco, mientras las líneas del piso conducen hacia él.' },
      { id: 'cama', label: 'La cama', position: 'Derecha', bounds: [.67, 0, .33, 1],
        text: 'A la derecha, el pie de la cama se ensancha hacia ti. La madera amarilla forma un contorno grueso alrededor de una colcha rojiza. Sobre la pared lateral cuelgan varios cuadros pequeños que repiten el juego de líneas inclinadas.' }
    ]
  },
  {
    id: 'nenufares', title: 'Nenúfares', artist: 'Claude Monet', year: '1906',
    technique: 'Óleo sobre lienzo', category: 'Paisaje acuático', sound: 'estanque',
    image: '/media/nenufares.jpg', source: 'https://www.artic.edu/artworks/16568',
    summary: 'En el estanque de Giverny, flores y reflejos comparten una superficie sin horizonte.',
    intro: 'Mira hacia abajo, como si te asomaras al borde de un estanque. El agua ocupa todo el cuadro. Sobre ella flotan nenúfares y, entre los grupos de hojas, se mezclan tonos azules, verdes y violetas. Monet pintó este jardín en Giverny. Aquí, el cielo y las plantas que rodean el agua aparecen como reflejos.',
    zones: [
      { id: 'hojas', label: 'Hojas en el agua', position: 'Izquierda', bounds: [0, 0, .34, 1],
        text: 'A la izquierda, las hojas de los nenúfares descansan sobre el agua en grupos irregulares. Algunas marcas son anchas y planas. Otras, más claras y pequeñas, sugieren el brillo de una flor o de una hoja iluminada.' },
      { id: 'reflejos', label: 'Los reflejos', position: 'Centro', bounds: [.34, 0, .32, 1],
        text: 'En el centro, las manchas de color se funden entre sí. Las pinceladas verticales sugieren plantas reflejadas. Las hojas flotantes cruzan esas marcas en otro sentido y dan una pista para distinguir la superficie del estanque de lo que se refleja en ella.' },
      { id: 'flores', label: 'Las flores', position: 'Derecha', bounds: [.66, 0, .34, 1],
        text: 'A la derecha, pequeños toques claros se agrupan entre hojas más oscuras. Las flores parecen puntos que se encienden sobre el agua. Entre un grupo y otro, el color se abre y deja respirar al estanque.' }
    ]
  }
];

for (const work of works) {
  work.introAudio = `/media/${work.id}-intro.wav`;
  work.summaryAudio = `/media/${work.id}-ficha.wav`;
  for (const zone of work.zones) zone.audio = `/media/${work.id}-${zone.id}.wav`;
}
