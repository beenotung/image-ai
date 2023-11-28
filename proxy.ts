import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type Image = {
  id?: null | number
  filename: string
}

export type Tag = {
  id?: null | number
  name: string
}

export type ImageTag = {
  id?: null | number
  image_id: number
  image?: Image
  tag_id: number
  tag?: Tag
}

export type DBProxy = {
  image: Image[]
  tag: Tag[]
  image_tag: ImageTag[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    image: [],
    tag: [],
    image_tag: [
      /* foreign references */
      ['image', { field: 'image_id', table: 'image' }],
      ['tag', { field: 'tag_id', table: 'tag' }],
    ],
  },
})
