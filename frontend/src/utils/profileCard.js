import { rhythmStats } from './profile.js'

export const CARD_HEADLINES = { steady: 'Still showing up.', small: 'One day at a time.', further: 'A little further.' }

export function fitCardText(context, text, maxWidth, size, minimum = 24, weight = 500) {
    let value = String(text || '')
    context.font = `${weight} ${size}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    while (context.measureText(value).width > maxWidth && size > minimum) { size--; context.font = `${weight} ${size}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` }
    if (context.measureText(value).width > maxWidth) {
        const letters = Array.from(value)
        while (letters.length && context.measureText(letters.join('') + '…').width > maxWidth) letters.pop()
        value = letters.join('') + '…'
    }
    return value
}

async function loadImage(url) {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
}

export async function renderProfileCard(canvas, profile, summary, options, isCurrent = () => true) {
    const sources = [loadImage('/traqu-mark.svg'), loadImage('/characters/qu-sprites.png')]
    if (options.photo && profile.avatar) sources.push(loadImage(profile.avatar))
    const [logo, qu, portrait] = await Promise.all(sources)
    if (!isCurrent()) return
    canvas.width = 2400; canvas.height = 1520
    const c = canvas.getContext('2d'); c.scale(2,2)
    const dark = options.style === 'ink'
    const ink = dark ? '#fafaf7' : '#222220', muted = dark ? '#aaa9a2' : '#73736d', line = dark ? '#42423d' : '#dcdcd5'
    c.fillStyle = dark ? '#222321' : options.style === 'stone' ? '#e8e7df' : '#f7f7f2'; c.fillRect(0,0,1200,760)
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(58,48,42,42,10); c.fill(); c.drawImage(logo,62,52,34,34)
    c.fillStyle = ink; c.font = '600 18px sans-serif'; c.fillText('traqu',114,76)
    c.fillStyle = muted; c.font = '12px sans-serif'; c.textAlign = 'right'; c.fillText('A RECORD OF SHOWING UP',1142,75); c.textAlign = 'left'
    if (options.photo && portrait) {
        c.save();c.beginPath();if(profile.avatar_shape==='rounded')c.roundRect(60,130,78,78,20);else c.arc(99,169,39,0,Math.PI*2);c.clip()
        if(profile.avatar_monochrome)c.filter='grayscale(1)'
        c.drawImage(portrait,60,130,78,78);c.restore()
    }
    const nameX = options.photo && portrait ? 158 : 60
    if (options.name) { c.fillStyle = ink; c.fillText(fitCardText(c,profile.name,790-nameX,29,20,600),nameX,167) }
    c.fillStyle = muted; c.font = '16px sans-serif'; c.fillText('MY PERSONAL RHYTHM',nameX,198)
    c.fillStyle = ink; c.fillText(fitCardText(c,CARD_HEADLINES[options.headline],850,66,46,600),60,300)
    if (options.goal && profile.goal) { c.fillStyle = muted; c.fillText(fitCardText(c,profile.goal,850,20,16),60,344) }
    // Original Qu asset, first resting frame. The pale field preserves its ink silhouette.
    c.fillStyle = dark ? '#e4e4dc' : '#ecece5'; c.beginPath();c.arc(1025,263,92,0,Math.PI*2);c.fill()
    c.drawImage(qu,0,0,256,256,937,175,176,176)
    c.strokeStyle=line;c.lineWidth=1;c.beginPath();c.moveTo(60,390);c.lineTo(1140,390);c.stroke()
    const rhythm=rhythmStats(summary.recent_days,profile.weekly_goal)
    const stats=[{x:60,big:String(summary.current_streak),unit:'DAY STREAK',small:`${summary.longest_streak} ${summary.longest_streak === 1 ? 'day' : 'days'} · personal best`},{x:435,big:`${rhythm.active} / ${profile.weekly_goal}`,unit:'ACTIVE DAYS / TARGET',small:'Your last seven days'},{x:845,big:String(rhythm.total),unit:'TASKS FINISHED',small:'Your last seven days'}]
    for (const stat of stats) {
        c.fillStyle=ink;c.fillText(fitCardText(c,stat.big,290,68,40,600),stat.x,492)
        c.fillStyle=muted;c.font='12px sans-serif';c.fillText(stat.unit,stat.x,523);c.font='15px sans-serif';c.fillText(stat.small,stat.x,554)
    }
    c.strokeStyle=line;c.beginPath();c.moveTo(60,592);c.lineTo(1140,592);c.stroke()
    const days=summary.recent_days || []
    for(let index=0;index<days.length;index++) {
        const day=days[index],x=75+index*50
        c.beginPath();c.arc(x,638,13,0,Math.PI*2);c.fillStyle=day.count ? ink : (dark?'#3b3c38':'#e1e1da');c.fill()
        c.fillStyle=muted;c.font='11px sans-serif';c.textAlign='center';c.fillText(day.date.slice(-2),x,675)
    }
    c.textAlign='right';c.fillStyle=ink;c.font='16px sans-serif';c.fillText(rhythm.active ? 'Small steps. Real progress.' : 'Every beginning counts.',1140,635)
    c.fillStyle=muted;c.font='13px sans-serif';c.fillText(`${days[0]?.date || summary.today} — ${summary.today}`,1140,665)
    c.textAlign='left';c.fillStyle=muted;c.font='11px sans-serif';c.fillText('RECORDED ACTIVITY · MADE WITH TRAQU',60,719)
    c.textAlign='right';c.fillText('ONE SMALL STEP. THEN ANOTHER.',1140,719);c.textAlign='left'
}
