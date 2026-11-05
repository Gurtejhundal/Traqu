async function imagePayload(blob) {
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Could not prepare this file.'));reader.readAsDataURL(blob)})
    return data
}

export async function saveNativeFile(blob,name) {
    const {registerPlugin}=await import('@capacitor/core')
    await registerPlugin('TraquFiles').save({name,data:await imagePayload(blob),mime:blob.type || 'application/octet-stream'})
}

export async function shareNativeFile(blob,name) {
    const {registerPlugin}=await import('@capacitor/core')
    await registerPlugin('TraquFiles').share({name,data:await imagePayload(blob)})
}
