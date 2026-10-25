import React from 'react'
import paint from './assets/w98/w98_paint.ico'
import application from './assets/w98/w98_paint_file.ico'
import save from './assets/w98/w98_floppy_drive_3-5.ico'
import open from './assets/w98/w98_directory_open.ico'
import newfolder from './assets/w98/w98_directory_closed.ico'
import folder from './assets/w98/w98_directory_open.ico'
import copy from './assets/w98/w98_diskettes_copy.ico'
import cut from './assets/w98/w98_erase_file.ico'
import paste from './assets/w98/w98_diskettes_copy.ico'
import remove from './assets/w98/w98_recycle_bin_full.ico'
import undo from './assets/w98/w98_overlay_refresh.ico'
import redo from './assets/w98/w98_system_restore.ico'
import bitmap from './assets/w98/w98_wia_img_a.ico'
import settings from './assets/w98/w98_gears.ico'
import palette from './assets/w98/w98_color_profile.ico'
import alert from './assets/w98/w98_msg_warning.ico'
import info from './assets/w98/w98_msg_information.ico'

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

/** A Windows 98 icon from the user's icon set, rendered at UI size. */
export default function XpIcon({ name, size = 16, className }: Props) {
  return (
    <img
      src={sources[name]}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`w98-icon xp-icon${className ? ` ${className}` : ''}`}
      style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
    />
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
