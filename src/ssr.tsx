import * as functions from 'firebase-functions'
// import React from 'react'
import express from 'express'
import { renderToString } from 'react-dom/server'

// import App from 'domains/application/screens/App'

const app = express()
app.get('**', (req, res) => {
  // const html = renderToString(<App />)
  res.set('Cache-Control', 'public, max-age=600, s-maxage=1200')
  res.send('hello world')
})

export let ssrapp = functions.https.onRequest(app)
