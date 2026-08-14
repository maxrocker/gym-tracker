import { useEffect, useState } from 'react'

interface Props {
  photo?: Blob
  size?: 'sm' | 'lg'
  emoji?: string
}

export default function MachinePhoto({ photo, size = 'sm', emoji = '🏋️' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) {
      setUrl(null)
      return
    }
    const objUrl = URL.createObjectURL(photo)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [photo])

  const className = size === 'lg' ? 'machine-photo-lg' : 'machine-photo'

  if (url) return <img className={className} src={url} alt="" />

  return (
    <div className={`${className} machine-photo-placeholder`} style={size === 'lg' ? { height: 160 } : undefined}>
      {emoji}
    </div>
  )
}
