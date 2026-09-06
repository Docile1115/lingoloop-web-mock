import type { ApiProfile } from './live-data';
import type { RoomConfig } from './room';
import type { Room3DConfig } from './room3d/config';

export const HOME_SCOPES = ['everyone','followers','mutuals','private'] as const;
export const HOME_STATUSES = ['available','studying','voice','resting'] as const;
export const HOME_FRAMES = ['frame','frame2','frame3'] as const;
export const HOME_GIFTS = ['wave','flower','postcard','cookie'] as const;
export const HOME_GIFT_ICONS = {wave:'👋',flower:'🌷',postcard:'💌',cookie:'🍪'};
export type HomeScope = typeof HOME_SCOPES[number];
export type HomeSettings = {visibility:HomeScope;writing:HomeScope;showVisitors:boolean;status:typeof HOME_STATUSES[number];question:string;pinnedId:string;displayedGiftId:string};
export type HomeEntry = {id:string;authorId:string;author:ApiProfile|null;kind:'guestbook'|'answer';text:string;question:string;createdAt:string;heartCount:number;hearted:boolean;reply:{authorId:string;author:ApiProfile|null;text:string;createdAt:string}|null};
export type HomePhoto = {id:typeof HOME_FRAMES[number];image:string;caption:string;visibility:HomeScope;shape:'square'|'portrait'|'landscape';color:'oak'|'white'|'black'|'rose'};
export type HomeStamp = {id:string;authorId:string;author:ApiProfile|null;gift:typeof HOME_GIFTS[number];note:string;day:string;createdAt:string};
export type HomeData = {viewerId:string;owner:ApiProfile;roomConfig:RoomConfig|null;room3d?:Room3DConfig|null;room3dRevision?:number;settings:HomeSettings;own:boolean;canWrite:boolean;favorite:boolean;stampedToday:boolean;photos:HomePhoto[];entries:HomeEntry[];visitors:HomeStamp[];displayedGift:HomeStamp|null;nextCursor:string|null};
export type HomeDirectory = {items:{owner:ApiProfile;status:HomeSettings['status']}[];nextCursor:string|null};
