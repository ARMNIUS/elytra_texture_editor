export type Palette = {
  name: string
  colors: string[]
}

export const palettes: Palette[] = [
  {
    name: 'Minecraft · Classic',
    colors: [
      '#171717', '#3b3b3b', '#6b6b6b', '#a0a0a0', '#f2f2f2', '#74452c', '#b57a47', '#e2bd83',
      '#6e2323', '#c53b35', '#e87532', '#f3c844', '#507c36', '#8bbd45', '#2d7892', '#459fd1',
      '#273f83', '#5b54b8', '#a05bc2', '#dc82b6', '#6a3f70', '#b7a6c9', '#6c9d87', '#c8d7ce',
    ],
  },
  {
    name: 'Aseprite · 16 colors',
    colors: [
      '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
      '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
    ],
  },
  {
    name: 'Grayscale',
    colors: ['#080808', '#202020', '#383838', '#505050', '#686868', '#808080', '#989898', '#b0b0b0', '#c8c8c8', '#e0e0e0', '#ffffff'],
  },
  {
    name: 'Pastel',
    colors: ['#f6bdc0', '#f7d6e0', '#f2b5d4', '#c6def1', '#c9e4de', '#cddafd', '#dbcdf0', '#f1c0e8', '#cfbaf0', '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1', '#b9fbc0', '#fbf8cc', '#fde4cf'],
  },
]

export const transparentPixel = '#00000000'
