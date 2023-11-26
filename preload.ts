declare let message: HTMLDivElement

window.addEventListener('DOMContentLoaded', () => {
  message.textContent = new Date() + '\n\n'

  message.textContent +=
    'versions: ' + JSON.stringify(process.versions, null, 2) + '\n\n'

  let filenames = require('fs').readdirSync('.')
  message.textContent += 'filenames: ' + JSON.stringify(filenames, null, 2)
})
