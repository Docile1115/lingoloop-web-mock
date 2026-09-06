import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeData } from './home';
import { t } from './i18n/core';

export type HomeRequest = <T>(path:string, init?:RequestInit)=>Promise<T>;
export function useHome(ownerId:string, request:HomeRequest) {
  const [data,setData]=useState<HomeData|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const alive=useRef(true),writing=useRef(false),generation=useRef(0);
  const path=`/api/homes/${encodeURIComponent(ownerId)}`;
  const reload=useCallback(async()=>{
    const ticket=++generation.current;
    try {const value=await request<HomeData>(path); if(alive.current&&ticket===generation.current){setData(value);setError('');}}
    catch(caught){if(alive.current&&ticket===generation.current){setData(null);setError(caught instanceof Error?caught.message:t("요청을 처리하지 못했어요."));}}
    finally{if(alive.current&&ticket===generation.current)setLoading(false);}
  },[path,request]);
  // Callers key the house by ownerId, so drafts and initial state never cross homes.
  // reload updates state only after the external API promise settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{alive.current=true;void reload();return()=>{alive.current=false;};},[reload]);
  const act=async(suffix:string,method:string,body?:unknown)=>{
    if(writing.current)return false;
    writing.current=true;setBusy(true);setError('');
    try {await request(path+suffix,{method,body:body===undefined?undefined:JSON.stringify(body)});if(alive.current)await reload();return true;}
    catch(caught){if(alive.current)setError(caught instanceof Error?caught.message:t("요청을 처리하지 못했어요."));return false;}
    finally{writing.current=false;if(alive.current)setBusy(false);}
  };
  return {data,error,loading,busy,reload,act};
}
