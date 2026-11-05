import { IS_MOBILE } from '../config'

export async function downloadFile(blob,name) {
    if(IS_MOBILE) {const {saveNativeFile}=await import('../mobile/nativeFiles');await saveNativeFile(blob,name);return}
    const {saveAs}=await import('file-saver');saveAs(blob,name)
}
