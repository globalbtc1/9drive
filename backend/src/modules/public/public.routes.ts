import { Router } from 'express'
import { google } from 'googleapis'
import { prisma } from '../../config/prisma.js'
import { hashToken } from '../../utils/crypto.js'
import { getAuthedGoogleClient } from '../google/google.service.js'

export const publicRouter = Router()

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
    const auth = await getAuthedGoogleClient(file.connectedAccount)
    const drive = google.drive({ version: 'v3', auth })
    const download = await drive.files.get({ fileId: file.providerFileId, alt: 'media' }, { responseType: 'stream' })
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${file.name.replaceAll('"', '')}"`)
    return download.data.pipe(res)
  } catch (error) {
    return next(error)
  }
})
