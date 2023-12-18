import cors from 'cors'
import express from 'express'
import { print } from 'listening-on'

let app = express()

app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

let port = 8100
app.listen(port, () => {
  print(port)
})
