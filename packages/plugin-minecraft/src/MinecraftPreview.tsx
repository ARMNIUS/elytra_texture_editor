import { useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { createTextureCanvas } from '@rawsprite/core/texture'
import ElytraViewer from './ElytraViewer'
import ModelPreview from './ModelPreview'
import { loadModelFromText } from './modelLoader'
import type { LoadedModel } from './modelLoader'

type Props = ComponentProps<typeof ElytraViewer>

export default function MinecraftPreview(props: Props) {
  const [model, setModel] = useState<LoadedModel | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textureUrl = useMemo(
    () => createTextureCanvas(props.pixels, props.width, props.height).toDataURL('image/png'),
    [props.pixels, props.width, props.height],
  )

  const importModel = async (file: File) => {
    try {
      const text = await file.text()
      const loaded = await loadModelFromText(file.name, text, textureUrl)
      setModel((previous) => {
        previous?.dispose()
        return loaded
      })
      props.onNotice?.(`Модель загружена: ${loaded.name}`)
    } catch (error) {
      console.error(error)
      props.onNotice?.(error instanceof Error ? error.message : 'Не удалось загрузить модель')
    }
  }

  const resetModel = () => {
    setModel((previous) => {
      previous?.dispose()
      return null
    })
    props.onNotice?.('Возвращён просмотр элитр')
  }

  return (
    <div className="minecraft-preview">
      {model
        ? <ModelPreview model={model} textureUrl={textureUrl} autoRotate={props.autoRotate} visible={props.visible} />
        : <ElytraViewer {...props} />}
      <div className="model-import-bar">
        <button type="button" onClick={() => fileRef.current?.click()} title="Загрузить .bbmodel или Bedrock .geo.json">
          Модель…
        </button>
        {model && <button type="button" onClick={resetModel} title="Вернуться к элитрам">Элитры</button>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".bbmodel,.json,.geo.json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importModel(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
