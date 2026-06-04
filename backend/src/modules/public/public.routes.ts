import { Router } from 'express'
import { prisma } from '../../config/prisma.js'
import { hashToken } from '../../utils/crypto.js'
import { streamGoogleFile } from '../files/stream-google-file.js'

export const publicRouter = Router()

function contentDisposition(type: 'inline' | 'attachment', fileName: string) {
  return `${type}; filename="${fileName.replaceAll('"', '')}"`
}

async function findSharedFile(token: string) {
  const share = await prisma.fileShare.findFirst({
    where: { tokenHash: hashToken(token), enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { file: { include: { connectedAccount: true } } },
  })
  if (!share || share.file.status !== 'active') throw new Error('Shared file not found')
  return share.file
}

publicRouter.get('/files/:token', async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token))
    return res.json({ file: { id: file.id, name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes.toString(), createdAt: file.createdAt } })
  } catch (error) {
    return next(error)
  }
})

publicRouter.get('/files/:token/download', async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token))
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', contentDisposition('attachment', file.name))
    return streamGoogleFile(file, req.headers.range, res)
  } catch (error) {
    return next(error)
  }
})

publicRouter.get('/files/:token/preview', async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token))
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', contentDisposition('inline', file.name))
    return streamGoogleFile(file, req.headers.range, res)
  } catch (error) {
    return next(error)
  }
})
