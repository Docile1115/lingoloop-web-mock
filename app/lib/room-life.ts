import { normalizeRoom, roomPoint, type RoomConfig, type RoomItemId } from './room';
export type Cell={x:number;y:number};
export type RoomActor=Cell & {walking?:boolean;pose?:'stand'|'sit'|'sleep'|'dance';activeItem?:RoomItemId|null};
export function walkable(room:RoomConfig,cell:Cell) {
  return Number.isInteger(cell.x)&&Number.isInteger(cell.y)&&cell.x>=0&&cell.y>=0&&cell.x<5&&cell.y<5&&!room.items.some(item=>item.id!=='rug'&&item.x===cell.x&&item.y===cell.y);
}
/** Breadth-first path avoids furniture. Empty array means already at the destination; null means blocked. */
export function roomPath(room:RoomConfig,start:Cell,target:Cell):Cell[]|null {
  if(!walkable(room,start)||!walkable(room,target))return null;
  const queue:Cell[][]=[[start]],seen=new Set([`${start.x},${start.y}`]);
  while(queue.length){const route=queue.shift()!,last=route[route.length-1];if(last.x===target.x&&last.y===target.y)return route.slice(1);
    for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const next={x:last.x+dx,y:last.y+dy},key=`${next.x},${next.y}`;if(walkable(room,next)&&!seen.has(key)){seen.add(key);queue.push([...route,next]);}}
  }return null;
}
export function approachFurniture(room:RoomConfig,start:Cell,id:RoomItemId):Cell[]|null {
  const item=room.items.find(row=>row.id===id);if(!item)return null;
  const targets=item.id==='rug'?[item]:[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>({x:item.x+dx,y:item.y+dy}));
  const paths=targets.map(target=>roomPath(room,start,target)).filter((path):path is Cell[]=>path!==null);
  return paths.sort((a,b)=>a.length-b.length)[0]??null;
}
/** Native uses the same back-to-front painter order as the SVG; rugs never steal floor taps. */
export function hitRoomItem(value:unknown,point:Cell,includeRugs=false):RoomItemId|null {
  const bounds:Record<RoomItemId,[number,number,number]>={sofa:[59,79,20],bed:[53,92,18],desk:[50,92,2],shelf:[32,111,4],plant:[32,112,9],lamp:[33,111,8],rug:[62,28,28],table:[42,52,8],cat:[38,40,10],speaker:[26,61,6],cushion:[32,30,12],flowers:[26,72,7],whiteboard:[48,110,5],frame:[38,105,5],frame2:[38,105,5],frame3:[38,105,5]};
  const items=normalizeRoom(value).items.filter(item=>includeRugs||item.id!=='rug').sort((a,b)=>(b.id==='rug'?-1:b.x+b.y)-(a.id==='rug'?-1:a.x+a.y));
  return items.find(item=>{const p=roomPoint(item.x,item.y),[halfWidth,top,bottom]=bounds[item.id];return Math.abs(point.x-p.x)<=halfWidth&&point.y>=p.y-top&&point.y<=p.y+bottom;})?.id??null;
}
