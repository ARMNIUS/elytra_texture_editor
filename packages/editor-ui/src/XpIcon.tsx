import React from 'react'
import paint from './assets/xp/paint.png'
import application from './assets/xp/application.png'
import save from './assets/xp/save.png'
import open from './assets/xp/open.png'
import newfolder from './assets/xp/newfolder.png'
import folder from './assets/xp/folder.png'
import copy from './assets/xp/copy.png'
import cut from './assets/xp/cut.png'
import paste from './assets/xp/paste.png'
import remove from './assets/xp/delete.png'
import undo from './assets/xp/undo.png'
import redo from './assets/xp/redo.png'
import bitmap from './assets/xp/bitmap.png'
import settings from './assets/xp/settings.png'
import palette from './assets/xp/palette.png'
import alert from './assets/xp/alert.png'
import info from './assets/xp/info.png'

const sources = {
  paint, application, save, open, newfolder, folder, copy, cut, paste,
  delete: remove, undo, redo, bitmap, settings, palette, alert, info,
}

export type XpIconName = keyof typeof sources

type Props = {
  name: XpIconName
  size?: number
  className?: string
}

/** A Windows XP icon from the user's icon set, rendered at UI size. */
export default function XpIcon({ name, size = 16, className }: Props) {
  return (
    <img
      src={sources[name]}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`xp-icon${className ? ` ${className}` : ''}`}
    />
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
