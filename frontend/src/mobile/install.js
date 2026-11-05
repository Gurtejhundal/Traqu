import axios, { AxiosError, CanceledError } from 'axios'
import { prepareRequest, requestWorkspace } from './workspace.js'

export function installMobileWorkspace() {
    axios.defaults.adapter = async config => {
        const url=new URL(config.url,'https://localhost'),path=url.pathname.replace(/^\/api/,'') || '/'
        const params={...Object.fromEntries(url.searchParams),...config.params}
        let body=config.data
        if(typeof body==='string') {try{body=JSON.parse(body)}catch{throw new AxiosError('Invalid request body.','ERR_BAD_REQUEST',config)}}
        try {
            if(config.signal?.aborted)throw new CanceledError()
            const prepared=await prepareRequest(config.method,path,body)
            if(config.signal?.aborted)throw new CanceledError()
            const data=await requestWorkspace(config.method,path,prepared.body,params,prepared)
            return {data,status:200,statusText:'OK',headers:{},config}
        } catch(error) {
            if(axios.isCancel(error))throw error
            throw new AxiosError(error.message,'ERR_BAD_RESPONSE',config,null,{data:{detail:error.message},status:error.status||400,statusText:'Workspace error',headers:{},config})
        }
    }
}
