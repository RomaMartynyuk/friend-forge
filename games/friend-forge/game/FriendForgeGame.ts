// @ts-nocheck
import { GAME_MARKUP } from "./GameMarkup";

export type FriendForgeMountOptions = {
  friendId: bigint;
  getPaused: () => boolean;
};

export type FriendForgeController = {
  destroy: () => void;
};

export function mountFriendForge(
  root: HTMLElement,
  options: FriendForgeMountOptions
): FriendForgeController {
  const friendId = options.friendId;
  const isPaused = options.getPaused;

  root.innerHTML = GAME_MARKUP;

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


const GAME_STORAGE_KEY="friend-forge-v0.2-state";
const DEFAULT_GAME_STATE={
  rf:20,
  ore:0,
  inventory:{},
  totalForges:0,
  spentRF:0,
  lastItemId:null
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

let gameState=loadGameState();
let rf=gameState.rf;
let ore=gameState.ore;
let forgeBusy=false;
let lastForgedItem=null;

function normalizeGameState(raw){
  const safe=raw && typeof raw==="object" ? raw : {};
  const inventory=safe.inventory && typeof safe.inventory==="object" ? safe.inventory : {};

  const normalizedInventory={};
  for(const item of ITEMS){
    const count=Number(inventory[item.id]||0);
    normalizedInventory[item.id]=Number.isFinite(count) && count>0 ? Math.floor(count) : 0;
  }

  return {
    rf:Number.isFinite(Number(safe.rf)) ? Math.max(0,Number(safe.rf)) : DEFAULT_GAME_STATE.rf,
    ore:Number.isFinite(Number(safe.ore)) ? Math.max(0,Math.floor(Number(safe.ore))) : 0,
    inventory:normalizedInventory,
    totalForges:Number.isFinite(Number(safe.totalForges)) ? Math.max(0,Math.floor(Number(safe.totalForges))) : 0,
    spentRF:Number.isFinite(Number(safe.spentRF)) ? Math.max(0,Number(safe.spentRF)) : 0,
    lastItemId:typeof safe.lastItemId==="string" ? safe.lastItemId : null
  };
}

function loadGameState(){
  return normalizeGameState(DEFAULT_GAME_STATE);
}

function saveGameState(){
  gameState.rf=rf;
  gameState.ore=ore;
}

function secureRandom01(){
  if(globalThis.crypto && typeof globalThis.crypto.getRandomValues==="function"){
    const arr=new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0]/4294967296;
  }

  // Fallback only for very old/limited preview environments.
  return Math.random();
}

function secureRandomInt(max){
  if(max<=1)return 0;
  return Math.floor(secureRandom01()*max);
}

function rollArtifact(){
  const roll=secureRandom01()*100;
  let cursor=0;

  for(const item of ITEMS){
    cursor+=item.weight;
    if(roll<cursor)return item;
  }

  return ITEMS[ITEMS.length-1];
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

function drawFriend(){
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

  reforgeLabel.disabled=false;
  reforgeLabel.textContent=nearReforge
    ? "[ REFORGE · interact ]"
    : "[ REFORGE · go ]";

  centralForgeLabel.disabled=false;
  centralForgeLabel.textContent=nearForge
    ? "[ CENTRAL FORGE · interact ]"
    : "[ CENTRAL FORGE · go ]";

  communityFurnaceLabel.disabled=false;
  communityFurnaceLabel.textContent=nearCommunityFurnace
    ? "[ COMMUNITY FURNACE · interact ]"
    : "[ COMMUNITY FURNACE · go ]";

  collectionLabel.disabled=false;
  collectionLabel.textContent=nearCollection
    ? "[ COLLECTION · interact ]"
    : "[ COLLECTION · go ]";
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
    keys.clear();
    target=null;
    cancelAutoNavigation();
    render();
    rafId=rafId=requestAnimationFrame(loop);
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

  if(dx||dy){
    const len=Math.hypot(dx,dy);
    const before={x:player.x,y:player.y};

    moveBy(dx/len*travel,dy/len*travel);
    resolveBuildingOverlap();

    const moved=Math.hypot(player.x-before.x,player.y-before.y);

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
const oreGoForgeButton=root.querySelector("#oreGoForge");
const closeOreButton=root.querySelector("#closeOre");

const forgeModal=root.querySelector("#forgeModal");
const forgeOreButton=root.querySelector("#forgeOre");
const forgeGoMineButton=root.querySelector("#forgeGoMine");
const closeForgeButton=root.querySelector("#closeForge");
const forgeStatus=root.querySelector("#forgeStatus");

const collectionModal=root.querySelector("#collectionModal");
const closeCollectionButton=root.querySelector("#closeCollection");
const collectionGoForgeButton=root.querySelector("#collectionGoForge");

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
const resetDemoButton=root.querySelector("#resetDemo");

let toastTimer=null;

function showToast(message){
  gameToast.textContent=message;
  gameToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>gameToast.classList.remove("show"),1800);
}

function updateHud(){
  root.querySelector("#rfHud").textContent=`RF ${rf.toFixed(0)}`;
  root.querySelector("#oreHud").textContent=`ORE ${ore}`;
  root.querySelector("#collectionHud").textContent=`${discoveredCount()} / ${ITEMS.length}`;
}

function updateOreUi(){
  root.querySelector("#oreCount").textContent=ore;
  root.querySelector("#oreRfCount").textContent=`${rf.toFixed(0)} RF`;

  buyOreButton.disabled=rf<1;
  buyOreFiveButton.disabled=rf<1;
  updateHud();
}

function purchaseOre(amount){
  const requested=Math.max(1,Math.floor(amount));
  const qty=Math.min(requested,Math.floor(rf));

  if(qty<1){
    showToast("Not enough demo RF.");
    return;
  }

  rf-=qty;
  ore+=qty;
  gameState.spentRF+=qty;
  saveGameState();
  updateOreUi();
  updateForgeUi();
  showToast(`+${qty} Ore · -${qty} RF`);
}

function openOreMenu(){
  cancelAutoNavigation();
  target=null;
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
  oreModal.classList.remove("show");
  canvas.focus();
});

buyOreButton.addEventListener("click",()=>purchaseOre(1));
buyOreFiveButton.addEventListener("click",()=>purchaseOre(5));

oreGoForgeButton.addEventListener("click",()=>{
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

function updateForgeUi(){
  const oreCount=root.querySelector("#forgeOreCount");
  if(oreCount)oreCount.textContent=ore;

  forgeOreButton.disabled=forgeBusy || ore<1;
  forgeGoMineButton.disabled=forgeBusy;
  updateHud();
}

function openForgeMenu(){
  cancelAutoNavigation();
  target=null;
  setForgeStatus(ore>0?"FORGE READY":"NEED ORE","idle");
  updateForgeUi();
  forgeModal.classList.add("show");
}

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

function revealArtifact(item,isDuplicate){
  lastForgedItem=item;
  revealCard.className=`reveal-card ${item.rarity}`;
  revealIcon.textContent=item.icon;
  revealName.textContent=item.name;
  revealRarity.textContent=RARITY_LABELS[item.rarity];
  revealCopy.textContent=isDuplicate
    ? `${item.desc} Duplicate copy #${inventoryCount(item.id)} added to your Collection.`
    : `${item.desc} New Collection discovery.`;

  revealForgeAgain.disabled=ore<1;
  revealModal.classList.add("show");
}

function finishForgeRoll(){
  const item=rollArtifact();
  const wasOwned=inventoryCount(item.id)>0;

  gameState.inventory[item.id]=inventoryCount(item.id)+1;
  gameState.totalForges+=1;
  gameState.lastItemId=item.id;
  saveGameState();

  forgeBusy=false;
  setForgeStatus("FORGE COMPLETE","success");
  updateForgeUi();
  updateCollectionUi();

  setTimeout(()=>{
    forgeModal.classList.remove("show");
    revealArtifact(item,wasOwned);
  },260);
}

function startForge(){
  if(forgeBusy)return;

  if(ore<1){
    showToast("You need Ore first.");
    updateForgeUi();
    return;
  }

  forgeBusy=true;
  ore-=1;
  saveGameState();
  updateForgeUi();

  setForgeStatus("HEATING ORE","working");

  setTimeout(()=>{
    if(!forgeBusy)return;
    setForgeStatus("SHAPING ARTIFACT","working");
  },520);

  setTimeout(()=>{
    if(!forgeBusy)return;
    setForgeStatus("ROLLING RESULT","working");
  },1040);

  setTimeout(()=>{
    if(!forgeBusy)return;
    finishForgeRoll();
  },1520);
}

forgeOreButton.addEventListener("click",startForge);

function updateCollectionUi(){
  const unique=discoveredCount();
  root.querySelector("#collectionCount").textContent=`${unique} / ${ITEMS.length}`;
  root.querySelector("#collectionCopies").textContent=totalItemCopies();
  root.querySelector("#collectionForges").textContent=gameState.totalForges;

  const list=root.querySelector("#collectionList");

  list.innerHTML=ITEMS.map(item=>{
    const count=inventoryCount(item.id);
    const discovered=count>0;
    const name=discovered ? item.name : "???";
    const icon=discovered ? item.icon : "◼";
    const rarity=discovered ? RARITY_LABELS[item.rarity] : "Undiscovered";

    return `
      <div class="collection-item ${item.rarity} ${discovered?"":"locked"}">
        <div class="item-icon">${icon}</div>
        <div class="item-name">${name}</div>
        <div class="item-meta">
          <span class="rarity-tag">${rarity}</span>
          <b>${discovered?`×${count}`:"—"}</b>
        </div>
      </div>
    `;
  }).join("");

  updateHud();
}

function openCollectionMenu(){
  cancelAutoNavigation();
  target=null;
  updateCollectionUi();
  collectionModal.classList.add("show");
}

collectionLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Collection",
    BUILDING_APPROACH.collection,
    openCollectionMenu
  );
});

closeCollectionButton.addEventListener("click",()=>{
  collectionModal.classList.remove("show");
  canvas.focus();
});

collectionGoForgeButton.addEventListener("click",()=>{
  collectionModal.classList.remove("show");
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    openForgeMenu
  );
});

revealForgeAgain.addEventListener("click",()=>{
  if(ore<1){
    revealModal.classList.remove("show");
    startBuildingNavigation(
      "Ore Mine",
      BUILDING_APPROACH.oreMine,
      openOreMenu
    );
    return;
  }

  revealModal.classList.remove("show");
  startBuildingNavigation(
    "Central Forge",
    BUILDING_APPROACH.centralForge,
    ()=>{
      openForgeMenu();
      setTimeout(startForge,120);
    }
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

resetDemoButton.addEventListener("click",()=>{
  

  gameState=normalizeGameState(DEFAULT_GAME_STATE);
  rf=gameState.rf;
  ore=gameState.ore;
  forgeBusy=false;
  lastForgedItem=null;

  
  saveGameState();

  oreModal.classList.remove("show");
  forgeModal.classList.remove("show");
  collectionModal.classList.remove("show");
  revealModal.classList.remove("show");

  updateOreUi();
  updateForgeUi();
  updateCollectionUi();
  setForgeStatus("FORGE READY","idle");
  showToast("Demo progress reset.");
});
const reforgeModal=root.querySelector("#reforgeModal");
const closeReforgeButton=root.querySelector("#closeReforge");

function openReforgeMenu(){
  cancelAutoNavigation();
  target=null;
  reforgeModal.classList.add("show");
}

reforgeLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Reforge",
    BUILDING_APPROACH.reforge,
    openReforgeMenu
  );
});

closeReforgeButton.addEventListener("click",()=>{
  reforgeModal.classList.remove("show");
  canvas.focus();
});


const communityFurnaceModal=root.querySelector("#communityFurnaceModal");
const closeCommunityFurnaceButton=root.querySelector("#closeCommunityFurnace");

function openCommunityFurnaceMenu(){
  cancelAutoNavigation();
  target=null;
  communityFurnaceModal.classList.add("show");
}

communityFurnaceLabel.addEventListener("click",()=>{
  startBuildingNavigation(
    "Community Furnace",
    BUILDING_APPROACH.communityFurnace,
    openCommunityFurnaceMenu
  );
});

closeCommunityFurnaceButton.addEventListener("click",()=>{
  communityFurnaceModal.classList.remove("show");
  canvas.focus();
});

const friendHud=root.querySelector("#friendHud");
if(friendHud)friendHud.textContent=`FRIEND #${friendId.toString()}`;

updateOreUi();
updateForgeUi();
updateCollectionUi();
setForgeStatus(ore>0?"FORGE READY":"NEED ORE","idle");

canvas.focus();
rafId=requestAnimationFrame(loop);


  return {
    destroy() {
      destroyed=true;
      if(rafId)cancelAnimationFrame(rafId);
      root.innerHTML="";
    }
  };
}
