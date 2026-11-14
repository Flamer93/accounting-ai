'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/** Minimal bridge — durable storage mirrors localStorage into userData. */
contextBridge.exposeInMainWorld('accountingDesktop', {
  isDesktop: true,
  storageGetAll: () => ipcRenderer.invoke('desktop-storage:get-all'),
  storageSet: (key, value) => ipcRenderer.invoke('desktop-storage:set', key, value),
  storageRemove: (key) => ipcRenderer.invoke('desktop-storage:remove', key),
  storageReplaceAll: (data) => ipcRenderer.invoke('desktop-storage:replace-all', data),
  storageFlush: () => ipcRenderer.invoke('desktop-storage:flush'),
  onFlushRequest: (cb) => {
    const handler = () => {
      try {
        cb()
      } catch {
        /* ignore */
      }
    }
    ipcRenderer.on('desktop-storage:request-flush', handler)
    return () => ipcRenderer.removeListener('desktop-storage:request-flush', handler)
  },
})
