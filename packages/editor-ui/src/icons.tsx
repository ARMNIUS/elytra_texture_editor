import React from 'react'
import type { CSSProperties, ImgHTMLAttributes } from 'react'
import paint from './assets/w98/w98_paint.ico'
import paintFile from './assets/w98/w98_paint_file.ico'
import paintbrush from './assets/w98/w98_paintbrush.ico'
import erase from './assets/w98/w98_erase_file.ico'
import colorImage from './assets/w98/w98_wia_img_color.ico'
import grayImage from './assets/w98/w98_wia_img_gray.ico'
import imageA from './assets/w98/w98_wia_img_a.ico'
import eye from './assets/w98/w98_file_eye.ico'
import no from './assets/w98/w98_no.ico'
import defrag from './assets/w98/w98_defragment.ico'
import keyboard from './assets/w98/w98_keyboard.ico'
import refresh from './assets/w98/w98_overlay_refresh.ico'
import shell from './assets/w98/w98_shell_window1.ico'
import shellAlt from './assets/w98/w98_shell_window2.ico'
import packageIcon from './assets/w98/w98_package.ico'
import download from './assets/w98/w98_download.ico'
import eject from './assets/w98/w98_eject_pc.ico'
import png from './assets/w98/w98_imagPNG.ico'
import help from './assets/w98/w98_help_question_mark.ico'
import display from './assets/w98/w98_display_properties.ico'
import channels from './assets/w98/w98_channels.ico'
import update from './assets/w98/w98_windows_update_small.ico'
import mouse from './assets/w98/w98_mouse.ico'
import zoomInSource from './assets/w98/w98_magnifying_glass.ico'
import zoomOutSource from './assets/w98/w98_magnifying_glass_3.ico'
import user from './assets/w98/w98_user_card.ico'
import scanner from './assets/w98/w98_scanner.ico'
import accessibility from './assets/w98/w98_accessibility.ico'
import mouseLocation from './assets/w98/w98_mouse_location.ico'
import write from './assets/w98/w98_write_red.ico'
import template from './assets/w98/w98_template_empty.ico'
import pie from './assets/w98/w98_pie_chart_drvspace.ico'
import replace from './assets/w98/w98_replace_file.ico'
import appwizardList from './assets/w98/w98_appwizard_list.ico'
import restore from './assets/w98/w98_system_restore.ico'
import copySource from './assets/w98/w98_diskettes_copy.ico'
import lock from './assets/w98/w98_key_padlock.ico'
import unlock from './assets/w98/w98_key_gray.ico'
import tools from './assets/w98/w98_tools_gear.ico'
import mixer from './assets/w98/w98_mixer_sound.ico'
import recycleEmpty from './assets/w98/w98_recycle_bin_empty.ico'
import recycleFull from './assets/w98/w98_recycle_bin_full.ico'
import check from './assets/w98/w98_check.ico'
import directoryClosed from './assets/w98/w98_directory_closed.ico'
import directoryOpen from './assets/w98/w98_directory_open.ico'
import pictures from './assets/w98/w98_pictures.ico'
import floppy from './assets/w98/w98_floppy_drive_3-5.ico'
import warning from './assets/w98/w98_msg_warning.ico'
import info from './assets/w98/w98_msg_information.ico'
import question from './assets/w98/w98_msg_question.ico'
import appwizard from './assets/w98/w98_appwizard.ico'
import colorProfile from './assets/w98/w98_color_profile.ico'
import wordpad from './assets/w98/w98_write_wordpad.ico'
import hourglass from './assets/w98/w98_application_hourglass.ico'

export const appIconRaw = paint
export const appIconMinecraft = paintFile
export const appIconCreate = template
export const appIconOpen = directoryOpen
export const appIconImport = png

export type W98IconProps = {
  size?: number | string
  className?: string
  style?: CSSProperties
  title?: string
  strokeWidth?: number
  absoluteStrokeWidth?: boolean
  color?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'>

function makeIcon(source: string, defaultSize = 16) {
  return function W98Icon({ size = defaultSize, className, style, title, ...rest }: W98IconProps) {
    return (
      <img
        {...rest}
        src={source}
        width={size}
        height={size}
        alt=""
        draggable={false}
        title={title}
        className={`w98-icon${className ? ` ${className}` : ''}`}
        style={{ imageRendering: 'pixelated', objectFit: 'contain', ...style }}
      />
    )
  }
}

const icon = makeIcon

export const Brush = icon(paintbrush)
export const Eraser = icon(erase)
export const PaintBucket = icon(paintFile)
export const Pipette = icon(colorImage)
export const Eye = icon(eye)
export const EyeOff = icon(no)
export const Grid2X2 = icon(defrag)
export const Keyboard = icon(keyboard)
export const RotateCw = icon(refresh)
export const PanelsTopLeft = icon(shell)
export const Box = icon(packageIcon)
export const ChevronDown = icon(download)
export const ChevronUp = icon(eject)
export const FileImage = icon(png)
export const CircleHelp = icon(help)
export const Maximize2 = icon(display)
export const Layers3 = icon(channels)
export const Sparkles = icon(update)
export const MousePointer2 = icon(mouse)
export const ZoomIn = icon(zoomInSource)
export const ZoomOut = icon(zoomOutSource)
export const UserRound = icon(user)
export const Paintbrush = icon(paintbrush)
export const ScanLine = icon(scanner)
export const PersonStanding = icon(accessibility)
export const SquareDashedMousePointer = icon(mouseLocation)
export const Slash = icon(write)
export const Square = icon(shell)
export const Circle = icon(pie)
export const Merge = icon(replace)
export const Plus = icon(template)
export const FlipHorizontal = icon(colorImage)
export const FlipVertical = icon(grayImage)
export const RefreshCw = icon(refresh)
export const RotateCcw = icon(restore)
export const X = icon(no)
export const Check = icon(check)
export const ChevronLeft = icon(directoryClosed)
export const ChevronRight = icon(directoryOpen)
export const Copy = icon(copySource)
export const Download = icon(download)
export const Lock = icon(lock)
export const MoreHorizontal = icon(tools)
export const Pencil = icon(write)
export const SlidersHorizontal = icon(mixer)
export const Trash2 = icon(recycleEmpty)
export const Unlock = icon(unlock)
export const Upload = icon(eject)
export const ImageIcon = icon(imageA)
export const ShellAlt = icon(shellAlt)
export const Pictures = icon(pictures)
export const SaveIcon = icon(floppy)
export const WarningIcon = icon(warning)
export const InfoIcon = icon(info)
export const QuestionIcon = icon(question)
export const AppWizard = icon(appwizard)
export const AppWizardList = icon(appwizardList)
export const DangerIcon = icon(recycleFull)
export const ColorProfile = icon(colorProfile)
export const WordPad = icon(wordpad)
export const Hourglass = icon(hourglass)

// Keep React in scope for environments that still use the classic JSX transform.
void React
