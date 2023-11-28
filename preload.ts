import { format_byte } from '@beenotung/tslib/format'
import { fileToArrayBuffer, fileToBase64String } from '@beenotung/tslib/file'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, rename, writeFileSync } from 'fs'
import { stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { proxy } from './proxy'

window.addEventListener('DOMContentLoaded', init)

declare let fileInput: HTMLInputElement
declare let imageList: HTMLElement
declare let renameNameClashButton: HTMLButtonElement
declare let removeDuplicatedButton: HTMLButtonElement
declare let importButton: HTMLButtonElement
declare let progressText: HTMLElement
declare let progressBar: HTMLProgressElement

let imageDir = 'images'

function inc(element: Element) {
  ;(element.textContent as string as unknown as number)++
}

function init() {
  let imageTemplate = imageList.querySelector<HTMLInputElement>('.image')!
  imageTemplate.remove()

  let nameClashCount = renameNameClashButton.querySelector('.count')!
  let duplicatedCount = removeDuplicatedButton.querySelector('.count')!
  let allCount = importButton.querySelector('.count')!

  type ImageFile = {
    file: File
    path: string
    image: HTMLElement
  }
  let imageFiles: ImageFile[] = []

  function removeImageFile(imageFile: ImageFile) {
    imageFile.image.remove()
    let index = imageFiles.indexOf(imageFile)
    if (index == -1) return
    imageFiles.splice(index, 1)
  }

  fileInput.onchange = () => {
    if (!fileInput.files) return
    for (let file of fileInput.files) {
      let image = imageTemplate.cloneNode(true) as HTMLElement
      let path = join(imageDir, file.name)
      let exists = existsSync(path)
      if (exists) {
        image.dataset.sameName = 'true'
        stat(path).then(stat => {
          if (file.size == stat.size) {
            image.dataset.sameSize = 'true'
            inc(duplicatedCount)
          } else {
            inc(nameClashCount)
          }
        })
      }
      let imageFile: ImageFile = {
        file,
        path,
        image,
      }
      imageFiles.push(imageFile)
      image
        .querySelectorAll<HTMLButtonElement>('.remove-btn')
        .forEach(button => {
          button.onclick = () => removeImageFile(imageFile)
        })
      image.querySelector('.filename')!.textContent = file.name
      image.querySelector('.size')!.textContent = format_byte(file.size)
      fileToBase64String(file).then(
        src => (image.querySelector('img')!.src = src),
      )
      imageList.appendChild(image)
    }
    allCount.textContent = String(imageFiles.length)
    progressBar.value = 0
    progressBar.max = imageFiles.length
    progressText.textContent = `${progressBar.value}/${progressBar.max}`
  }

  renameNameClashButton.onclick = () => {
    for (let imageFile of imageFiles) {
      if (imageFile.image.dataset.sameName == 'true') {
        let filename = randomUUID() + extname(imageFile.file.name)
        imageFile.path = join(imageDir, filename)
        imageFile.image.querySelector('.filename')!.textContent = filename
        imageFile.image.dataset.sameName = 'false'
      }
    }
    nameClashCount.textContent = '0'
  }

  removeDuplicatedButton.onclick = () => {
    for (let i = 0; i < imageFiles.length; i++) {
      let imageFile = imageFiles[i]
      if (imageFile.image.dataset.sameSize == 'true') {
        removeImageFile(imageFile)
        i--
      }
    }
    duplicatedCount.textContent = '0'
    allCount.textContent = String(imageFiles.length)
    progressBar.max = imageFiles.length
    progressText.textContent = `${progressBar.value}/${progressBar.max}`
  }

  importButton.onclick = async () => {
    importButton.disabled = true

    try {
      mkdirSync(imageDir, { recursive: true })

      progressBar.value = 0
      progressBar.max = imageFiles.length
      progressText.textContent = `${progressBar.value}/${progressBar.max}`
      for (let i = 0; i < imageFiles.length; i++) {
        let imageFile = imageFiles[i]
        if (imageFile.image.dataset.sameName == 'true') {
          console.log('sameName')
          continue
        }
        if (imageFile.image.dataset.sameSize == 'true') {
          console.log('sameSize')
          continue
        }
        let buffer = await fileToArrayBuffer(imageFile.file)
        writeFileSync(imageFile.path, Buffer.from(buffer))
        proxy.image.push({ filename: basename(imageFile.path) })
        removeImageFile(imageFile)
        i--
        progressBar.value++
        progressText.textContent = `${progressBar.value}/${progressBar.max}`
      }
    } catch (error) {
      console.error(error)
    }

    importButton.disabled = false
  }
}
