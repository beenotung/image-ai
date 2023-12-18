import {
  toImage,
  resizeImage,
  resizeWithRatio,
  resizeBase64WithRatio,
} from '@beenotung/tslib/image'
import { fileToBase64String } from '@beenotung/tslib/file'

declare var fileInput: HTMLInputElement

fileInput.onchange = async () => {
  if (!fileInput.files) return
  for (let file of fileInput.files) {
    let base64 = await fileToBase64String(file)
    base64 = await resizeBase64WithRatio(
      base64,
      { width: 140, height: 140 },
      'with_in',
    )
    let img = document.createElement('img')
    img.src = base64
    document.body.appendChild(img)
  }
}
