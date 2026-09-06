import { useEffect, useRef, useState } from 'react';
import { RESIDENT, type RoomConfig, type RoomItemId } from './room';
import { approachFurniture, roomPath, type Cell, type RoomActor } from './room-life';

export function useRoomLife(room:RoomConfig,onArrive:(id:RoomItemId)=>void,onBlocked:()=>void) {
  const [actor,setActor]=useState<RoomActor>({...RESIDENT,pose:'stand'});
  const position=useRef<Cell>({...RESIDENT}),timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const clear=()=>{if(timer.current)clearInterval(timer.current);timer.current=null;};
  useEffect(()=>()=>{if(timer.current)clearInterval(timer.current);},[]);
  const travel=(target:Cell|RoomItemId)=>{
    const route=typeof target==='string'?approachFurniture(room,position.current,target):roomPath(room,position.current,target);
    clear();
    if(route===null){setActor({...position.current,pose:'stand',walking:false});onBlocked();return false;}
    let index=0,frame=0;let start={...position.current};
    const finish=()=>{clear();setActor({...position.current,pose:'stand',walking:false});if(typeof target==='string')onArrive(target);};
    if(!route.length){finish();return true;}
    setActor({...start,pose:'stand',walking:true});
    timer.current=setInterval(()=>{frame++;const next=route[index],ratio=Math.min(1,frame/10);setActor({x:start.x+(next.x-start.x)*ratio,y:start.y+(next.y-start.y)*ratio,walking:true,pose:'stand'});
      if(frame===10){position.current={...next};start={...next};frame=0;index++;if(index===route.length)finish();}
    },24);return true;
  };
  const reset=()=>{clear();position.current={...RESIDENT};setActor({...RESIDENT,pose:'stand'});};
  const pose=(value:RoomActor['pose'],activeItem?:RoomItemId)=>setActor({...position.current,pose:value,activeItem,walking:false});
  return {actor,travel,reset,pose};
}
