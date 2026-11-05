export const PHOTO_LIMIT = 8 * 1024 * 1024

export function cropGeometry(width, height, zoom = 1, x = 50, y = 50) {
    const side = Math.min(width, height) / Math.max(1, zoom)
    return { sx: (width - side) * x / 100, sy: (height - side) * y / 100, side }
}

export async function preparePhoto(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.')
    if (file.size > PHOTO_LIMIT) throw new Error('Choose a photo smaller than 8 MB.')
    const image = await createImageBitmap(file)
    if (image.width > 12000 || image.height > 12000 || image.width * image.height > 40000000) { image.close(); throw new Error('Choose a smaller photo (up to 40 megapixels).') }
    return image
}

export function drawCrop(canvas, image, zoom, x, y) {
    const { sx, sy, side } = cropGeometry(image.width, image.height, zoom, x, y)
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 256, 256)
    context.drawImage(image, sx, sy, side, side, 0, 0, 256, 256)
}

export function rhythmStats(days = [], target = 5) {
    const active = days.filter(day => day.count > 0).length
    return { active, total: days.reduce((sum, day) => sum + day.count, 0), percent: Math.min(100, Math.round(active / target * 100)) }
}
