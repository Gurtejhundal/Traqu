import { useEffect, useId, useRef, useState } from 'react'
import { Check, Download, Share2, X } from 'lucide-react'
import { CARD_HEADLINES, renderProfileCard } from '../utils/profileCard'
import { downloadFile } from '../utils/downloadFile'
import { IS_MOBILE } from '../config'

export default function ProfileCard({ profile, summary, onClose }) {
    const dialog=useRef(null),canvas=useRef(null),id=useId()
    const [options,setOptions]=useState({style:profile.cover==='paper'?'paper':profile.cover==='stone'?'stone':'ink',headline:'steady',photo:Boolean(profile.avatar),name:true,goal:false})
    const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
    useEffect(()=>{const element=dialog.current;element.showModal();return()=>{element.close()}},[])
    useEffect(()=>{
        let current=true;setReady(false);setError('');setMessage('')
        renderProfileCard(canvas.current,profile,summary,options,()=>current).then(()=>{if(current)setReady(true)}).catch(()=>{if(current)setError('The card could not be drawn. Try hiding the photo or reopening this preview.')})
        return()=>{current=false}
    },[profile,summary,options])
    const change=(key,value)=>setOptions(current=>({...current,[key]:value}))
    async function imageFile(){
        const blob=await new Promise(resolve=>canvas.current.toBlob(resolve,'image/png'))
        if(!blob)throw new Error('The card image could not be created. Try again.')
        return new File([blob],`Traqu-profile-${summary.today}.png`,{type:'image/png'})
    }
    async function save(){setBusy(true);setError('');try{const file=await imageFile();await downloadFile(file,file.name);setMessage(IS_MOBILE ? 'Image saved. Attach it to any message.' : 'Image download started. Attach the saved PNG to any message.')}catch(err){setError(err.message)}finally{setBusy(false)}}
    async function share(){
        setBusy(true);setError('')
        try {
            const file=await imageFile()
            if(IS_MOBILE) {const {shareNativeFile}=await import('../mobile/nativeFiles');await shareNativeFile(file,file.name);setMessage('Choose an app and recipient in your device’s share sheet.')}
            else if(navigator.canShare?.({files:[file]})&&navigator.share) {await navigator.share({files:[file],title:'My Traqu rhythm'});setMessage('Your card was shared.')}
            else {await downloadFile(file,file.name);setMessage('Save the PNG, then attach it to any chat or message to share it.')}
        }catch(err){if(err.name!=='AbortError')setError(err.message)}finally{setBusy(false)}
    }
    return <dialog ref={dialog} className="profile-card-dialog" aria-labelledby={id} onCancel={onClose}>
        <header><div><span className="eyebrow">A little keepsake</span><h2 id={id}>Made of small steps.</h2><p>Your photo. Your rhythm. A card worth keeping.</p></div><button type="button" className="btn-icon" aria-label="Close profile card" onClick={onClose}><X size={20} /></button></header>
        <div className="profile-card-workbench"><div className="profile-card-preview"><canvas ref={canvas} role="img" aria-label="Your shareable profile card preview" aria-describedby={`${id}-summary`} /><p id={`${id}-summary`} className="sr-only">{options.name ? profile.name : "Name hidden"}. {summary.current_streak} day streak. {summary.recent_days?.filter(day => day.count > 0).length || 0} active days out of a target of {profile.weekly_goal} in the last seven days. {summary.recent_days?.reduce((sum, day) => sum + day.count, 0) || 0} tasks finished in that period. {options.goal ? profile.goal : "Goal hidden"}.</p>{!ready&&!error&&<p role="status">Making your card…</p>}<p className="profile-card-caption">2400 × 1520 PNG · Actual recorded progress · Ready for your friends</p></div>
            <div className="profile-card-controls"><fieldset disabled={busy}><legend>Make it yours</legend><span className="profile-card-control-label">Card finish</span><div className="card-finish-choices">{[['paper','Paper'],['stone','Stone'],['ink','Ink']].map(([key,label])=><button type="button" key={key} aria-pressed={options.style===key} onClick={()=>change('style',key)}><i className={`sample-${key}`} />{label}{options.style===key&&<Check size={12} />}</button>)}</div><label>Words to keep<select value={options.headline} onChange={event=>change('headline',event.target.value)}>{Object.entries(CARD_HEADLINES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
                {[['name','Show my name',false],['photo','Show my photo',!profile.avatar],['goal','Show my goal',!profile.goal]].map(([key,label,disabled])=><label className="profile-inline-toggle" key={key}><span>{label}</span><input type="checkbox" checked={options[key]} disabled={disabled} onChange={event=>change(key,event.target.checked)} /></label>)}
                <p>Your tasks, notes and private reminder stay off this card. Sharing opens your device’s chooser; you choose who sees it.</p></fieldset>
                {error&&<p className="inline-error" role="alert">{error}</p>}{message&&<p className="profile-card-message" role="status">{message}</p>}
                <button type="button" className="btn-primary" onClick={save} disabled={!ready||busy}><Download size={15} />{busy?'Preparing…':IS_MOBILE?'Save image':'Save to computer'}</button><button type="button" className="btn-secondary" onClick={share} disabled={!ready||busy}><Share2 size={15} />Share with a friend</button>
            </div></div>
    </dialog>
}
