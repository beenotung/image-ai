import { fileToArrayBuffer, fileToBase64String } from '@beenotung/tslib/file'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

window.addEventListener('DOMContentLoaded', init)

declare let fileInput: HTMLInputElement
declare let imageList: HTMLElement
declare let progressText: HTMLElement
declare let progressBar: HTMLProgressElement

let imageDir = 'images'
mkdirSync(imageDir, { recursive: true })

function init() {
  let imageTemplate = imageList.querySelector<HTMLInputElement>('.image')!

  type ImageFile = {
    file: File
    path: string
    image: HTMLElement
  }
  let imageFiles: ImageFile[] = []

  imageTemplate.remove()

  fileInput.onchange = () => {
    if (!fileInput.files) return
    for (let file of fileInput.files) {
      let image = imageTemplate.cloneNode(true) as HTMLElement
      // TODO check for duplicated filename
      let path = join(imageDir, file.name)
      let imageFile: ImageFile = {
        file,
        path,
        image,
      }
      imageFiles.push(imageFile)
      image
        .querySelectorAll<HTMLButtonElement>('.remove-btn')
        .forEach(button => {
          button.onclick = () => {
            image.remove()
            let index = imageFiles.indexOf(imageFile)
            if (index == -1) return
            imageFiles.splice(index, 1)
          }
        })
      image.querySelector('.filename')!.textContent = file.name
      fileToBase64String(file).then(
        src => (image.querySelector('img')!.src = src),
      )
      imageList.appendChild(image)
    }
  }

  Object.assign(window, {
    async importAll() {
      progressBar.value = 0
      progressBar.max = imageFiles.length
      progressText.textContent = `${progressBar.value}/${progressBar.max}`
      for (let imageFile of imageFiles) {
        let buffer = await fileToArrayBuffer(imageFile.file)
        writeFileSync(imageFile.path, Buffer.from(buffer))
        imageFile.image.remove()
        progressBar.value++
        progressText.textContent = `${progressBar.value}/${progressBar.max}`
      }
    },
  })
}
