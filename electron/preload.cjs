'use strict'

const { contextBridge } = require('electron')

/** Minimal bridge — renderer stays a normal web app; no Node APIs exposed. */
contextBridge.exposeInMainWorld('accountingDesktop', {
  isDesktop: true,
})
