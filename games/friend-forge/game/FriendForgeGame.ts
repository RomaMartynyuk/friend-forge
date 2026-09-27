// @ts-nocheck
import { GAME_MARKUP } from "./GameMarkup";
import { artifactArtwork, artifactSilhouette } from "./ArtifactArtwork";
import { artifactRewardRf } from "./SdkEconomy";
import { mountCommunityFurnaceArcade } from "./CommunityFurnaceArcade";
import { mountMiningDig } from "./MiningDig";
import { createWorldVfx, mountUiVfx } from "./GlobalVfx";
import type { SoundAccent, SoundScene } from "./SoundAtmosphere";
import {
  FORGE_MATERIALS,
  FORGE_RARITIES,
  forgeOddsPercent,
} from "./ForgeMaterials";

export type FriendSpriteFacing = "down" | "up" | "left" | "right";

export type FriendSpriteFrame = Readonly<{
  bitmap: bigint;
  rows: readonly string[];
}>;

export type FriendGenerationSprites = Readonly<{
  tokenId: bigint;
  familyId: number;
  familyName: string;
  clips: Readonly<{
    idle: Readonly<Record<FriendSpriteFacing, readonly FriendSpriteFrame[]>>;
    walk: Readonly<Record<FriendSpriteFacing, readonly FriendSpriteFrame[]>>;
  }>;
}>;

export type FriendSoundCue =
  | "select"
  | "purchase"
  | "action-start"
  | "action-ready"
  | "anticipation"
  | "impact"
  | "reveal-common"
  | "reveal-rare"
  | "reveal-legendary"
  | "reward";

export type FriendSoundBridge = Readonly<{
  play: (cue: FriendSoundCue, volume?: number) => boolean;
  accent?: (accent: SoundAccent, volume?: number) => boolean;
  setScene?: (scene: SoundScene) => void;
  ensureUnlocked: () => Promise<boolean>;
  stop: () => void;
}>;

export type FriendForgeEconomyState = Readonly<{
  mode: "preview" | "chain";
  rf: number;
  ore: number;
  inventory: Readonly<Record<string, number>>;
  totalForges: number;
  pendingPlayId: bigint | null;
}>;

export type FriendForgeEconomyBridge = Readonly<{
  initial: FriendForgeEconomyState;
  read(): Promise<FriendForgeEconomyState>;
  buy(quantity: number): Promise<FriendForgeEconomyState>;
  redeem(artifactId: string, quantity: number): Promise<FriendForgeEconomyState>;
  forge(): Promise<
    | Readonly<{
        status: "pending";
        playId: bigint;
        state: FriendForgeEconomyState;
      }>
    | Readonly<{
        status: "settled";
        artifact: Readonly<{
          id: string;
          name: string;
          rarity: string;
          icon: string;
          desc: string;
        }>;
        playId: bigint;
        outcomeId: number;
        duplicate: boolean;
        state: FriendForgeEconomyState;
      }>
  >;
}>;

export type FriendForgeCanonicalWorldProp = Readonly<{
  dataUrl: string;
  sourceIndex: number;
}>;

export type FriendForgeMountOptions = {
  friendId: bigint;
  sprites: FriendGenerationSprites | null;
  getPaused: () => boolean;
  sounds?: FriendSoundBridge;
  economy: FriendForgeEconomyBridge;
  islandSeed: number;
  canonicalProps: readonly FriendForgeCanonicalWorldProp[];
};

export type FriendForgeController = {
  destroy: () => void;
};

export function mountFriendForge(
  root: HTMLElement,
  options: FriendForgeMountOptions
): FriendForgeController {
  const friendId = options.friendId;
  const friendSprites = options.sprites;
  const isPaused = options.getPaused;
  const sounds = options.sounds;
  const economy = options.economy;
  const islandSeed = options.islandSeed >>> 0;
  const canonicalProps = options.canonicalProps ?? [];

  const playFriendSound=(cue:FriendSoundCue,volume=1)=>{
    try{
      return sounds?.play(cue,volume) ?? false;
    }catch{
      return false;
    }
  };

  const unlockFriendSound=()=>{
    try{
      return sounds?.ensureUnlocked() ?? Promise.resolve(false);
    }catch{
      return Promise.resolve(false);
    }
  };

  root.innerHTML = GAME_MARKUP;
  root.querySelector(".brandline b").textContent="FRIEND FORGE · v1.0";
  // Building windows belong to the page, not the clipped 16:9 island stage.
  const appFrame=root.querySelector(".app");
  const modalObservers=[];
  for(const id of ["oreModal","forgeModal","collectionModal","reforgeModal","communityFurnaceModal","revealModal"]){
    const modal=root.querySelector(`#${id}`);
    if(!modal)continue;
    appFrame.append(modal);
    let wasOpen=modal.classList.contains("show");
    const observer=new MutationObserver(()=>{
      const isOpen=modal.classList.contains("show");
      if(isOpen&&!wasOpen){
        modal.scrollTop=0;
        const card=modal.querySelector(".building-card,.reveal-card");
        if(card)card.scrollTop=0;
      }
      wasOpen=isOpen;
    });
    observer.observe(modal,{attributes:true,attributeFilter:["class"]});
    modalObservers.push(observer);
  }
  const uiVfx=mountUiVfx(root,isPaused);
  const sceneFromMenus=()=>{
    const shown=(id)=>root.querySelector(`#${id}`)?.classList.contains("show");
    const mineOpen=root.querySelector(".mining-dig-overlay:not([hidden])");
    sounds?.setScene?.(mineOpen?"mine":shown("communityFurnaceModal")?"furnace":shown("reforgeModal")?"reforge":shown("collectionModal")?"collection":shown("forgeModal")?"forge":shown("oreModal")?"mine":"island");
  };
  const sceneObserver=new MutationObserver(sceneFromMenus);
  sceneObserver.observe(root,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
  root.addEventListener("pointerover",event=>{
    if((event.target as HTMLElement)?.closest?.("button") && !isPaused())sounds?.accent?.("hover",.6);
  });
  const worldVfx=createWorldVfx(islandSeed);
  const reducedVfx=window.matchMedia("(prefers-reduced-motion: reduce)");

  const seededRandom=(()=>{
    let state=islandSeed || 1;

    return ()=>{
      state+=0x6D2B79F5;
      let t=state;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  })();

  const seedPalette=[
    ["#ff917f","#f7c86f","#9fd6e8"],
    ["#a985e8","#ff9dbb","#b9dc7d"],
    ["#70cbb8","#f5dc82","#a7c8ff"],
    ["#ff9e76","#c3a8ff","#8fd5c8"]
  ];

  const seedVariant=islandSeed%seedPalette.length;
  const seedColors=seedPalette[seedVariant];

  const app=root.querySelector(".app");
  const stage=root.querySelector(".stage");

  if(app){
    app.dataset.islandVariant=String(seedVariant+1);
    app.style.setProperty("--seed-a",seedColors[0]);
    app.style.setProperty("--seed-b",seedColors[1]);
    app.style.setProperty("--seed-c",seedColors[2]);
  }

  // Existing flowers remain the same artwork, but every Friend gets a
  // deterministic micro-layout. They remain non-interactive and collisionless.
  root.querySelectorAll(".decor-flower").forEach((flower,index)=>{
    const dx=Math.round((seededRandom()-.5)*12);
    const dy=Math.round((seededRandom()-.5)*8);
    const scale=.9+seededRandom()*.16;
    const opacity=.84+seededRandom()*.16;

    flower.style.setProperty("--seed-dx",`${dx}px`);
    flower.style.setProperty("--seed-dy",`${dy}px`);
    flower.style.setProperty("--seed-scale",scale.toFixed(3));
    flower.style.opacity=opacity.toFixed(3);
    flower.dataset.seedFlower=String(index);
  });

  // Small Friend Forge pennant: this is our own island personalization,
  // intentionally separate from SDK canonical props.
  if(stage){
    const pennant=document.createElement("div");
    pennant.className="seed-pennant";
    pennant.setAttribute("aria-hidden","true");
    pennant.title=`Island seed 0x${islandSeed.toString(16).padStart(8,"0")}`;

    for(const color of seedColors){
      const stripe=document.createElement("span");
      stripe.style.background=color;
      pennant.appendChild(stripe);
    }

    stage.appendChild(pennant);
  }

  const canonicalPropLayers=[];

  const canonicalSlots=[
    {x:331,y:307,w:36,depth:304},
    {x:946,y:333,w:38,depth:331},
    {x:1024,y:527,w:34,depth:524},
    {x:414,y:578,w:32,depth:576},
    {x:736,y:565,w:34,depth:562},
    {x:165,y:456,w:31,depth:453}
  ];

  if(stage && canonicalProps.length){
    const slotOrder=canonicalSlots
      .map((slot,index)=>({slot,index,rank:seededRandom()}))
      .sort((a,b)=>a.rank-b.rank);

    canonicalProps.slice(0,4).forEach((prop,index)=>{
      const chosen=slotOrder[index%slotOrder.length].slot;
      const img=document.createElement("img");

      img.className="canonical-world-prop";
      img.src=prop.dataUrl;
      img.alt="";
      img.setAttribute("aria-hidden","true");
      img.dataset.canonicalProp=String(prop.sourceIndex);
      img.decoding="async";
      img.addEventListener("error",()=>img.remove(),{once:true});

      const scale=.88+seededRandom()*.24;
      const x=chosen.x+Math.round((seededRandom()-.5)*14);
      const y=chosen.y+Math.round((seededRandom()-.5)*10);

      img.style.left=`${x/12.8}%`;
      img.style.top=`${y/7.2}%`;
      img.style.width=`${Math.round(chosen.w*scale)/12.8}%`;

      stage.appendChild(img);

      canonicalPropLayers.push({
        el:img,
        depthY:chosen.depth
      });
    });
  }

  let destroyed=false;
  let rafId=0;


const terrainCanvas=root.querySelector("#terrain");
const terrainCtx=terrainCanvas.getContext("2d");
const canvas=root.querySelector("#world");
const ctx=canvas.getContext("2d");
const oreMineSprite=root.querySelector(".ore-mine-sprite");
const centralForgeLayer=root.querySelector("#centralForgeLayer");
const centralForgeLabel=root.querySelector("#centralForgeLabel");
const reforgeLayer=root.querySelector("#reforgeLayer");
const reforgeLabel=root.querySelector("#reforgeLabel");
const collectionLayer=root.querySelector("#collectionLayer");
const collectionLabel=root.querySelector("#collectionLabel");
const communityFurnaceLayer=root.querySelector("#communityFurnaceLayer");
const communityFurnaceLabel=root.querySelector("#communityFurnaceLabel");
const treeA=root.querySelector("#treeA");
const treeB=root.querySelector("#treeB");
const treeC=root.querySelector("#treeC");
const treeD=root.querySelector("#treeD");
terrainCtx.imageSmoothingEnabled=false;

ctx.imageSmoothingEnabled=false;

const blockWhilePaused=(event)=>{
  if(!isPaused())return;
  event.preventDefault();
  event.stopPropagation();
};
root.addEventListener("click",blockWhilePaused,true);
root.addEventListener("pointerdown",blockWhilePaused,true);

const unlockAudioGesture=()=>{
  void unlockFriendSound();
};
root.addEventListener("pointerdown",unlockAudioGesture,{capture:true,once:true});
root.addEventListener("keydown",unlockAudioGesture,{capture:true,once:true});


let ACTIVE_CTX=terrainCtx;

const P={
  bg:"#efefed",
  ink:"#131313",
  grass:"#b9dc7d",
  grassDark:"#8fb45b",
  edge:"#ef917d",
  edgeDark:"#d87968",
  bridge:"#efd28a",
  bridgeLight:"#f8e6ae",
  white:"#fff"
};

const VIEW={w:1280,h:720};
const SPEED=250;
const FRIEND_R=9.5;

// Top surface only. Shape deliberately mirrors the reference:
// broad back edge, long front face, front-center bridge notch.
const ISLAND=[
  // upper-left shoulder with a small outward bump
  {x:72,y:352},
  {x:118,y:316},
  {x:151,y:286},
  {x:198,y:292},   // tiny convex shelf
  {x:244,y:255},

  // uneven back ridge
  {x:322,y:234},
  {x:388,y:242},   // subtle inward dip
  {x:452,y:215},
  {x:530,y:220},   // slight step
  {x:606,y:202},
  {x:688,y:214},
  {x:754,y:207},   // small ridge peak
  {x:826,y:228},

  // upper-right shoulder
  {x:897,y:236},
  {x:946,y:268},
  {x:1004,y:276},  // outward bump
  {x:1057,y:303},
  {x:1104,y:345},

  // right edge with a real indentation / bay
  {x:1138,y:381},
  {x:1125,y:419},
  {x:1092,y:430},  // inward notch
  {x:1120,y:458},  // comes back out
  {x:1090,y:492},
  {x:1041,y:505},  // another small recess
  {x:1012,y:542},

  // lower-right front
  {x:955,y:555},
  {x:912,y:584},
  {x:846,y:586},   // flattened shelf
  {x:790,y:614},

  // right side of bridge notch
  {x:720,y:606},
  {x:694,y:586},
  {x:669,y:574},

  // front-center-left
  {x:627,y:590},
  {x:580,y:586},   // tiny inward dent
  {x:542,y:601},
  {x:493,y:596},
  {x:452,y:611},   // subtle forward bump
  {x:404,y:602},

  // front-left irregular shelf
  {x:351,y:585},
  {x:305,y:590},   // outward bump
  {x:258,y:566},
  {x:219,y:558},
  {x:184,y:530},
  {x:145,y:522},   // little shelf
  {x:116,y:491},

  // left edge with shallow concavity
  {x:92,y:470},
  {x:98,y:442},    // inward nick
  {x:74,y:416},
  {x:83,y:388}
];

// Bridge top polygon. It overlaps the island slightly so there is no gap at the threshold.
const BRIDGE=[
  {x:570,y:573},
  {x:695,y:573},
  {x:717,y:720},
  {x:548,y:720}
];

const ORE_MINE={
  center:{x:266,y:459},
  reach:88,

  // If Friend's feet are at/below this line, he is in FRONT of the Mine.
  depthY:452,

  // Lowered collider: follows the actual mound/cart footprint better.
  collision:{x:181,y:365,w:169,h:92}
};



const REFORGE={
  center:{x:401,y:341},
  reach:82,

  // Reforge sits a little farther back on the island.
  depthY:361,

  collisionParts:[
    {x:348,y:269,w:112,h:83},
    {x:334,y:319,w:30,h:42},
    {x:446,y:315,w:38,h:48}
  ]
};
const CENTRAL_FORGE={
  center:{x:560,y:486},
  reach:86,

  // Switch to foreground earlier than before.
  depthY:468,

  collisionParts:[
    {x:493,y:392,w:150,h:46},
    {x:474,y:419,w:34,h:77},
    {x:628,y:412,w:46,h:86},
    {x:501,y:435,w:135,h:34},
    {x:505,y:466,w:40,h:41},
    {x:543,y:464,w:57,h:35},
    {x:596,y:466,w:44,h:43}
  ]
};



const COMMUNITY_FURNACE={
  center:{x:715,y:187},
  reach:145,

  // Same scale and depth, shifted farther right.
  depthY:237,

  collisionParts:[
    // tower body
    {x:643,y:80,w:151,h:215},

    // left fenced plot
    {x:561,y:208,w:103,h:65},

    // right fenced plot
    {x:781,y:201,w:109,h:73},

    // front fence / sandy plot lip
    {x:592,y:276,w:275,h:42}
  ]
};

const DECOR_TREES=[
  // depthY = visual ground line at the base of each trunk.
  // player.y >= depthY => Friend is in FRONT, so tree goes behind.
  {el:treeA, depthY:333},
  {el:treeB, depthY:321},
  {el:treeC, depthY:513},
  {el:treeD, depthY:485}
];
const COLLECTION={
  center:{x:842,y:500},
  reach:94,

  // Front of the Collection starts earlier than the old 536 threshold.
  depthY:482,

  collisionParts:[
    {x:756,y:395,w:184,h:52},
    {x:752,y:435,w:22,h:78},
    {x:905,y:415,w:91,h:96},
    {x:775,y:486,w:190,h:24}
  ]
};


const ITEMS=[
  {id:"rusty-spoon",name:"Rusty Spoon",rarity:"common",icon:"🥄",weight:16.6666667,desc:"Not heroic. Still technically forgeable."},
  {id:"bent-dagger",name:"Bent Dagger",rarity:"common",icon:"🗡️",weight:16.6666667,desc:"It points in approximately the right direction."},
  {id:"old-pickaxe",name:"Old Pickaxe",rarity:"common",icon:"⛏️",weight:16.6666666,desc:"A miner's relic that somehow survived another forge."},
  {id:"knight-sword",name:"Knight Sword",rarity:"uncommon",icon:"⚔️",weight:13.5,desc:"A clean blade for a Friend with serious intentions."},
  {id:"friend-shield",name:"Friend Shield",rarity:"uncommon",icon:"🛡️",weight:13.5,desc:"Built to protect the Friend standing next to you."},
  {id:"crystal-blade",name:"Crystal Blade",rarity:"rare",icon:"💎",weight:7,desc:"A sharp crystal edge humming with island energy."},
  {id:"moon-hammer",name:"Moon Hammer",rarity:"rare",icon:"🔨",weight:7,desc:"Heavy enough to leave a crater in the night shift."},
  {id:"neon-katana",name:"Neon Katana",rarity:"epic",icon:"⚡",weight:3,desc:"A bright blade that looks faster than your ping."},
  {id:"arcane-staff",name:"Arcane Staff",rarity:"epic",icon:"✦",weight:3,desc:"A strange staff tuned to the Forge's oldest frequency."},
  {id:"golden-friend-hammer",name:"Golden Friend Hammer",rarity:"legendary",icon:"🔨",weight:1.25,desc:"The premium hammer. Unnecessarily shiny. Completely worth it."},
  {id:"celestial-blade",name:"Celestial Blade",rarity:"legendary",icon:"✧",weight:1.25,desc:"Forged from something the Ore Mine definitely did not disclose."},
  {id:"the-first-hammer",name:"The First Hammer",rarity:"mythic",icon:"◆",weight:.5,desc:"The chase artifact. The hammer every Friend wants to find first."}
];

const RARITY_LABELS={
  common:"Common",
  uncommon:"Uncommon",
  rare:"Rare",
  epic:"Epic",
  legendary:"Legendary",
  mythic:"Mythic"
};

// FriendSDK is the source of truth. This is only the canvas/UI mirror.
let gameState={
  rf:Math.max(0,Number(economy.initial.rf||0)),
  ore:Math.max(0,Math.floor(Number(economy.initial.ore||0))),
  inventory:{...economy.initial.inventory},
  totalForges:Math.max(0,Math.floor(Number(economy.initial.totalForges||0))),
  spentRF:0,
  lastItemId:null
};

let rf=gameState.rf;
let ore=gameState.ore;
let pendingPlayId=economy.initial.pendingPlayId ?? null;
let forgeBusy=false;
let economyBusy=false;
let lastForgedItem=null;
// FriendSDK exposes inventory counts but no historical acquisition timestamps.
// Dates recorded here are explicitly limited to this live session.
const collectionSessionDates=new Map();

function applyEconomyState(next){
  rf=Math.max(0,Number(next?.rf||0));
  ore=Math.max(0,Math.floor(Number(next?.ore||0)));

  const source=next?.inventory && typeof next.inventory==="object"
    ? next.inventory
    : {};
  const inventory={};

  for(const item of ITEMS){
    const count=Number(source[item.id]||0);
    inventory[item.id]=Number.isFinite(count) && count>0
      ? Math.floor(count)
      : 0;
  }

  gameState={
    ...gameState,
    rf,
    ore,
    inventory,
    totalForges:Number.isFinite(Number(next?.totalForges))
      ? Math.max(0,Math.floor(Number(next.totalForges)))
      : Object.values(inventory).reduce((sum,count)=>sum+Number(count||0),0)
  };

  pendingPlayId=next?.pendingPlayId ?? null;
}

function saveGameState(){
  // Session mirror only; no browser persistence and no client authority.
  gameState.rf=rf;
  gameState.ore=ore;
}

function inventoryCount(itemId){
  return Number(gameState.inventory[itemId]||0);
}

function discoveredCount(){
  return ITEMS.filter(item=>inventoryCount(item.id)>0).length;
}

function totalItemCopies(){
  return ITEMS.reduce((sum,item)=>sum+inventoryCount(item.id),0);
}


// Spawn on bridge near island entrance.
let player={x:633,y:649};
let target=null;

let friendFacing:FriendSpriteFacing="down";
let friendLastSide:"left"|"right"="right";
let friendWalking=false;
const FRIEND_IDLE_FRAME_MS=220;
const FRIEND_WALK_FRAME_MS=110;
const FRIEND_PIXEL_SCALE=4;
const FRIEND_SPRITE_SIZE=16;

type FamilyFxKind =
  | "skeleton" | "mask" | "family" | "cellular" | "asymmetry"
  | "hoverer" | "colossus" | "sparkling" | "hollow" | "none";

const familyFxKind:FamilyFxKind=(()=>{
  const name=(friendSprites?.familyName ?? "").toLowerCase();
  if(name==="skeleton")return "skeleton";
  if(name==="mask")return "mask";
  if(name==="family")return "family";
  if(name==="cellular")return "cellular";
  if(name==="asymmetry")return "asymmetry";
  if(name==="hoverer")return "hoverer";
  if(name==="colossus")return "colossus";
  if(name==="sparkling")return "sparkling";
  if(name==="hollow")return "hollow";
  return "none";
})();

const friendFxSeed=Number(friendId % 997n);

let keys=new Set();
let last=0;
const groundClickEffects=[];

// Building auto-navigation state.
const NAV_GRID=12;
let autoRoute=[];
let autoDestination=null;
let autoArrivalAction=null;
let autoNavName="";
let autoReplans=0;

const BUILDING_APPROACH={
  oreMine:{x:266,y:480},
  reforge:{x:401,y:382},
  centralForge:{x:560,y:530},
  communityFurnace:{x:715,y:340},
  collection:{x:842,y:535}
};

function rect(x,y,w,h,color=P.ink){
  ACTIVE_CTX.fillStyle=color;
  ACTIVE_CTX.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}

function line(x1,y1,x2,y2,w=3,color=P.ink){
  ACTIVE_CTX.strokeStyle=color;
  ACTIVE_CTX.lineWidth=w;
  ACTIVE_CTX.beginPath();
  ACTIVE_CTX.moveTo(x1,y1);
  ACTIVE_CTX.lineTo(x2,y2);
  ACTIVE_CTX.stroke();
}

function poly(points,fill,stroke=P.ink,w=4){
  ACTIVE_CTX.beginPath();
  ACTIVE_CTX.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++) ACTIVE_CTX.lineTo(points[i].x,points[i].y);
  ACTIVE_CTX.closePath();
  ACTIVE_CTX.fillStyle=fill;
  ACTIVE_CTX.fill();
  ACTIVE_CTX.strokeStyle=stroke;
  ACTIVE_CTX.lineWidth=w;
  ACTIVE_CTX.stroke();
}

function pointInPoly(pt,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    const hit=
      ((a.y>pt.y)!=(b.y>pt.y)) &&
      pt.x < (b.x-a.x)*(pt.y-a.y)/(b.y-a.y||1)+a.x;
    if(hit)inside=!inside;
  }
  return inside;
}

function insideIsland(pt){
  return pointInPoly(pt,ISLAND);
}

function insideBridge(pt){
  return pointInPoly(pt,BRIDGE);
}

function circleHitsRect(center,radius,box){
  const nearestX=Math.max(box.x,Math.min(center.x,box.x+box.w));
  const nearestY=Math.max(box.y,Math.min(center.y,box.y+box.h));
  const dx=center.x-nearestX;
  const dy=center.y-nearestY;
  return dx*dx+dy*dy < radius*radius;
}

function walkable(pt){
  // Keep the whole Friend body on solid terrain using radial samples
  // around the island/bridge boundary.
  const terrainSamples=[
    {x:0,y:0},
    {x:FRIEND_R,y:0},
    {x:-FRIEND_R,y:0},
    {x:0,y:FRIEND_R},
    {x:0,y:-FRIEND_R},
    {x:FRIEND_R*.7,y:FRIEND_R*.7},
    {x:-FRIEND_R*.7,y:FRIEND_R*.7},
    {x:FRIEND_R*.7,y:-FRIEND_R*.7},
    {x:-FRIEND_R*.7,y:-FRIEND_R*.7}
  ];

  const onTerrain=terrainSamples.every(s=>{
    const sample={x:pt.x+s.x,y:pt.y+s.y};
    return insideIsland(sample)||insideBridge(sample);
  });
  if(!onTerrain)return false;

  // Continuous circle-vs-rectangle collision.
  // Unlike sparse point sampling this cannot slip through tiny seams/corners.
  if(circleHitsRect(pt,FRIEND_R,ORE_MINE.collision))return false;

  const hitsReforge=REFORGE.collisionParts.some(part=>
    circleHitsRect(pt,FRIEND_R,part)
  );
  if(hitsReforge)return false;

  const hitsForge=CENTRAL_FORGE.collisionParts.some(part=>
    circleHitsRect(pt,FRIEND_R,part)
  );
  if(hitsForge)return false;

  const hitsCommunityFurnace=COMMUNITY_FURNACE.collisionParts.some(part=>
    circleHitsRect(pt,FRIEND_R,part)
  );
  if(hitsCommunityFurnace)return false;

  const hitsCollection=COLLECTION.collisionParts.some(part=>
    circleHitsRect(pt,FRIEND_R,part)
  );
  if(hitsCollection)return false;

  return true;
}

function resolveBuildingOverlap(){
  const blockers=[
    ORE_MINE.collision,
    ...REFORGE.collisionParts,
    ...CENTRAL_FORGE.collisionParts,
    ...COMMUNITY_FURNACE.collisionParts,
    ...COLLECTION.collisionParts
  ];

  for(const box of blockers){
    if(!circleHitsRect(player,FRIEND_R,box))continue;

    const pushLeft=(box.x-FRIEND_R-.5)-player.x;
    const pushRight=(box.x+box.w+FRIEND_R+.5)-player.x;
    const pushUp=(box.y-FRIEND_R-.5)-player.y;
    const pushDown=(box.y+box.h+FRIEND_R+.5)-player.y;

    const candidates=[
      {axis:"x",value:pushLeft,dist:Math.abs(pushLeft)},
      {axis:"x",value:pushRight,dist:Math.abs(pushRight)},
      {axis:"y",value:pushUp,dist:Math.abs(pushUp)},
      // slight preference for pushing DOWN/out toward camera at front edges
      {axis:"y",value:pushDown,dist:Math.abs(pushDown)*0.92}
    ].sort((a,b)=>a.dist-b.dist);

    const best=candidates[0];
    if(best.axis==="x")player.x+=best.value;
    else player.y+=best.value;
  }
}


function cancelAutoNavigation(){
  autoRoute=[];
  autoDestination=null;
  autoArrivalAction=null;
  autoNavName="";
  autoReplans=0;
}

function segmentWalkable(a,b){
  const dist=Math.hypot(b.x-a.x,b.y-a.y);
  const steps=Math.max(1,Math.ceil(dist/5));

  for(let i=1;i<=steps;i++){
    const t=i/steps;
    const p={
      x:a.x+(b.x-a.x)*t,
      y:a.y+(b.y-a.y)*t
    };
    if(!walkable(p))return false;
  }
  return true;
}

function nearestWalkableGrid(point){
  const baseX=Math.round(point.x/NAV_GRID);
  const baseY=Math.round(point.y/NAV_GRID);
  let best=null;
  let bestDist=Infinity;

  for(let radius=0;radius<=7;radius++){
    for(let ox=-radius;ox<=radius;ox++){
      for(let oy=-radius;oy<=radius;oy++){
        if(radius>0 && Math.abs(ox)!==radius && Math.abs(oy)!==radius)continue;

        const p={
          x:(baseX+ox)*NAV_GRID,
          y:(baseY+oy)*NAV_GRID
        };

        if(p.x<FRIEND_R || p.x>VIEW.w-FRIEND_R ||
           p.y<FRIEND_R || p.y>VIEW.h-FRIEND_R)continue;

        if(!walkable(p))continue;

        const d=Math.hypot(p.x-point.x,p.y-point.y);
        if(d<bestDist){
          best=p;
          bestDist=d;
        }
      }
    }

    if(best)return best;
  }

  return null;
}

function navKey(p){
  return `${Math.round(p.x/NAV_GRID)},${Math.round(p.y/NAV_GRID)}`;
}

function simplifyNavigationPath(start,path){
  if(!path.length)return [];

  const simplified=[];
  let anchor={...start};
  let i=0;

  while(i<path.length){
    let chosen=i;

    // Find the farthest upcoming node visible directly from the current anchor.
    for(let j=path.length-1;j>=i;j--){
      if(segmentWalkable(anchor,path[j])){
        chosen=j;
        break;
      }
    }

    simplified.push(path[chosen]);
    anchor=path[chosen];
    i=chosen+1;
  }

  return simplified;
}

function findNavigationPath(start,goal){
  if(!walkable(goal))return null;

  // Fast path if there is direct line-of-sight.
  if(segmentWalkable(start,goal)){
    return [{...goal}];
  }

  const startNode=nearestWalkableGrid(start);
  const goalNode=nearestWalkableGrid(goal);
  if(!startNode || !goalNode)return null;

  const startKey=navKey(startNode);
  const goalKey=navKey(goalNode);

  const open=[startKey];
  const openSet=new Set([startKey]);
  const cameFrom=new Map();

  const pointByKey=new Map();
  pointByKey.set(startKey,startNode);
  pointByKey.set(goalKey,goalNode);

  const gScore=new Map([[startKey,0]]);
  const fScore=new Map([[
    startKey,
    Math.hypot(goalNode.x-startNode.x,goalNode.y-startNode.y)
  ]]);

  const dirs=[
    {x:1,y:0,c:1},
    {x:-1,y:0,c:1},
    {x:0,y:1,c:1},
    {x:0,y:-1,c:1},
    {x:1,y:1,c:Math.SQRT2},
    {x:1,y:-1,c:Math.SQRT2},
    {x:-1,y:1,c:Math.SQRT2},
    {x:-1,y:-1,c:Math.SQRT2}
  ];

  let safety=0;

  while(open.length && safety<12000){
    safety++;

    // Small map: linear best-node selection is simple and fast enough.
    let bestIndex=0;
    let currentKey=open[0];
    let currentF=fScore.get(currentKey) ?? Infinity;

    for(let i=1;i<open.length;i++){
      const k=open[i];
      const f=fScore.get(k) ?? Infinity;
      if(f<currentF){
        currentF=f;
        currentKey=k;
        bestIndex=i;
      }
    }

    open.splice(bestIndex,1);
    openSet.delete(currentKey);

    const current=pointByKey.get(currentKey);

    if(currentKey===goalKey){
      const reverse=[];
      let k=currentKey;

      while(k!==startKey){
        reverse.push(pointByKey.get(k));
        k=cameFrom.get(k);
        if(!k)return null;
      }

      reverse.reverse();
      reverse.push({...goal});

      return simplifyNavigationPath(start,reverse);
    }

    for(const dir of dirs){
      const next={
        x:current.x+dir.x*NAV_GRID,
        y:current.y+dir.y*NAV_GRID
      };

      if(next.x<FRIEND_R || next.x>VIEW.w-FRIEND_R ||
         next.y<FRIEND_R || next.y>VIEW.h-FRIEND_R)continue;

      if(!walkable(next))continue;

      // Do not cut diagonally through collider corners.
      if(dir.x!==0 && dir.y!==0){
        const sideA={x:current.x+dir.x*NAV_GRID,y:current.y};
        const sideB={x:current.x,y:current.y+dir.y*NAV_GRID};
        if(!walkable(sideA) || !walkable(sideB))continue;
      }

      const nextKey=navKey(next);
      if(!pointByKey.has(nextKey))pointByKey.set(nextKey,next);

      const tentative=(gScore.get(currentKey) ?? Infinity)+dir.c*NAV_GRID;

      if(tentative < (gScore.get(nextKey) ?? Infinity)){
        cameFrom.set(nextKey,currentKey);
        gScore.set(nextKey,tentative);

        const h=Math.hypot(goalNode.x-next.x,goalNode.y-next.y);
        fScore.set(nextKey,tentative+h);

        if(!openSet.has(nextKey)){
          open.push(nextKey);
          openSet.add(nextKey);
        }
      }
    }
  }

  return null;
}

function setNextAutoWaypoint(){
  if(autoRoute.length){
    target=autoRoute.shift();
    return;
  }

  target=null;
  const action=autoArrivalAction;

  autoDestination=null;
  autoArrivalAction=null;
  autoNavName="";
  autoReplans=0;

  if(action)action();
}

function startBuildingNavigation(name,destination,onArrive){
  keys.clear();
  target=null;
  cancelAutoNavigation();

  if(Math.hypot(player.x-destination.x,player.y-destination.y)<12){
    onArrive();
    return;
  }

  const route=findNavigationPath(player,destination);

  if(!route || !route.length){
    root.querySelector("#debug").textContent=`no safe route to ${name}`;
    return;
  }

  autoDestination={...destination};
  autoArrivalAction=onArrive;
  autoNavName=name;
  autoRoute=route.slice();
  autoReplans=0;

  addGroundClickEffect(destination);
  setNextAutoWaypoint();
}

function replanBuildingNavigation(){
  if(!autoDestination || !autoArrivalAction)return false;
  if(autoReplans>=2)return false;

  autoReplans++;
  const route=findNavigationPath(player,autoDestination);
  if(!route || !route.length)return false;

  autoRoute=route.slice();
  target=autoRoute.shift() || null;
  return !!target;
}

function moveBy(dx,dy){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.5));
  const sx=dx/steps;
  const sy=dy/steps;

  for(let i=0;i<steps;i++){
    const full={x:player.x+sx,y:player.y+sy};

    if(walkable(full)){
      player=full;
      continue;
    }

    // Smooth wall sliding: try the dominant axis first,
    // then the other axis using the UPDATED player position.
    const xFirst=Math.abs(sx)>=Math.abs(sy);

    const tryX=()=>{
      const candidate={x:player.x+sx,y:player.y};
      if(walkable(candidate)){
        player.x=candidate.x;
        return true;
      }
      return false;
    };

    const tryY=()=>{
      const candidate={x:player.x,y:player.y+sy};
      if(walkable(candidate)){
        player.y=candidate.y;
        return true;
      }
      return false;
    };

    if(xFirst){
      tryX();
      tryY();
    }else{
      tryY();
      tryX();
    }
  }
}

function drawIsland(){
  ACTIVE_CTX.fillStyle=P.bg;
  ACTIVE_CTX.fillRect(0,0,VIEW.w,VIEW.h);

  // Vertical island wall / thickness.
  const FRONT_DROP=33;

  const side=[
    // left drop
    {x:74,y:416},
    {x:98,y:442},
    {x:92,y:470},
    {x:116,y:491},
    {x:145,y:522},
    {x:184,y:530},
    {x:219,y:558},
    {x:258,y:566},
    {x:305,y:590},
    {x:351,y:585},
    {x:404,y:602},
    {x:452,y:611},
    {x:493,y:596},
    {x:542,y:601},
    {x:580,y:586},
    {x:627,y:590},
    {x:669,y:574},
    {x:694,y:586},
    {x:720,y:606},
    {x:790,y:614},
    {x:846,y:586},
    {x:912,y:584},
    {x:955,y:555},
    {x:1012,y:542},
    {x:1041,y:505},
    {x:1090,y:492},
    {x:1120,y:458},
    {x:1092,y:430},
    {x:1125,y:419},

    // same shoreline lowered to create the coral cliff face
    {x:1125,y:419+FRONT_DROP},
    {x:1092,y:430+FRONT_DROP},
    {x:1120,y:458+FRONT_DROP},
    {x:1090,y:492+FRONT_DROP},
    {x:1041,y:505+FRONT_DROP},
    {x:1012,y:542+FRONT_DROP},
    {x:955,y:555+FRONT_DROP},
    {x:912,y:584+FRONT_DROP},
    {x:846,y:586+FRONT_DROP},
    {x:790,y:614+FRONT_DROP},
    {x:720,y:606+FRONT_DROP},
    {x:694,y:586+FRONT_DROP},
    {x:669,y:574+FRONT_DROP},
    {x:627,y:590+FRONT_DROP},
    {x:580,y:586+FRONT_DROP},
    {x:542,y:601+FRONT_DROP},
    {x:493,y:596+FRONT_DROP},
    {x:452,y:611+FRONT_DROP},
    {x:404,y:602+FRONT_DROP},
    {x:351,y:585+FRONT_DROP},
    {x:305,y:590+FRONT_DROP},
    {x:258,y:566+FRONT_DROP},
    {x:219,y:558+FRONT_DROP},
    {x:184,y:530+FRONT_DROP},
    {x:145,y:522+FRONT_DROP},
    {x:116,y:491+FRONT_DROP},
    {x:92,y:470+FRONT_DROP},
    {x:98,y:442+FRONT_DROP},
    {x:74,y:416+FRONT_DROP}
  ];

  poly(side,P.edge,P.ink,4);

  // Island top.
  poly(ISLAND,P.grass,P.ink,5);

  // Front wall segment seams like the reference.
  const seams=[
    [98,442],[116,491],[145,522],[184,530],[219,558],
    [258,566],[305,590],[351,585],[404,602],[452,611],
    [493,596],[542,601],[580,586],[627,590],[669,574],
    [720,606],[790,614],[846,586],[912,584],[955,555],
    [1012,542],[1041,505],[1090,492],[1120,458],[1092,430]
  ];
  seams.forEach(([x,y])=>{
    line(x,y,x,y+FRONT_DROP,2,P.edgeDark);
  });

  // Sparse grass pixels only — no buildings, props or paths yet.
  const tufts=[
    [132,400],[190,350],[275,315],[350,268],[465,250],
    [590,246],[730,250],[865,270],[1005,310],[1085,352],
    [1092,404],[1054,470],[1005,510],[930,548],[850,556],
    [760,560],[665,548],[548,558],[470,548],[390,554],
    [315,540],[245,520],[188,492],[145,458],[112,430]
  ];
  tufts.forEach(([x,y],i)=>{
    rect(x,y,4,3,P.grassDark);
    if(i%3===0)rect(x+8,y+4,2,2,P.ink);
  });
}

function drawBridge(){
  // Bridge side/thickness.
  const topLeft={x:570,y:573};
  const topRight={x:695,y:573};
  const bottomRight={x:717,y:720};
  const bottomLeft={x:548,y:720};
  const DROP=16;

  const side=[
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    {x:bottomLeft.x,y:bottomLeft.y+DROP},
    {x:bottomRight.x,y:bottomRight.y+DROP},
    {x:topRight.x,y:topRight.y+DROP},
    {x:topLeft.x,y:topLeft.y+DROP}
  ];

  poly(side,P.edge,P.ink,4);

  // Walkable top plane.
  poly(BRIDGE,P.bridgeLight,P.ink,4);

  // Horizontal plank seams.
  for(let t=.08;t<1;t+=.105){
    const lx=topLeft.x+(bottomLeft.x-topLeft.x)*t;
    const ly=topLeft.y+(bottomLeft.y-topLeft.y)*t;
    const rx=topRight.x+(bottomRight.x-topRight.x)*t;
    const ry=topRight.y+(bottomRight.y-topRight.y)*t;
    line(lx,ly,rx,ry,3,P.ink);
  }

  // Alternating plank fill.
  for(let i=0;i<7;i+=2){
    const t1=.08+i*.105;
    const t2=Math.min(.97,t1+.105);

    const a1={
      x:topLeft.x+(bottomLeft.x-topLeft.x)*t1,
      y:topLeft.y+(bottomLeft.y-topLeft.y)*t1
    };
    const b1={
      x:topRight.x+(bottomRight.x-topRight.x)*t1,
      y:topRight.y+(bottomRight.y-topRight.y)*t1
    };
    const a2={
      x:topLeft.x+(bottomLeft.x-topLeft.x)*t2,
      y:topLeft.y+(bottomLeft.y-topLeft.y)*t2
    };
    const b2={
      x:topRight.x+(bottomRight.x-topRight.x)*t2,
      y:topRight.y+(bottomRight.y-topRight.y)*t2
    };

    ACTIVE_CTX.beginPath();
    ACTIVE_CTX.moveTo(a1.x,a1.y);
    ACTIVE_CTX.lineTo(b1.x,b1.y);
    ACTIVE_CTX.lineTo(b2.x,b2.y);
    ACTIVE_CTX.lineTo(a2.x,a2.y);
    ACTIVE_CTX.closePath();
    ACTIVE_CTX.fillStyle=P.bridge;
    ACTIVE_CTX.fill();
  }

  // Crisp outline after fills.
  ACTIVE_CTX.strokeStyle=P.ink;
  ACTIVE_CTX.lineWidth=4;
  ACTIVE_CTX.beginPath();
  ACTIVE_CTX.moveTo(BRIDGE[0].x,BRIDGE[0].y);
  BRIDGE.slice(1).forEach(p=>ACTIVE_CTX.lineTo(p.x,p.y));
  ACTIVE_CTX.closePath();
  ACTIVE_CTX.stroke();
}


function addGroundClickEffect(point){
  groundClickEffects.push({x:point.x,y:point.y,born:performance.now()});
  if(groundClickEffects.length>8)groundClickEffects.shift();
}

function drawGroundClickEffects(){
  const now=performance.now();

  for(let i=groundClickEffects.length-1;i>=0;i--){
    const fx=groundClickEffects[i];
    const age=now-fx.born;
    const duration=520;

    if(age>=duration){
      groundClickEffects.splice(i,1);
      continue;
    }

    const t=age/duration;
    const alpha=1-t;
    const rx=7+18*t;
    const ry=3.5+8*t;

    ACTIVE_CTX.save();
    ACTIVE_CTX.globalAlpha=alpha;

    ACTIVE_CTX.strokeStyle=P.ink;
    ACTIVE_CTX.lineWidth=2;
    ACTIVE_CTX.beginPath();
    ACTIVE_CTX.ellipse(fx.x,fx.y,rx,ry,0,0,Math.PI*2);
    ACTIVE_CTX.stroke();

    ACTIVE_CTX.strokeStyle=P.bridge;
    ACTIVE_CTX.lineWidth=3;
    ACTIVE_CTX.beginPath();
    ACTIVE_CTX.ellipse(
      fx.x,fx.y,
      Math.max(2,rx-5),
      Math.max(1.5,ry-2.5),
      0,0,Math.PI*2
    );
    ACTIVE_CTX.stroke();

    const spark=3;
    rect(fx.x-rx-2,fx.y-spark/2,spark,spark,P.white);
    rect(fx.x+rx-1,fx.y-spark/2,spark,spark,P.white);
    rect(fx.x-spark/2,fx.y-ry-1,spark,spark,P.white);
    rect(fx.x-spark/2,fx.y+ry-1,spark,spark,P.white);

    ACTIVE_CTX.restore();
  }
}


function friendFxWave(time:number,salt:number,speed:number){
  return (Math.sin((time*speed)+(friendFxSeed*.017)+(salt*1.73))+1)*.5;
}

function drawFamilyFxBehind(){
  if(!friendSprites || familyFxKind==="none" || isPaused() || reducedVfx.matches || document.hidden)return;
  const t=performance.now()/1000;
  const x=player.x;
  const y=player.y+27;

  ACTIVE_CTX.save();
  ACTIVE_CTX.imageSmoothingEnabled=false;

  if(familyFxKind==="hoverer"){
    const pulse=friendFxWave(t,1,2.2);
    ACTIVE_CTX.globalAlpha=.13+.05*pulse;
    ACTIVE_CTX.fillStyle=P.ink;
    ACTIVE_CTX.beginPath();
    ACTIVE_CTX.ellipse(Math.round(x),Math.round(y+8),12+3*pulse,3+1*pulse,0,0,Math.PI*2);
    ACTIVE_CTX.fill();
  }

  if(familyFxKind==="hollow"){
    const pulse=friendFxWave(t,2,1.7);
    ACTIVE_CTX.globalAlpha=.10+.08*pulse;
    ACTIVE_CTX.strokeStyle="#ffffff";
    ACTIVE_CTX.lineWidth=2;
    ACTIVE_CTX.beginPath();
    ACTIVE_CTX.arc(Math.round(x),Math.round(y-31),25+2*pulse,0,Math.PI*2);
    ACTIVE_CTX.stroke();
  }

  if(familyFxKind==="asymmetry"){
    const side=friendFxWave(t,3,2.6)>.5?1:-1;
    ACTIVE_CTX.globalAlpha=.09;
    ACTIVE_CTX.fillStyle="#ffffff";
    ACTIVE_CTX.fillRect(Math.round(x+(side*19)),Math.round(y-42),3,10);
  }

  if(familyFxKind==="colossus" && friendWalking){
    ACTIVE_CTX.globalAlpha=.16;
    ACTIVE_CTX.fillStyle=P.ink;
    for(let i=0;i<3;i++){
      const phase=(t*5+i*.7+friendFxSeed*.01)%1;
      const side=i%2===0?-1:1;
      ACTIVE_CTX.fillRect(
        Math.round(x+side*(7+i*3)),
        Math.round(y+5-phase*8),
        2+(i%2),
        2+(i%2)
      );
    }
  }

  ACTIVE_CTX.restore();
}

function drawFamilyFxFront(){
  if(!friendSprites || familyFxKind==="none" || isPaused() || reducedVfx.matches || document.hidden)return;
  const t=performance.now()/1000;
  const x=player.x;
  const y=player.y+27;

  ACTIVE_CTX.save();
  ACTIVE_CTX.imageSmoothingEnabled=false;

  if(familyFxKind==="sparkling"){
    for(let i=0;i<3;i++){
      const angle=t*(1.6+i*.22)+(friendFxSeed*.031)+(i*2.1);
      const radius=21+i*4;
      const px=Math.round(x+Math.cos(angle)*radius);
      const py=Math.round(y-32+Math.sin(angle)*11);
      ACTIVE_CTX.globalAlpha=.55+.35*friendFxWave(t,i,3.2+i*.2);
      ACTIVE_CTX.fillStyle="#ffffff";
      ACTIVE_CTX.fillRect(px-1,py-3,3,7);
      ACTIVE_CTX.fillRect(px-3,py-1,7,3);
      ACTIVE_CTX.fillStyle=P.ink;
      ACTIVE_CTX.fillRect(px,py,1,1);
    }
  }

  if(familyFxKind==="cellular"){
    for(let i=0;i<4;i++){
      const phase=(t*.34+i*.23+friendFxSeed*.001)%1;
      const px=Math.round(x+Math.sin((t*1.1)+(i*2.4)+friendFxSeed*.02)*(18+i*2));
      const py=Math.round(y-8-phase*62);
      const r=2+(i%2);
      ACTIVE_CTX.globalAlpha=.26*(1-phase);
      ACTIVE_CTX.strokeStyle="#ffffff";
      ACTIVE_CTX.lineWidth=1;
      ACTIVE_CTX.strokeRect(px-r,py-r,r*2,r*2);
    }
  }

  if(familyFxKind==="skeleton"){
    for(let i=0;i<3;i++){
      const phase=(t*.22+i*.31+friendFxSeed*.002)%1;
      const drift=Math.sin(t*1.4+i*2.2)*8;
      ACTIVE_CTX.globalAlpha=.20*(1-phase);
      ACTIVE_CTX.fillStyle="#ffffff";
      ACTIVE_CTX.fillRect(
        Math.round(x+drift+(i-1)*9),
        Math.round(y-5-phase*55),
        2,2
      );
    }
  }

  if(familyFxKind==="mask"){
    const pulse=friendFxWave(t,5,1.7);

    const cx=Math.round(x);
    const cy=Math.round(y-43);
    const hw=20;
    const hh=13;
    const mark=5;

    // Persistent corner marks make Mask identity readable at all times.
    ACTIVE_CTX.globalAlpha=.32;
    ACTIVE_CTX.strokeStyle="#ffffff";
    ACTIVE_CTX.lineWidth=1;
    ACTIVE_CTX.beginPath();

    ACTIVE_CTX.moveTo(cx-hw,cy-hh+mark);
    ACTIVE_CTX.lineTo(cx-hw,cy-hh);
    ACTIVE_CTX.lineTo(cx-hw+mark,cy-hh);

    ACTIVE_CTX.moveTo(cx+hw-mark,cy-hh);
    ACTIVE_CTX.lineTo(cx+hw,cy-hh);
    ACTIVE_CTX.lineTo(cx+hw,cy-hh+mark);

    ACTIVE_CTX.moveTo(cx-hw,cy+hh-mark);
    ACTIVE_CTX.lineTo(cx-hw,cy+hh);
    ACTIVE_CTX.lineTo(cx-hw+mark,cy+hh);

    ACTIVE_CTX.moveTo(cx+hw-mark,cy+hh);
    ACTIVE_CTX.lineTo(cx+hw,cy+hh);
    ACTIVE_CTX.lineTo(cx+hw,cy+hh-mark);

    ACTIVE_CTX.stroke();

    // Slow breathing pulse around the head.
    const grow=2+Math.round(pulse*4);
    ACTIVE_CTX.globalAlpha=.10+.22*pulse;
    ACTIVE_CTX.strokeRect(
      cx-hw-grow,
      cy-hh-grow,
      (hw+grow)*2,
      (hh+grow)*2
    );
  }

  if(familyFxKind==="family"){
    for(const side of [-1,1]){
      const bob=friendFxWave(t,side<0?6:7,2.0)*4;
      ACTIVE_CTX.globalAlpha=.30;
      ACTIVE_CTX.fillStyle="#ffffff";
      ACTIVE_CTX.fillRect(Math.round(x+side*22),Math.round(y-18-bob),3,3);
    }
  }

  if(familyFxKind==="asymmetry"){
    const drift=friendFxWave(t,8,2.8)*8;
    ACTIVE_CTX.globalAlpha=.10;
    ACTIVE_CTX.fillStyle="#ffffff";
    ACTIVE_CTX.fillRect(Math.round(x-24+drift),Math.round(y-28),2,8);
    ACTIVE_CTX.fillRect(Math.round(x+21-drift*.5),Math.round(y-48),2,5);
  }

  ACTIVE_CTX.restore();
}

function drawFallbackFriend(){
  const scale=0.72;
  ACTIVE_CTX.save();
  ACTIVE_CTX.translate(player.x,player.y+27);
  ACTIVE_CTX.scale(scale,scale);

  const x=-25;
  const y=-98;

  rect(x+10,y+0,13,6,P.white);
  rect(x+35,y+0,13,6,P.white);
  rect(x+8,y+5,42,25,P.white);
  rect(x+3,y+12,52,20,P.white);
  rect(x+9,y+30,40,43,P.white);
  rect(x+2,y+36,12,25,P.white);
  rect(x+44,y+36,12,25,P.white);
  rect(x+11,y+70,12,33,P.white);
  rect(x+35,y+70,12,33,P.white);

  rect(x+13,y+7,8,4,P.ink);
  rect(x+37,y+7,8,4,P.ink);
  rect(x+12,y+10,34,18,P.ink);
  rect(x+7,y+15,44,13,P.ink);

  rect(x+17,y+17,5,6,P.white);
  rect(x+35,y+17,5,6,P.white);
  rect(x+25,y+24,8,2,P.white);

  rect(x+12,y+31,34,38,P.ink);
  rect(x+7,y+37,10,20,P.ink);
  rect(x+41,y+37,10,20,P.ink);
  rect(x+13,y+67,10,31,P.ink);
  rect(x+35,y+67,10,31,P.ink);

  ACTIVE_CTX.restore();
}

function resolveFriendSpriteFacing():FriendSpriteFacing{
  if(
    friendSprites?.familyId===6 &&
    (friendFacing==="up" || friendFacing==="down")
  ){
    return friendLastSide;
  }
  return friendFacing;
}

function currentFriendSpriteFrame():FriendSpriteFrame|null{
  if(!friendSprites)return null;

  const facing=resolveFriendSpriteFacing();
  const clip=friendSprites.clips[friendWalking?"walk":"idle"][facing];
  if(!clip || clip.length===0)return null;

  const frameMs=friendWalking ? FRIEND_WALK_FRAME_MS : FRIEND_IDLE_FRAME_MS;
  const frameIndex=Math.floor(performance.now()/frameMs)%Math.min(8,clip.length);
  return clip[frameIndex] ?? null;
}

function drawCanonicalFriend(frame:FriendSpriteFrame){
  const pixel=FRIEND_PIXEL_SCALE;
  const size=FRIEND_SPRITE_SIZE*pixel;
  const baseY=player.y+30;
  const startX=Math.round(player.x-size/2);
  const startY=Math.round(baseY-size);

  ACTIVE_CTX.save();
  ACTIVE_CTX.imageSmoothingEnabled=false;

  ACTIVE_CTX.globalAlpha=.18;
  ACTIVE_CTX.fillStyle=P.ink;
  ACTIVE_CTX.beginPath();
  ACTIVE_CTX.ellipse(Math.round(player.x),Math.round(baseY+2),15,5,0,0,Math.PI*2);
  ACTIVE_CTX.fill();
  ACTIVE_CTX.globalAlpha=1;

  // White pixel outline behind the current canonical animation frame.
  ACTIVE_CTX.fillStyle="#ffffff";

  for(let y=0;y<16;y++){
    const row=frame.rows[y] ?? "";
    for(let x=0;x<16;x++){
      if(row[x]!=="#")continue;

      for(let oy=-1;oy<=1;oy++){
        for(let ox=-1;ox<=1;ox++){
          if(ox===0 && oy===0)continue;

          const nx=x+ox;
          const ny=y+oy;
          const filled=
            nx>=0 && nx<16 &&
            ny>=0 && ny<16 &&
            (frame.rows[ny]?.[nx] ?? ".")==="#";

          if(filled)continue;

          ACTIVE_CTX.fillRect(
            startX+x*pixel+ox*2,
            startY+y*pixel+oy*2,
            pixel,
            pixel
          );
        }
      }
    }
  }

  ACTIVE_CTX.fillStyle=P.ink;

  for(let y=0;y<16;y++){
    const row=frame.rows[y] ?? "";
    for(let x=0;x<16;x++){
      if(row[x]!=="#")continue;
      ACTIVE_CTX.fillRect(startX+x*pixel,startY+y*pixel,pixel,pixel);
    }
  }

  ACTIVE_CTX.restore();
}

function drawFriend(){
  const frame=currentFriendSpriteFrame();
  drawFamilyFxBehind();

  if(frame){
    drawCanonicalFriend(frame);
  }else{
    drawFallbackFriend();
  }

  drawFamilyFxFront();
}


function updateSceneDepth(){
  terrainCanvas.style.zIndex="1";

  const mineCoversFriend = player.y < ORE_MINE.depthY;
  const reforgeCoversFriend = player.y < REFORGE.depthY;
  const forgeCoversFriend = player.y < CENTRAL_FORGE.depthY;
  const communityFurnaceCoversFriend = player.y < COMMUNITY_FURNACE.depthY;
  const collectionCoversFriend = player.y < COLLECTION.depthY;

  // Friend sits in the middle of the landmark stack.
  // A building only rises above Friend when Friend is genuinely behind it.
  canvas.style.zIndex="10";

  // When Friend is in front, landmarks stay below Friend.
  // When Friend is behind, they rise above Friend.
  //
  // Reforge keeps the lowest building priority.
  reforgeLayer.style.zIndex = reforgeCoversFriend ? "11" : "2";
  communityFurnaceLayer.style.zIndex = communityFurnaceCoversFriend ? "12" : "3";
  centralForgeLayer.style.zIndex = forgeCoversFriend ? "12" : "3";
  oreMineSprite.style.zIndex = mineCoversFriend ? "13" : "4";
  collectionLayer.style.zIndex = collectionCoversFriend ? "13" : "4";

  // Flowers are ground decoration: always below Friend.
  root.querySelectorAll(".decor-flower").forEach(el=>{
    el.style.zIndex="8";
  });

  // Trees preserve their own front/back relationship with Friend.
  for(const tree of DECOR_TREES){
    const friendIsInFront = player.y >= tree.depthY;
    tree.el.style.zIndex = friendIsInFront ? "9" : "14";
  }

  // Canonical SDK props are cosmetic only, but can still pass naturally
  // behind/in front of the Friend based on their visual ground line.
  for(const prop of canonicalPropLayers){
    const friendIsInFront=player.y>=prop.depthY;
    prop.el.style.zIndex=friendIsInFront ? "9" : "14";
  }
}

function drawDebug(){
  const onBridge=insideBridge(player);

  const distanceToMine=Math.hypot(
    player.x-ORE_MINE.center.x,
    player.y-ORE_MINE.center.y
  );
  const nearMine=distanceToMine<=ORE_MINE.reach;

  const distanceToReforge=Math.hypot(
    player.x-REFORGE.center.x,
    player.y-REFORGE.center.y
  );
  const nearReforge=distanceToReforge<=REFORGE.reach;

  const distanceToForge=Math.hypot(
    player.x-CENTRAL_FORGE.center.x,
    player.y-CENTRAL_FORGE.center.y
  );
  const nearForge=distanceToForge<=CENTRAL_FORGE.reach;

  const distanceToCommunityFurnace=Math.hypot(
    player.x-COMMUNITY_FURNACE.center.x,
    player.y-COMMUNITY_FURNACE.center.y
  );
  const nearCommunityFurnace=distanceToCommunityFurnace<=COMMUNITY_FURNACE.reach;

  const distanceToCollection=Math.hypot(
    player.x-COLLECTION.center.x,
    player.y-COLLECTION.center.y
  );
  const nearCollection=distanceToCollection<=COLLECTION.reach;

  const bits=["surface: "+(onBridge?"bridge":"island")];
  if(nearMine)bits.push("ore mine nearby");
  if(nearReforge)bits.push("reforge nearby");
  if(nearForge)bits.push("central forge nearby");
  if(nearCommunityFurnace)bits.push("community furnace nearby");
  if(nearCollection)bits.push("collection nearby");
  if(autoNavName)bits.push(`walking → ${autoNavName}`);
  root.querySelector("#debug").textContent=bits.join(" · ");

  const mineLabel=root.querySelector("#oreMineLabel");
  mineLabel.disabled=false;
  mineLabel.textContent=nearMine
    ? "[ ORE MINE · interact ]"
    : "[ ORE MINE · go ]";
  mineLabel.dataset.state=nearMine
    ? "interact"
    : autoNavName==="Ore Mine"
      ? "walking"
      : "go";

  reforgeLabel.disabled=false;
  reforgeLabel.textContent=nearReforge
    ? "[ REFORGE · interact ]"
    : "[ REFORGE · go ]";
  reforgeLabel.dataset.state=nearReforge
    ? "interact"
    : autoNavName==="Reforge"
      ? "walking"
      : "go";

  centralForgeLabel.disabled=false;
  centralForgeLabel.textContent=nearForge
    ? "[ CENTRAL FORGE · interact ]"
    : "[ CENTRAL FORGE · go ]";
  centralForgeLabel.dataset.state=nearForge
    ? "interact"
    : autoNavName==="Central Forge"
      ? "walking"
      : "go";

  communityFurnaceLabel.disabled=false;
  communityFurnaceLabel.textContent=nearCommunityFurnace
    ? "[ COMMUNITY FURNACE · interact ]"
    : "[ COMMUNITY FURNACE · go ]";
  communityFurnaceLabel.dataset.state=nearCommunityFurnace
    ? "interact"
    : autoNavName==="Community Furnace"
      ? "walking"
      : "go";

  collectionLabel.disabled=false;
  collectionLabel.textContent=nearCollection
    ? "[ COLLECTION · interact ]"
    : "[ COLLECTION · go ]";
  collectionLabel.dataset.state=nearCollection
    ? "interact"
    : autoNavName==="Collection"
      ? "walking"
      : "go";
}

function render(){
  updateSceneDepth();

  // Bottom layer: island + bridge only.
  ACTIVE_CTX=terrainCtx;
  terrainCtx.clearRect(0,0,terrainCanvas.width,terrainCanvas.height);
  drawIsland();
  drawBridge();

  // Top/middle actor layer: transparent except for Friend.
  ACTIVE_CTX=ctx;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGroundClickEffects();
  worldVfx.draw(ctx,performance.now(),{
    x:player.x,y:player.y,walking:friendWalking,facing:friendFacing,family:familyFxKind
  },!isPaused() && !reducedVfx.matches && !document.hidden);
  drawFriend();

  drawDebug();
}

canvas.addEventListener("keydown",e=>{
  if(isPaused())return;
  const k=e.key.toLowerCase();
  const movement=["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"];
  if(movement.includes(k)){
    e.preventDefault();
    keys.add(k);
  }
});

canvas.addEventListener("keyup",e=>{
  if(isPaused()){ keys.clear(); return; }
  keys.delete(e.key.toLowerCase());
});

canvas.addEventListener("blur",()=>keys.clear());

canvas.addEventListener("pointerdown",e=>{
  if(isPaused())return;
  const r=canvas.getBoundingClientRect();
  const point={
    x:(e.clientX-r.left)*VIEW.w/r.width,
    y:(e.clientY-r.top)*VIEW.h/r.height
  };

  canvas.focus();
  keys.clear();
  cancelAutoNavigation();

  if(walkable(point)){
    target=point;
    if(e.button===0){
      addGroundClickEffect(point);
    }
  }else{
    target=null;
  }
});

function loop(now){
  if(destroyed)return;
  const dt=last?Math.min((now-last)/1000,.05):0;
  last=now;

  if(isPaused()){
    friendWalking=false;
    keys.clear();
    target=null;
    cancelAutoNavigation();
    render();
    rafId=requestAnimationFrame(loop);
    return;
  }

  let dx=(keys.has("d")||keys.has("arrowright")?1:0)
        -(keys.has("a")||keys.has("arrowleft")?1:0);

  let dy=(keys.has("s")||keys.has("arrowdown")?1:0)
        -(keys.has("w")||keys.has("arrowup")?1:0);

  let travel=SPEED*dt;

  if(dx||dy){
    // Manual keyboard input always overrides auto-navigation.
    target=null;
    cancelAutoNavigation();
  }else if(target){
    dx=target.x-player.x;
    dy=target.y-player.y;
    const d=Math.hypot(dx,dy);
    travel=Math.min(travel,d);

    if(d<3){
      dx=dy=0;

      if(autoArrivalAction){
        setNextAutoWaypoint();
      }else{
        target=null;
      }
    }
  }

  friendWalking=false;

  if(dx||dy){
    const len=Math.hypot(dx,dy);
    const before={x:player.x,y:player.y};

    moveBy(dx/len*travel,dy/len*travel);
    resolveBuildingOverlap();

    const movedX=player.x-before.x;
    const movedY=player.y-before.y;
    const moved=Math.hypot(movedX,movedY);

    if(moved>0.15){
      friendWalking=true;

      if(Math.abs(movedX)>=Math.abs(movedY)){
        friendFacing=movedX<0?"left":"right";
        friendLastSide=friendFacing;
      }else{
        friendFacing=movedY<0?"up":"down";
      }
    }

    if(target && moved<0.15){
      if(autoArrivalAction){
        if(!replanBuildingNavigation()){
          target=null;
          cancelAutoNavigation();
        }
      }else{
        target=null;
      }
    }
  }

  render();
  rafId=requestAnimationFrame(loop);
}


const oreMineLabel=root.querySelector("#oreMineLabel");
const oreModal=root.querySelector("#oreModal");
const buyOreButton=root.querySelector("#buyOre");
const buyOreFiveButton=root.querySelector("#buyOreFive");
const oreCustomToggle=root.querySelector("#oreCustomToggle");
const oreCustomRow=root.querySelector("#oreCustomRow");
const oreCustomInput=root.querySelector("#oreCustomInput");
const oreCustomMinus=root.querySelector("#oreCustomMinus");
const oreCustomPlus=root.querySelector("#oreCustomPlus");
const buyOreConfirm=root.querySelector("#buyOreConfirm");
const orePreviewQty=root.querySelector("#orePreviewQty");
const orePreviewCost=root.querySelector("#orePreviewCost");
const orePreviewRfAfter=root.querySelector("#orePreviewRfAfter");
const orePreviewOreAfter=root.querySelector("#orePreviewOreAfter");
const oreBalanceWarning=root.querySelector("#oreBalanceWarning");
const orePurchaseStatus=root.querySelector("#orePurchaseStatus");
const orePurchaseStatusCopy=root.querySelector("#orePurchaseStatusCopy");
const oreConfirmSummary=root.querySelector("#oreConfirmSummary");
const oreModeLabel=root.querySelector("#oreModeLabel");
const oreGoForgeButton=root.querySelector("#oreGoForge");
const closeOreButton=root.querySelector("#closeOre");
const enterMineButton=document.createElement("button");
enterMineButton.type="button";
enterMineButton.id="enterMiningDig";
enterMineButton.textContent="[ ENTER MINE → ]";
oreModal.querySelector(".ore-actions").prepend(enterMineButton);
const miningDig=mountMiningDig(oreModal,{
  friendId,
  friendRows:friendSprites?.clips.idle.down?.[0]?.rows ?? null,
  isPaused,
  playSound:playFriendSound,
  playAccent:(accent,volume)=>sounds?.accent?.(accent,volume),
  canStartPaid:()=>rf>=2 && pendingPlayId===null && !economyBusy && !forgeBusy,
  buyTwoOre:()=>purchaseOre(2),
  forgeOne:()=>{
    selectedForgeMaterial="iron";
    return startForge();
  }
});

const forgeModal=root.querySelector("#forgeModal");
const forgeOreButton=root.querySelector("#forgeOre");
const forgeGoMineButton=root.querySelector("#forgeGoMine");
const closeForgeButton=root.querySelector("#closeForge");
const forgeStatus=root.querySelector("#forgeStatus");
const forgeMaterialIron=root.querySelector("#forgeMaterialIron");
const forgeMaterialGold=root.querySelector("#forgeMaterialGold");
const forgeMaterialDiamond=root.querySelector("#forgeMaterialDiamond");
const forgeProfileTone=root.querySelector("#forgeProfileTone");
const forgeFriendPreview=root.querySelector("#forgeFriendPreview");
const forgeFriendLabel=root.querySelector("#forgeFriendLabel");
const forgeSelectedOreArt=root.querySelector("#forgeSelectedOreArt");
const forgeSelectedOreLabel=root.querySelector("#forgeSelectedOreLabel");
const forgePendingCard=root.querySelector("#forgePendingCard");
const forgePendingId=root.querySelector("#forgePendingId");
const forgeOddsTitle=root.querySelector("#forgeOddsTitle");
const forgeOddsCompare=root.querySelector("#forgeOddsCompare");
const forgeOddsHeadline=root.querySelector("#forgeOddsHeadline");
const forgeOddsRule=root.querySelector("#forgeOddsRule");
const forgeRarityTrack=root.querySelector("#forgeRarityTrack");
const forgeOddsList=root.querySelector("#forgeOddsList");
const forgeMythicChance=root.querySelector("#forgeMythicChance");
const forgeActionMaterial=root.querySelector("#forgeActionMaterial");
const forgeActionHint=root.querySelector("#forgeActionHint");

const collectionModal=root.querySelector("#collectionModal");
const closeCollectionButton=root.querySelector("#closeCollection");
const collectionGoForgeButton=root.querySelector("#collectionGoForge");
const collectionCard=collectionModal.querySelector(".collection-card");
const collectionSummary=collectionCard.querySelector(".collection-summary");
const collectionBest=collectionSummary.querySelector("#collectionForges");
collectionBest.nextElementSibling.textContent="BEST ARTIFACT";
const collectionFilters=document.createElement("div");
collectionFilters.className="collection-filters";
collectionFilters.setAttribute("role","group");
collectionFilters.setAttribute("aria-label","Filter artifacts by rarity");
collectionCard.querySelector(".collection-header").after(collectionFilters);
const collectionScroll=collectionCard.querySelector(".collection-scroll");
const collectionLayout=document.createElement("div");
collectionLayout.className="collection-layout";
const collectionDetail=document.createElement("aside");
collectionDetail.className="collection-detail";
collectionDetail.setAttribute("aria-live","polite");
collectionScroll.replaceWith(collectionLayout);
collectionLayout.append(collectionScroll,collectionDetail);
let collectionFilter="all";
let selectedCollectionId=null;
let sellState="idle";
let sellItemId=null;
let sellQuantity=1;
let sellMessage="";
let sellCompletedQuantity=0;
let sellCompletedRf=0;
let sellUncertain=false;

const revealModal=root.querySelector("#revealModal");
const revealCard=root.querySelector("#revealCard");
const revealIcon=root.querySelector("#revealIcon");
const revealName=root.querySelector("#revealName");
const revealRarity=root.querySelector("#revealRarity");
const revealCopy=root.querySelector("#revealCopy");
const revealForgeAgain=root.querySelector("#revealForgeAgain");
const revealGoCollection=root.querySelector("#revealGoCollection");
const revealClose=root.querySelector("#revealClose");

const gameToast=root.querySelector("#gameToast");
const syncButton=root.querySelector("#syncButton");

let toastTimer=null;

function showToast(message){
  gameToast.textContent=message;
  gameToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>gameToast.classList.remove("show"),1800);
}

function updateHud(){
  root.querySelector("#rfHud").textContent=`RF ${formatRf(rf)}`;
  root.querySelector("#oreHud").textContent=`ORE ${ore}`;
  root.querySelector("#collectionHud").textContent=`${discoveredCount()} / ${ITEMS.length}`;
}

let orePurchaseQuantity=1;
let orePurchaseKind="quick1";
let orePurchaseState="idle";

function formatRf(value){
  const number=Number(value);

  if(!Number.isFinite(number))return "—";
  if(Math.abs(number-Math.round(number))<.000001){
    return String(Math.round(number));
  }

  return number.toFixed(2).replace(/\.?0+$/,"");
}

function clampOreQuantity(value){
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return 1;
  return Math.max(1,Math.min(99,Math.floor(numeric)));
}

function setOreStatus(title,copy,state="idle"){
  orePurchaseState=state;
  orePurchaseStatus.className=`ore-purchase-status ${state}`;

  const titleNode=orePurchaseStatus.querySelector("strong");
  if(titleNode)titleNode.textContent=title;

  orePurchaseStatusCopy.textContent=copy;
}

function selectOreQuantity(kind,value){
  if(economyBusy || forgeBusy)return;

  orePurchaseKind=kind;
  orePurchaseQuantity=clampOreQuantity(value);

  buyOreButton.classList.toggle("active",kind==="quick1");
  buyOreFiveButton.classList.toggle("active",kind==="quick5");
  oreCustomToggle.classList.toggle("active",kind==="custom");

  buyOreButton.setAttribute("aria-pressed",String(kind==="quick1"));
  buyOreFiveButton.setAttribute("aria-pressed",String(kind==="quick5"));
  oreCustomToggle.setAttribute("aria-pressed",String(kind==="custom"));

  oreCustomRow.hidden=kind!=="custom";

  if(kind==="custom"){
    oreCustomInput.value=String(orePurchaseQuantity);
  }

  setOreStatus(
    "READY",
    "Review the order, then confirm through FriendSDK.",
    "idle"
  );

  updateOreUi();
}

function updateOrePreview(){
  const qty=clampOreQuantity(
    orePurchaseKind==="custom"
      ? oreCustomInput.value
      : orePurchaseQuantity
  );

  orePurchaseQuantity=qty;

  if(orePurchaseKind==="custom" && String(oreCustomInput.value)!==String(qty)){
    oreCustomInput.value=String(qty);
  }

  const cost=qty; // Iron Ore = 1 RF each in the current SDK game definition.
  const enough=rf>=cost;
  const rfAfter=Math.max(0,rf-cost);
  const oreAfter=ore+qty;

  orePreviewQty.textContent=`${qty} ${qty===1?"Ore":"Ore"}`;
  orePreviewCost.textContent=`${formatRf(cost)} RF`;
  orePreviewRfAfter.textContent=enough
    ? `${formatRf(rfAfter)} RF`
    : "INSUFFICIENT";
  orePreviewOreAfter.textContent=enough
    ? String(oreAfter)
    : "—";

  oreConfirmSummary.textContent=
    `${qty} ORE · ${formatRf(cost)} RF`;

  oreBalanceWarning.hidden=enough;

  buyOreConfirm.disabled=
    economyBusy ||
    forgeBusy ||
    !enough ||
    qty<1;

  if(!enough && !economyBusy){
    orePurchaseStatus.className="ore-purchase-status warning";
    const titleNode=orePurchaseStatus.querySelector("strong");
    if(titleNode)titleNode.textContent="INSUFFICIENT RF";
    orePurchaseStatusCopy.textContent=
      `This order needs ${formatRf(cost)} RF. Your Friend has ${formatRf(rf)} RF.`;
  }else if(orePurchaseState==="warning"){
    setOreStatus(
      "READY",
      "Review the order, then confirm through FriendSDK.",
      "idle"
    );
  }
}

function updateOreUi(){
  root.querySelector("#oreCount").textContent=ore;
  root.querySelector("#oreRfCount").textContent=`${formatRf(rf)} RF`;

  oreModeLabel.textContent=
    economy.initial.mode==="chain"
      ? "CHAIN"
      : "PREVIEW";

  const controlsLocked=economyBusy || forgeBusy;

  buyOreButton.disabled=controlsLocked;
  buyOreFiveButton.disabled=controlsLocked;
  oreCustomToggle.disabled=controlsLocked;
  oreCustomInput.disabled=controlsLocked;
  oreCustomMinus.disabled=controlsLocked;
  oreCustomPlus.disabled=controlsLocked;

  updateOrePreview();
  updateHud();
}

async function purchaseOre(amount){
  if(economyBusy || forgeBusy)return false;

  const qty=clampOreQuantity(amount);
  const cost=qty;

  if(rf<cost){
    setOreStatus(
      "INSUFFICIENT RF",
      `You need ${formatRf(cost)} RF for ${qty} Iron Ore.`,
      "warning"
    );
    updateOreUi();
    showToast("Not enough RF for this Iron Ore order.");
    return false;
  }

  economyBusy=true;

  setOreStatus(
    "PROCESSING",
    `FriendSDK is purchasing ${qty} Iron Ore for ${formatRf(cost)} RF…`,
    "processing"
  );

  updateOreUi();
  updateForgeUi();
  showToast(`Buying ${qty} Iron Ore through FriendSDK…`);

  try{
    const next=await economy.buy(qty);

    if(destroyed)return false;

    applyEconomyState(next);
    playFriendSound("purchase",.78);
    uiVfx.burst(oreMineLabel,"#efd28a",9);

    setOreStatus(
      "PURCHASE COMPLETE",
      `+${qty} Iron Ore added. SDK balances are now synced.`,
      "success"
    );

    updateOreUi();
    updateForgeUi();
    updateCollectionUi();
    showToast(`+${qty} Iron Ore · FriendSDK confirmed`);
    return true;
  }catch(error){
    const message=
      error instanceof Error
        ? error.message
        : "Ore purchase failed.";

    setOreStatus(
      "PURCHASE FAILED",
      message,
      "error"
    );

    showToast(message);
    return false;
  }finally{
    economyBusy=false;

    if(!destroyed){
      updateOreUi();
      updateForgeUi();
    }
  }
}

function openOreMenu(){
  playFriendSound("select",.55);
  cancelAutoNavigation();
  target=null;

  setOreStatus(
    "READY",
    "Review the order, then confirm through FriendSDK.",
    "idle"
  );

  updateOreUi();
  oreModal.classList.add("show");
}

oreMineLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Ore Mine",
    BUILDING_APPROACH.oreMine,
    openOreMenu
  );
});

closeOreButton.addEventListener("click",()=>{
  if(economyBusy)return;
  oreModal.classList.remove("show");
  canvas.focus();
});

enterMineButton.addEventListener("click",()=>{
  if(economyBusy || forgeBusy || isPaused())return;
  miningDig.open();
});

buyOreButton.addEventListener("click",()=>{
  selectOreQuantity("quick1",1);
});

buyOreFiveButton.addEventListener("click",()=>{
  selectOreQuantity("quick5",5);
});

oreCustomToggle.addEventListener("click",()=>{
  selectOreQuantity(
    "custom",
    clampOreQuantity(oreCustomInput.value)
  );
  oreCustomInput.focus();
  oreCustomInput.select();
});

oreCustomInput.addEventListener("input",()=>{
  if(orePurchaseKind!=="custom")return;
  orePurchaseQuantity=clampOreQuantity(oreCustomInput.value);
  setOreStatus(
    "READY",
    "Review the custom order, then confirm through FriendSDK.",
    "idle"
  );
  updateOreUi();
});

oreCustomInput.addEventListener("keydown",(event)=>{
  if(event.key==="Enter" && !buyOreConfirm.disabled){
    event.preventDefault();
    void purchaseOre(orePurchaseQuantity);
  }
});

oreCustomMinus.addEventListener("click",()=>{
  selectOreQuantity(
    "custom",
    clampOreQuantity(oreCustomInput.value)-1
  );
});

oreCustomPlus.addEventListener("click",()=>{
  selectOreQuantity(
    "custom",
    clampOreQuantity(oreCustomInput.value)+1
  );
});

buyOreConfirm.addEventListener("click",()=>{
  void purchaseOre(orePurchaseQuantity);
});

oreGoForgeButton.addEventListener("click",()=>{
  if(economyBusy)return;

  oreModal.classList.remove("show");
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    openForgeMenu
  );
});

function setForgeStatus(label,state="idle"){
  forgeStatus.className=`forge-status ${state}`;
  forgeStatus.querySelector("strong").textContent=label;
}

let selectedForgeMaterial="iron";

const FORGE_MATERIAL_ART={
  iron:forgeMaterialIron.querySelector(".forge-material-visual").innerHTML,
  gold:forgeMaterialGold.querySelector(".forge-material-visual").innerHTML,
  diamond:forgeMaterialDiamond.querySelector(".forge-material-visual").innerHTML
};

const FORGE_RARITY_LABELS={
  common:"COMMON",
  uncommon:"UNCOMMON",
  rare:"RARE",
  epic:"EPIC",
  legendary:"LEGENDARY",
  mythic:"MYTHIC"
};

function formatForgeChance(value){
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return "—";
  return `${numeric.toFixed(2)}%`;
}

function forgeOneIn(chance){
  if(!chance || chance<=0)return "—";
  const denominator=Math.round(100/chance);
  return `1 IN ${Math.max(1,denominator)}`;
}

function renderForgeFriendPreview(){
  forgeFriendLabel.textContent=`FRIEND #${friendId.toString()}`;

  if(!friendSprites){
    forgeFriendPreview.innerHTML='<span class="forge-friend-fallback">?</span>';
    return;
  }

  const frame=friendSprites.clips.idle.down?.[0];

  if(!frame){
    forgeFriendPreview.innerHTML='<span class="forge-friend-fallback">?</span>';
    return;
  }

  forgeFriendPreview.innerHTML=frame.rows.map((row,y)=>
    row.split("").map((pixel,x)=>
      pixel==="#"
        ? `<i style="left:${x*4}px;top:${y*4}px"></i>`
        : ""
    ).join("")
  ).join("");
}

function renderForgeOdds(){
  const profile=FORGE_MATERIALS[selectedForgeMaterial];
  const odds=forgeOddsPercent(profile);

  forgeProfileTone.textContent=profile.tone;
  forgeOddsTitle.textContent=`${profile.label.toUpperCase()} PROFILE`;
  forgeOddsCompare.textContent=profile.compareLabel;
  forgeOddsHeadline.textContent=
    `${formatForgeChance(odds.common)} COMMON`;
  forgeOddsRule.textContent=profile.rule;

  forgeSelectedOreArt.innerHTML=
    FORGE_MATERIAL_ART[selectedForgeMaterial];
  forgeSelectedOreLabel.textContent=
    `${profile.label.toUpperCase()} · 1 ORE`;

  forgeRarityTrack.innerHTML=FORGE_RARITIES.map(rarity=>
    `<span class="${rarity}" style="--share:${odds[rarity]}"></span>`
  ).join("");

  forgeOddsList.innerHTML=FORGE_RARITIES.map(rarity=>`
    <div class="forge-odds-row ${rarity}">
      <span><i></i>${FORGE_RARITY_LABELS[rarity]}</span>
      <b>${formatForgeChance(odds[rarity])}</b>
      <em><u style="width:${Math.max(.5,odds[rarity])}%"></u></em>
    </div>
  `).join("");

  forgeMythicChance.textContent=forgeOneIn(odds.mythic);

  forgeActionMaterial.textContent=`${profile.label.toUpperCase()} FORGE`;

  if(profile.forgeable){
    forgeActionHint.textContent=
      "Consumes 1 Iron Ore and starts one FriendSDK play.";
  }else{
    forgeActionHint.textContent=
      `${profile.label} odds are preview-only until this material has an authoritative SDK consumable/game definition.`;
  }
}

function selectForgeMaterial(material){
  if(forgeBusy || economyBusy || pendingPlayId!==null)return;
  if(!FORGE_MATERIALS[material])return;

  selectedForgeMaterial=material;

  for(const button of [
    forgeMaterialIron,
    forgeMaterialGold,
    forgeMaterialDiamond
  ]){
    const active=button.dataset.forgeMaterial===material;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  }

  renderForgeOdds();

  const profile=FORGE_MATERIALS[selectedForgeMaterial];

  if(profile.forgeable){
    setForgeStatus(
      ore>0 ? "FORGE READY" : "NEED IRON ORE",
      "idle"
    );
  }else{
    setForgeStatus(
      `${profile.label.toUpperCase()} PROFILE PREVIEW`,
      "preview"
    );
  }

  updateForgeUi();
  playFriendSound("select",.45);
}

function updateForgeUi(){
  const oreCount=root.querySelector("#forgeOreCount");
  if(oreCount)oreCount.textContent=ore;

  const hasPending=pendingPlayId!==null;
  const profile=FORGE_MATERIALS[selectedForgeMaterial];

  forgePendingCard.hidden=!hasPending;

  if(hasPending){
    forgePendingId.textContent=`#${pendingPlayId.toString()}`;
    selectedForgeMaterial="iron";

    for(const button of [
      forgeMaterialIron,
      forgeMaterialGold,
      forgeMaterialDiamond
    ]){
      const active=button.dataset.forgeMaterial==="iron";
      button.classList.toggle("active",active);
      button.disabled=true;
      button.setAttribute("aria-pressed",String(active));
    }

    renderForgeOdds();

    forgeOreButton.textContent=
      `[ resume play #${pendingPlayId.toString()} ]`;

    forgeActionMaterial.textContent="PENDING IRON PLAY";
    forgeActionHint.textContent=
      "This play already consumed its Iron Ore. Resume settlement only.";

    forgeOreButton.disabled=forgeBusy || economyBusy;
    forgeGoMineButton.disabled=true;
  }else{
    forgeMaterialIron.disabled=forgeBusy || economyBusy;
    forgeMaterialGold.disabled=forgeBusy || economyBusy;
    forgeMaterialDiamond.disabled=forgeBusy || economyBusy;

    if(profile.forgeable){
      forgeOreButton.textContent="[ forge iron · 1 ore ]";
      forgeOreButton.disabled=
        forgeBusy ||
        economyBusy ||
        ore<1;

      forgeGoMineButton.disabled=forgeBusy || economyBusy;
    }else{
      forgeOreButton.textContent=
        `[ ${profile.label.toLowerCase()} forge · locked ]`;

      forgeOreButton.disabled=true;
      forgeGoMineButton.disabled=false;
    }
  }

  updateHud();
}

function openForgeMenu(){
  playFriendSound("select",.55);
  cancelAutoNavigation();
  target=null;

  if(pendingPlayId!==null){
    selectedForgeMaterial="iron";
  }

  renderForgeFriendPreview();
  renderForgeOdds();

  const profile=FORGE_MATERIALS[selectedForgeMaterial];

  setForgeStatus(
    pendingPlayId!==null
      ? `PLAY #${pendingPlayId.toString()} PENDING`
      : profile.forgeable
        ? ore>0
          ? "FORGE READY"
          : "NEED IRON ORE"
        : `${profile.label.toUpperCase()} PROFILE PREVIEW`,
    pendingPlayId!==null
      ? "working"
      : profile.forgeable
        ? "idle"
        : "preview"
  );

  updateForgeUi();
  forgeModal.classList.add("show");
}

forgeMaterialIron.addEventListener("click",()=>{
  selectForgeMaterial("iron");
});

forgeMaterialGold.addEventListener("click",()=>{
  selectForgeMaterial("gold");
});

forgeMaterialDiamond.addEventListener("click",()=>{
  selectForgeMaterial("diamond");
});

centralForgeLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    openForgeMenu
  );
});

closeForgeButton.addEventListener("click",()=>{
  if(forgeBusy)return;
  forgeModal.classList.remove("show");
  canvas.focus();
});

forgeGoMineButton.addEventListener("click",()=>{
  if(forgeBusy)return;
  forgeModal.classList.remove("show");
  startBuildingNavigation(
    "Ore Mine",
    BUILDING_APPROACH.oreMine,
    openOreMenu
  );
});

async function startForge(){
  if(forgeBusy || economyBusy)return;

  const resuming=pendingPlayId!==null;

  if(!resuming && selectedForgeMaterial!=="iron"){
    const profile=FORGE_MATERIALS[selectedForgeMaterial];
    setForgeStatus(
      `${profile.label.toUpperCase()} FORGE LOCKED`,
      "preview"
    );
    showToast(
      `${profile.label} odds are preview-only in v0.3.9.`
    );
    return;
  }

  if(!resuming && ore<1){
    showToast("You need Iron Ore first.");
    updateForgeUi();
    return;
  }

  forgeBusy=true;
  economyBusy=true;
  updateForgeUi();

  playFriendSound("action-start",.8);

  setForgeStatus(
    resuming
      ? `RESUMING #${pendingPlayId.toString()}`
      : "COMMITTING PLAY",
    "working"
  );

  const phaseTimer=setTimeout(()=>{
    if(!forgeBusy)return;
    setForgeStatus("AWAITING SETTLEMENT","working");
  },520);

  try{
    const result=await economy.forge();

    if(destroyed){
      clearTimeout(phaseTimer);
      return null;
    }

    clearTimeout(phaseTimer);
    applyEconomyState(result.state);

    updateOreUi();
    updateForgeUi();
    updateCollectionUi();

    if(result.status==="pending"){
      setForgeStatus(
        `PLAY #${result.playId.toString()} PENDING`,
        "working"
      );
      showToast(
        `Play #${result.playId.toString()} is pending · resume later`
      );
      return result;
    }

    const item=ITEMS.find(
      candidate=>candidate.id===result.artifact.id
    ) || result.artifact;

    lastForgedItem=item;
    gameState.lastItemId=item.id;
    collectionSessionDates.set(item.id,new Date());
    updateCollectionUi();

    playFriendSound("action-ready",.72);
    uiVfx.burst(centralForgeLabel,{
      common:"#d5d0c5",uncommon:"#bddb9b",rare:"#a9d2ef",
      epic:"#d7b9eb",legendary:"#f5d889",mythic:"#f4b8d5"
    }[result.artifact.rarity] ?? "#fff4d7",11);
    uiVfx.feedback();
    setForgeStatus("FORGE SETTLED","success");

    setTimeout(()=>{
      forgeModal.classList.remove("show");
      canvas.focus();
    },180);
    return result;
  }catch(error){
    clearTimeout(phaseTimer);

    // Refresh once after an error because a play may already have committed.
    try{
      const next=await economy.read();
      applyEconomyState(next);
      updateOreUi();
      updateCollectionUi();
    }catch{}

    setForgeStatus(
      pendingPlayId!==null
        ? `PLAY #${pendingPlayId.toString()} PENDING`
        : "FORGE FAILED",
      pendingPlayId!==null ? "working" : "idle"
    );

    showToast(
      error instanceof Error
        ? error.message
        : "Forge transaction failed."
    );
    return null;
  }finally{
    forgeBusy=false;
    economyBusy=false;
    updateOreUi();
    updateForgeUi();
  }
}

forgeOreButton.addEventListener("click",()=>{ void startForge(); });

function collectionSellPanel(item,count,rewardValue){
  if(sellState==="idle"){
    if(sellUncertain && rewardValue>0)return `<div class="collection-collectible">SYNC REQUIRED BEFORE ANOTHER SALE</div><button type="button" class="collection-sell-open" data-sell="sync">[ SYNC NOW ]</button>`;
    return count>0 && rewardValue>0
      ? `<button type="button" class="collection-sell-open" data-sell="open">[ SELL FOR RF ]</button>`
      : `<div class="collection-collectible">${rewardValue>0?"FORGE TO UNLOCK SELLING":"COLLECTIBLE ONLY · NO RF REWARD"}</div>`;
  }
  if(sellItemId!==item.id)return "";

  if(sellState==="processing"){
    return `<div class="collection-sell-panel processing" role="status">
      <b>SELLING THROUGH FRIENDSDK…</b>
      <span>Waiting for confirmation and the refreshed Friend wallet balance.</span>
    </div>`;
  }
  if(sellState==="success"){
    return `<div class="collection-sell-panel success" role="status">
      <b>SALE COMPLETE</b>
      <span>×${sellCompletedQuantity} sold · +${formatRf(sellCompletedRf)} RF to Friend wallet</span>
      <button type="button" data-sell="done">[ DONE ]</button>
    </div>`;
  }
  if(sellState==="error"){
    return `<div class="collection-sell-panel error" role="alert">
      <b>SALE NOT VERIFIED</b>
      <span>${sellMessage}</span>
      <button type="button" data-sell="sync">[ SYNC NOW ]</button>
      <button type="button" data-sell="done">[ CLOSE ]</button>
    </div>`;
  }

  const maximum=Math.min(99,count);
  const total=rewardValue*sellQuantity;
  return `<div class="collection-sell-panel confirm" role="group" aria-label="Confirm artifact sale">
    <b>CONFIRM SALE</b>
    <span>${item.name} · ${formatRf(rewardValue)} RF each</span>
    <div class="collection-sell-quantity">
      <button type="button" data-sell="minus" ${sellQuantity<=1?"disabled":""} aria-label="Sell one fewer">−</button>
      <strong>×${sellQuantity}</strong>
      <button type="button" data-sell="plus" ${sellQuantity>=maximum?"disabled":""} aria-label="Sell one more">+</button>
      <button type="button" data-sell="max" ${sellQuantity>=maximum?"disabled":""}>MAX ${maximum}</button>
    </div>
    <div class="collection-sell-totals"><span>FRIEND WALLET</span><strong>+${formatRf(total)} RF</strong></div>
    <small>These copies leave your Collection. FriendSDK will request final approval.</small>
    <div class="collection-sell-actions">
      <button type="button" data-sell="cancel">[ CANCEL ]</button>
      <button type="button" data-sell="confirm">[ CONFIRM SALE ]</button>
    </div>
  </div>`;
}

function updateCollectionUi(){
  const unique=discoveredCount();
  const best=[...ITEMS].reverse().find(item=>inventoryCount(item.id)>0) || null;
  root.querySelector("#collectionCount").textContent=`${unique} / ${ITEMS.length}`;
  root.querySelector("#collectionCopies").textContent=totalItemCopies();
  collectionBest.textContent=best ? best.name : "NONE YET";

  const filters=["all",...FORGE_RARITIES];
  collectionFilters.innerHTML=filters.map(rarity=>`
    <button type="button" class="collection-filter ${rarity===collectionFilter?"active":""}"
      data-filter="${rarity}" aria-pressed="${rarity===collectionFilter}">
      ${rarity==="all"?"ALL 12":RARITY_LABELS[rarity].toUpperCase()}
    </button>
  `).join("");

  const visible=ITEMS.filter(item=>collectionFilter==="all" || item.rarity===collectionFilter);
  if(!visible.some(item=>item.id===selectedCollectionId)){
    selectedCollectionId=(collectionFilter==="all" && best ? best : visible[0])?.id ?? null;
  }

  const list=root.querySelector("#collectionList");
  list.innerHTML=visible.map(item=>{
    const count=inventoryCount(item.id);
    const discovered=count>0;
    const art=discovered ? artifactArtwork(item.id) : artifactSilhouette(item.id);
    return `
      <button type="button" class="collection-item artifact-frame ${item.rarity} ${discovered?"":"locked"} ${selectedCollectionId===item.id?"selected":""}"
        data-item="${item.id}" data-rarity="${item.rarity}" aria-pressed="${selectedCollectionId===item.id}"
        aria-label="${discovered?`${item.name}, ${RARITY_LABELS[item.rarity]}, ${count} owned`:`Undiscovered ${RARITY_LABELS[item.rarity]} artifact`}">
        <span class="collection-slot-number">${String(ITEMS.indexOf(item)+1).padStart(2,"0")}</span>
        <span class="artifact-thumb-shell" aria-hidden="true">
          ${art?`<img class="artifact-thumb ${discovered?"":"artifact-silhouette"}" src="${art}" alt="">`:`<span class="artifact-art-fallback">?</span>`}
        </span>
        <span class="item-name">${discovered?item.name:"???"}</span>
        <span class="item-meta"><span class="rarity-tag">${RARITY_LABELS[item.rarity]}</span><b>${discovered?`×${count}`:"LOCKED"}</b></span>
      </button>
    `;
  }).join("");

  const selected=ITEMS.find(item=>item.id===selectedCollectionId) || null;
  if(selected){
    const count=inventoryCount(selected.id);
    const discovered=count>0;
    const art=discovered ? artifactArtwork(selected.id) : artifactSilhouette(selected.id);
    const lastForged=collectionSessionDates.get(selected.id);
    const date=discovered && lastForged
      ? new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric"}).format(lastForged)
      : discovered ? "NOT RECORDED" : "—";
    const rewardValue=artifactRewardRf(selected.id);
    collectionDetail.innerHTML=`
      <div class="collection-detail-top"><span>ARTIFACT FILE</span><b>${discovered?"DISCOVERED":"UNDISCOVERED"}</b></div>
      <div class="collection-detail-art artifact-frame ${selected.rarity} ${discovered?"":"locked"}">
        ${art?`<img class="${discovered?"":"artifact-silhouette"}" src="${art}" alt="${discovered?selected.name:"Undiscovered artifact silhouette"}">`:"?"}
      </div>
      <h3>${discovered?selected.name:"Unknown Artifact"}</h3>
      <p>${discovered?selected.desc:"Forge this artifact to reveal its story."}</p>
      <div class="collection-detail-stats">
        <div><small>RARITY</small><strong>${RARITY_LABELS[selected.rarity].toUpperCase()}</strong></div>
        <div><small>OWNED</small><strong>${discovered?`×${count}`:"—"}</strong></div>
        <div><small>LAST FORGED</small><strong>${date}</strong></div>
        <div><small>RF REWARD VALUE</small><strong>${discovered?`${rewardValue.toFixed(2)} RF`:"—"}</strong></div>
      </div>
      ${discovered && !lastForged?`<small class="collection-date-note">Older acquisition dates are not available from FriendSDK.</small>`:""}
      ${collectionSellPanel(selected,count,rewardValue)}
    `;
  }else{
    collectionDetail.innerHTML="<p>Select an artifact.</p>";
  }
  updateHud();
}

async function confirmCollectionSale(){
  if(sellState!=="confirm" || economyBusy || forgeBusy || sellUncertain || !sellItemId)return;
  const artifactId=sellItemId;
  const quantity=sellQuantity;
  const beforeCount=inventoryCount(artifactId);
  const beforeRf=rf;
  if(artifactRewardRf(artifactId)<=0 || quantity<1 || quantity>Math.min(99,beforeCount))return;

  sellState="processing";
  economyBusy=true;
  updateCollectionUi();
  updateForgeUi();
  updateOreUi();

  try{
    const next=await economy.redeem(artifactId,quantity);
    if(destroyed)return;
    applyEconomyState(next);
  }catch(error){
    if(destroyed)return;
    // A wallet/bridge error can arrive after submission. Read once, never resubmit automatically.
    try{ applyEconomyState(await economy.read()); }catch{}
    if(destroyed)return;
    showToast(error instanceof Error ? error.message : "Sale could not be verified.");
  }finally{
    economyBusy=false;
    if(!destroyed){
      const sold=beforeCount-inventoryCount(artifactId);
      const credited=rf-beforeRf;
      const expected=artifactRewardRf(artifactId)*quantity;
      if(sold>=quantity && credited+0.000001>=expected){
        sellCompletedQuantity=sold;
        sellCompletedRf=Math.max(0,credited);
        sellState="success";
        sellUncertain=false;
        playFriendSound("reward",.72);
      }else{
        sellMessage="Sync your Friend wallet and Collection before another sale.";
        sellState="error";
        sellUncertain=true;
      }
      updateOreUi();
      updateForgeUi();
      updateCollectionUi();
    }
  }
}

collectionDetail.addEventListener("click",event=>{
  const button=event.target instanceof Element ? event.target.closest("button[data-sell]") : null;
  if(!button || economyBusy || forgeBusy)return;
  const action=button.dataset.sell;
  if(action==="sync"){
    syncButton.click();
    return;
  }else if(action==="open"){
    const item=ITEMS.find(candidate=>candidate.id===selectedCollectionId);
    if(!item || sellUncertain || inventoryCount(item.id)<1 || artifactRewardRf(item.id)<=0)return;
    sellItemId=item.id;
    sellQuantity=1;
    sellState="confirm";
    playFriendSound("select",.55);
  }else if(action==="minus" && sellState==="confirm"){
    sellQuantity=Math.max(1,sellQuantity-1);
  }else if(action==="plus" && sellState==="confirm"){
    sellQuantity=Math.min(99,inventoryCount(sellItemId),sellQuantity+1);
  }else if(action==="max" && sellState==="confirm"){
    sellQuantity=Math.min(99,inventoryCount(sellItemId));
  }else if(action==="cancel" || action==="done"){
    sellState="idle";
    sellItemId=null;
  }else if(action==="confirm"){
    void confirmCollectionSale();
    return;
  }else return;
  updateCollectionUi();
  collectionDetail.querySelector(`[data-sell="${action==="open"?"confirm":action}"]`)?.focus();
});

collectionFilters.addEventListener("click",event=>{
  const button=event.target instanceof Element ? event.target.closest("button[data-filter]") : null;
  if(!button || sellState!=="idle" || economyBusy)return;
  collectionFilter=button.dataset.filter;
  playFriendSound("select",.45);
  updateCollectionUi();
  collectionFilters.querySelector(`[data-filter="${collectionFilter}"]`)?.focus();
});

root.querySelector("#collectionList").addEventListener("click",event=>{
  const button=event.target instanceof Element ? event.target.closest("button[data-item]") : null;
  if(!button || sellState!=="idle" || economyBusy)return;
  selectedCollectionId=button.dataset.item;
  playFriendSound("select",.45);
  updateCollectionUi();
  root.querySelector(`#collectionList [data-item="${selectedCollectionId}"]`)?.focus();
});

function openCollectionMenu(){
  playFriendSound("select",.55);
  cancelAutoNavigation();
  target=null;
  updateCollectionUi();
  collectionModal.classList.add("show");
  collectionFilters.querySelector("button")?.focus();
}

collectionLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Collection",
    BUILDING_APPROACH.collection,
    openCollectionMenu
  );
});

closeCollectionButton.addEventListener("click",()=>{
  if(economyBusy)return;
  sellState="idle";
  sellItemId=null;
  collectionModal.classList.remove("show");
  canvas.focus();
});

collectionGoForgeButton.addEventListener("click",()=>{
  if(economyBusy)return;
  sellState="idle";
  sellItemId=null;
  collectionModal.classList.remove("show");
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    openForgeMenu
  );
});

revealForgeAgain.addEventListener("click",()=>{
  revealModal.classList.remove("show");
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    openForgeMenu
  );
});

revealGoCollection.addEventListener("click",()=>{
  revealModal.classList.remove("show");
  startBuildingNavigation(
    "Collection",
    BUILDING_APPROACH.collection,
    openCollectionMenu
  );
});

revealClose.addEventListener("click",()=>{
  revealModal.classList.remove("show");
  canvas.focus();
});

syncButton.addEventListener("click",async()=>{
  if(economyBusy || forgeBusy)return;

  economyBusy=true;
  syncButton.disabled=true;

  try{
    const next=await economy.read();
    if(destroyed)return;
    applyEconomyState(next);
    sellUncertain=false;
    sellState="idle";
    sellItemId=null;

    oreModal.classList.remove("show");
    forgeModal.classList.remove("show");
    collectionModal.classList.remove("show");
    revealModal.classList.remove("show");

    updateOreUi();
    updateForgeUi();
    updateCollectionUi();
    setForgeStatus(
      pendingPlayId!==null
        ? `PLAY #${pendingPlayId.toString()} PENDING`
        : ore>0
          ? "FORGE READY"
          : "NEED ORE",
      pendingPlayId!==null ? "working" : "idle"
    );
    showToast(
      pendingPlayId!==null
        ? `Synced · play #${pendingPlayId.toString()} is pending`
        : "Synced with FriendSDK."
    );
  }catch(error){
    showToast(error instanceof Error ? error.message : "FriendSDK sync failed.");
  }finally{
    economyBusy=false;
    syncButton.disabled=false;
    updateOreUi();
    updateForgeUi();
  }
});
const reforgeModal=root.querySelector("#reforgeModal");
const reforgeCard=reforgeModal.querySelector(".reforge-card");
let selectedReforgeMachine="dice";
let selectedReforgeItemId=null;
let reforgePhase="choose";
let reforgeBusy=false;
let reforgeMessage="";
let reforgeBaseline=null;
let reforgeLastResult=null;
const REFORGE_MACHINE_PRESENTATIONS={
  dice:{symbol:"⚄",name:"DICE",line:"Dice styling",detail:"Choose a dice-themed machine card. The artifact is still revealed by the Forge cinematic."},
  lots:{symbol:"▣",name:"LOTS",line:"Ticket styling",detail:"Choose a ticket-themed machine card. The artifact is still revealed by the Forge cinematic."},
  cases:{symbol:"◇",name:"CASES",line:"Case styling",detail:"Choose a sealed-case machine card. The artifact is still revealed by the Forge cinematic."}
};

function eligibleReforgeItems(){
  return ITEMS.filter(item=>inventoryCount(item.id)>=2 && artifactRewardRf(item.id)>0);
}

function reforgeStepVerified(){
  if(!reforgeBaseline)return false;
  if(reforgeBaseline.kind==="sale"){
    return inventoryCount(reforgeBaseline.itemId)<=reforgeBaseline.count-1 &&
      rf+0.000001>=reforgeBaseline.rf+reforgeBaseline.reward;
  }
  return ore>=reforgeBaseline.ore+1 && rf<=reforgeBaseline.rf-1+0.000001;
}

function renderReforgeMenu(){
  const eligible=eligibleReforgeItems();
  const zeroRewardDuplicates=ITEMS.filter(item=>inventoryCount(item.id)>=2 && artifactRewardRf(item.id)===0);
  if(reforgePhase==="choose" && !eligible.some(item=>item.id===selectedReforgeItemId)){
    selectedReforgeItemId=eligible[0]?.id ?? null;
  }
  const selected=ITEMS.find(item=>item.id===selectedReforgeItemId);
  const reward=selected?artifactRewardRf(selected.id):0;
  const refund=reward;
  const net=refund-1;
  const canFundOre=rf+refund+0.000001>=1;
  const machine=REFORGE_MACHINE_PRESENTATIONS[selectedReforgeMachine];
  const action=reforgePhase==="choose"
    ? `<button type="button" data-reforge-action="review" ${!selected || !canFundOre || pendingPlayId!==null?"disabled":""}>REVIEW EXCHANGE →</button>`
    : reforgePhase==="confirm"
      ? `<button type="button" data-reforge-action="redeem">CONFIRM SALE OF 1 COPY →</button>`
      : reforgePhase==="redeemed"
        ? `<button type="button" data-reforge-action="buy">BUY 1 IRON ORE · 1 RF →</button>`
        : reforgePhase==="bought"
          ? `<button type="button" data-reforge-action="forge">FORGE WITH SDK →</button>`
          : reforgePhase==="pending"
            ? `<button type="button" data-reforge-action="resume">RESUME PLAY #${pendingPlayId?.toString()??"?"} →</button>`
            : reforgePhase==="uncertain"
              ? `<button type="button" data-reforge-action="sync">SYNC SDK STATE →</button>`
              : reforgePhase==="complete"
                ? `<button type="button" data-reforge-action="reset">NEW REFORGE →</button>`
                : `<button type="button" disabled>SDK ACTION IN PROGRESS…</button>`;
  const phaseText={
    choose:selected && !canFundOre
      ? `One ${selected.name} returns ${formatRf(refund)} RF, but the Friend wallet would still have less than 1 RF for Iron Ore. Add RF before starting.`
      : "Select a redeemable duplicate (×2 or more). One copy stays in Collection; one is sold through FriendSDK.",
    confirm:`One extra ${selected?.name??"artifact"} sells for ${formatRf(refund)} RF. Buying one Iron Ore costs 1 RF. Net wallet change: ${net>=0?"+":""}${formatRf(net)} RF. The new artifact uses the ordinary Iron Forge odds. These are separate SDK confirmations.`,
    processing:"Wait for the current FriendSDK action to finish. Do not retry or leave until its state is checked.",
    redeemed:"One extra copy was sold through FriendSDK. Next, buy one Iron Ore for the ordinary 1 RF price. You may close this window and return later in this session.",
    bought:"One Iron Ore was purchased. Start the ordinary FriendSDK Forge; its existing pending/resume behavior applies.",
    pending:`Play #${pendingPlayId?.toString()??"?"} is pending. Resume this exact SDK play without selling more artifacts or buying more Ore.`,
    animating:"Machine presentation is starting. No rarity or artifact is chosen by this animation.",
    uncertain:"An action may have completed, but its final state is uncertain. Sync the SDK state before doing anything else; no action will be retried automatically.",
    complete:`${reforgeLastResult?.name??"Artifact"} was settled by FriendSDK and revealed in the Forge cinematic. The exchange is complete.`
  };
  reforgeCard.innerHTML=`
    <div class="reforge-v04-head">
      <div><small>FRIEND FORGE · SDK EXCHANGE</small><h2>REFORGE</h2><p>Sell one duplicate, buy Iron Ore, then Forge with FriendSDK.</p></div>
      <div class="reforge-v04-balance"><span>FRIEND WALLET</span><strong>${formatRf(rf)} RF</strong></div>
    </div>
    <div class="reforge-v04-body">
      <div class="reforge-v04-label">PRESENTATION MACHINE · SAME IRON ODDS</div>
      <div class="reforge-machine-tabs" role="tablist" aria-label="Reforge machines">
        ${Object.entries(REFORGE_MACHINE_PRESENTATIONS).map(([id,entry])=>`
          <button type="button" role="tab" data-reforge-machine="${id}" aria-selected="${id===selectedReforgeMachine}" class="reforge-machine-tab ${id===selectedReforgeMachine?"is-active":""}">
            <b aria-hidden="true">${entry.symbol}</b><strong>${entry.name}</strong><small>${entry.line}</small><span>IRON ODDS</span>
          </button>`).join("")}
      </div>
      <div class="reforge-v04-detail" role="tabpanel">
        <div><small>${machine.name} REVEAL</small><strong>SDK decides the artifact before the animation.</strong><p>${machine.detail}</p></div>
        <div class="reforge-v04-recipe"><small>EXCHANGE</small><strong>SELL 1 → BUY 1 ORE → FORGE</strong><span>Keep one copy · 1 Ore = 1 RF</span></div>
      </div>
      ${reforgePhase==="animating"?`<div class="reforge-v04-machine-scene machine-${selectedReforgeMachine}" aria-hidden="true"><i>${machine.symbol}</i><i>${machine.symbol}</i><i>${machine.symbol}</i><span>${machine.name} · SDK FORGE NEXT</span></div>`:""}
      ${reforgePhase==="choose" || reforgePhase==="confirm" ? `<div class="reforge-v04-sources"><small>CHOOSE ONE SURPLUS COPY · KEEP ONE</small><div>${eligible.map(item=>`<button type="button" data-reforge-item="${item.id}" class="${item.id===selectedReforgeItemId?"is-active":""}" ${reforgePhase!=="choose"?"disabled":""}>${item.name} ×${inventoryCount(item.id)} <span>${formatRf(artifactRewardRf(item.id))} RF back</span></button>`).join("")}${zeroRewardDuplicates.map(item=>`<button type="button" disabled title="FriendSDK cannot redeem a 0 RF collectible">${item.name} ×${inventoryCount(item.id)} <span>0 RF · NOT REDEEMABLE</span></button>`).join("")}${!eligible.length && !zeroRewardDuplicates.length?"<strong>No duplicate artifacts (×2) in the SDK inventory yet.</strong>":""}</div>${zeroRewardDuplicates.length?"<p class=\"reforge-v04-zero-note\">Common duplicates are shown here, but FriendSDK rejects redeeming a 0 RF collectible. They cannot be consumed for Reforge without a new authoritative action.</p>":""}</div>`:""}
      <div class="reforge-v04-inventory"><small>SDK STEP</small><strong>${phaseText[reforgePhase]}</strong></div>
      ${reforgeMessage?`<p class="reforge-v04-message" role="status" id="reforgeMessage"></p>`:""}
    </div>
    <div class="reforge-v04-footer"><span>REDEEM / BUY / PLAY / SETTLE · FRIENDSDK</span><div>${reforgePhase==="confirm"?`<button type="button" data-reforge-action="change">CHANGE ARTIFACT</button>`:""}${action}<button type="button" id="closeReforge" ${reforgeBusy?"disabled":""}>BACK TO ISLAND</button></div></div>
  `;
  if(reforgeMessage)reforgeCard.querySelector("#reforgeMessage").textContent=reforgeMessage;
}

function openReforgeMenu(){
  if(reforgeBusy || economyBusy)return;
  playFriendSound("select",.55);
  cancelAutoNavigation();
  target=null;
  renderReforgeMenu();
  reforgeModal.classList.add("show");
}

function refreshAfterReforgeStep(){
  updateOreUi();
  updateForgeUi();
  updateCollectionUi();
  if(!destroyed)renderReforgeMenu();
}

async function redeemReforgeCopies(){
  if(reforgePhase!=="confirm" || reforgeBusy || economyBusy || !selectedReforgeItemId)return;
  const itemId=selectedReforgeItemId;
  reforgeBusy=true;
  economyBusy=true;
  reforgePhase="processing";
  reforgeMessage="Selling one extra copy through FriendSDK…";
  renderReforgeMenu();

  try{
    applyEconomyState(await economy.read());
    if(destroyed)return;
    const reward=artifactRewardRf(itemId);
    if(inventoryCount(itemId)<2 || reward<=0 || rf+reward+0.000001<1){
      reforgeBaseline=null;
      reforgePhase="choose";
      reforgeMessage="The SDK balance or surplus copies changed. Sync and choose again.";
      return;
    }
    reforgeBaseline={kind:"sale",itemId,count:inventoryCount(itemId),rf,reward};
    applyEconomyState(await economy.redeem(itemId,1));
    if(destroyed)return;
    reforgePhase=reforgeStepVerified()?"redeemed":"uncertain";
    reforgeMessage=reforgePhase==="redeemed"
      ? `One extra copy sold. ${formatRf(reward)} RF returned to the Friend wallet.`
      : "The sale was submitted, but the SDK state needs verification.";
  }catch(error){
    if(destroyed)return;
    try{applyEconomyState(await economy.read());}catch{}
    reforgePhase=reforgeBaseline && reforgeStepVerified()?"redeemed":reforgeBaseline?"uncertain":"choose";
    reforgeMessage=reforgePhase==="redeemed"
      ? "The SDK confirms the sale despite an interrupted response. Continue with the Ore purchase."
      : error instanceof Error?error.message:"The sale could not be verified. Sync before continuing.";
  }finally{
    reforgeBusy=false;
    economyBusy=false;
    refreshAfterReforgeStep();
  }
}

async function buyReforgeOre(){
  if(reforgePhase!=="redeemed" || reforgeBusy || economyBusy)return;
  reforgeBusy=true;
  economyBusy=true;
  reforgePhase="processing";
  reforgeMessage="Buying one Iron Ore at the standard 1 RF SDK price…";
  renderReforgeMenu();

  try{
    applyEconomyState(await economy.read());
    if(destroyed)return;
    if(rf+0.000001<1){
      reforgePhase="redeemed";
      reforgeMessage="The sale is complete, but the Friend wallet needs 1 RF to buy Iron Ore.";
      return;
    }
    reforgeBaseline={kind:"buy",ore,rf};
    applyEconomyState(await economy.buy(1));
    if(destroyed)return;
    reforgePhase=reforgeStepVerified()?"bought":"uncertain";
    reforgeMessage=reforgePhase==="bought"
      ? "One Iron Ore purchased. The next step is the ordinary FriendSDK Forge."
      : "The purchase was submitted, but the SDK state needs verification.";
  }catch(error){
    if(destroyed)return;
    try{applyEconomyState(await economy.read());}catch{}
    reforgePhase=reforgeBaseline?.kind==="buy" && reforgeStepVerified()?"bought":reforgeBaseline?.kind==="buy"?"uncertain":"redeemed";
    reforgeMessage=reforgePhase==="bought"
      ? "The SDK confirms the Ore purchase despite an interrupted response. Continue to Forge."
      : error instanceof Error?error.message:"The Ore purchase could not be verified. Sync before continuing.";
  }finally{
    reforgeBusy=false;
    economyBusy=false;
    refreshAfterReforgeStep();
  }
}

async function syncReforgeStep(){
  if(reforgeBusy || economyBusy)return;
  reforgeBusy=true;
  economyBusy=true;
  try{
    applyEconomyState(await economy.read());
    if(destroyed)return;
    if(reforgeBaseline?.kind==="sale"){
      if(reforgeStepVerified())reforgePhase="redeemed";
      else if(inventoryCount(reforgeBaseline.itemId)===reforgeBaseline.count && Math.abs(rf-reforgeBaseline.rf)<0.000001)reforgePhase="confirm";
    }else if(reforgeBaseline?.kind==="buy"){
      if(reforgeStepVerified())reforgePhase="bought";
      else if(ore===reforgeBaseline.ore && Math.abs(rf-reforgeBaseline.rf)<0.000001)reforgePhase="redeemed";
    }
    reforgeMessage=reforgePhase==="uncertain"
      ? "SDK state still cannot prove the previous action. Check Collection and wallet before trying again."
      : "SDK state synced. Continue from the verified step.";
  }catch(error){
    reforgeMessage=error instanceof Error?error.message:"Could not read FriendSDK state.";
  }finally{
    reforgeBusy=false;
    economyBusy=false;
    refreshAfterReforgeStep();
  }
}

async function forgeReforgeOre(){
  if(!["bought","pending"].includes(reforgePhase) || reforgeBusy || economyBusy)return;
  if(reforgePhase==="pending" && pendingPlayId===null){
    reforgePhase="uncertain";
    reforgeMessage="The pending play is no longer in the SDK snapshot. Sync before starting another Forge.";
    renderReforgeMenu();
    return;
  }
  reforgeBusy=true;
  reforgePhase="animating";
  reforgeMessage=`${REFORGE_MACHINE_PRESENTATIONS[selectedReforgeMachine].name} presentation · FriendSDK is settling the ordinary Iron Forge.`;
  playFriendSound("anticipation",.52);
  renderReforgeMenu();
  await new Promise(resolve=>setTimeout(resolve,680));
  if(destroyed)return;
  reforgeModal.classList.remove("show");
  selectedForgeMaterial="iron";
  updateForgeUi();
  const result=await startForge();
  reforgeBusy=false;
  if(destroyed)return;
  if(result?.status==="settled"){
    reforgeLastResult=result.artifact;
    reforgePhase="complete";
    reforgeBaseline=null;
    reforgeMessage="Result settled by FriendSDK. The Forge cinematic shows the artifact.";
  }else if(pendingPlayId!==null){
    reforgePhase="pending";
    reforgeMessage=`Play #${pendingPlayId.toString()} is pending. Resume this exact play.`;
  }else if(ore>=1){
    reforgePhase="bought";
    reforgeMessage="The Forge did not commit. The purchased Ore is still available.";
  }else{
    reforgePhase="uncertain";
    reforgeMessage="Forge state is uncertain. Sync with FriendSDK before another action.";
  }
}

reforgeLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Reforge",
    BUILDING_APPROACH.reforge,
    openReforgeMenu
  );
});

reforgeModal.addEventListener("click",event=>{
  if(reforgeBusy)return;
  const machineButton=event.target.closest("[data-reforge-machine]");
  if(machineButton){
    selectedReforgeMachine=machineButton.dataset.reforgeMachine;
    playFriendSound("select",.42);
    sounds?.accent?.(selectedReforgeMachine,.75);
    renderReforgeMenu();
    reforgeModal.querySelector(`[data-reforge-machine="${selectedReforgeMachine}"]`)?.focus();
    return;
  }
  const itemButton=event.target.closest("[data-reforge-item]");
  if(itemButton && reforgePhase==="choose"){
    selectedReforgeItemId=itemButton.dataset.reforgeItem;
    playFriendSound("select",.42);
    renderReforgeMenu();
    reforgeModal.querySelector(`[data-reforge-item="${selectedReforgeItemId}"]`)?.focus();
    return;
  }
  const actionButton=event.target.closest("[data-reforge-action]");
  if(actionButton){
    const action=actionButton.dataset.reforgeAction;
    if(action==="review" && selectedReforgeItemId && pendingPlayId===null){
      reforgePhase="confirm";
      reforgeMessage="Review the exact sale payout and the 1 RF Ore purchase before confirming.";
      renderReforgeMenu();
    }else if(action==="change"){
      reforgePhase="choose";
      reforgeMessage="";
      renderReforgeMenu();
    }else if(action==="redeem"){
      void redeemReforgeCopies();
    }else if(action==="buy"){
      void buyReforgeOre();
    }else if(action==="forge" || action==="resume"){
      void forgeReforgeOre();
    }else if(action==="sync"){
      void syncReforgeStep();
    }else if(action==="reset"){
      reforgePhase="choose";
      selectedReforgeItemId=null;
      reforgeBaseline=null;
      reforgeLastResult=null;
      reforgeMessage="";
      renderReforgeMenu();
    }
    return;
  }
  if(event.target.closest("#closeReforge")){
    reforgeModal.classList.remove("show");
    canvas.focus();
  }
});


const communityFurnaceModal=root.querySelector("#communityFurnaceModal");
const communityFurnaceArcade=mountCommunityFurnaceArcade(communityFurnaceModal,{
  isPaused,
  playSound:playFriendSound,
  onClose(){
    communityFurnaceModal.classList.remove("show");
    canvas.focus();
  }
});

function openCommunityFurnaceMenu(){
  cancelAutoNavigation();
  target=null;
  communityFurnaceArcade.open();
}

communityFurnaceLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Community Furnace",
    BUILDING_APPROACH.communityFurnace,
    openCommunityFurnaceMenu
  );
});

const friendHud=root.querySelector("#friendHud");
if(friendHud){
  friendHud.textContent=friendSprites
    ? `FRIEND #${friendId.toString()} · ${friendSprites.familyName.toUpperCase()}`
    : `FRIEND #${friendId.toString()} · FALLBACK`;
}

updateOreUi();
updateForgeUi();
updateCollectionUi();
setForgeStatus(
  pendingPlayId!==null
    ? `PLAY #${pendingPlayId.toString()} PENDING`
    : ore>0
      ? "FORGE READY"
      : "NEED ORE",
  pendingPlayId!==null ? "working" : "idle"
);

canvas.focus();
rafId=requestAnimationFrame(loop);


  return {
    destroy() {
      if(destroyed)return;
      destroyed=true;

      if(rafId)cancelAnimationFrame(rafId);
      if(toastTimer)clearTimeout(toastTimer);
      sceneObserver.disconnect();
      for(const observer of modalObservers)observer.disconnect();
      communityFurnaceArcade.destroy();
      miningDig.destroy();
      uiVfx.destroy();

      root.removeEventListener("click",blockWhilePaused,true);
      root.removeEventListener("pointerdown",blockWhilePaused,true);
      root.removeEventListener("pointerdown",unlockAudioGesture,true);
      root.removeEventListener("keydown",unlockAudioGesture,true);

      root.innerHTML="";
    }
  };
}
