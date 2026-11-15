// 3D models from the G-NS Armory (made by the G-ns team with ChatGPT).
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, TorusGeometry, Vector3, MeshStandardMaterial, Shape, SphereGeometry } from 'three';

export const catalog = [["hk416", "HK416", "Primary"], ["ak74", "AK-74", "Primary"], ["mp5", "MP5", "Primary"], ["m4", "Benelli M4", "Primary"], ["awm", "AWM", "Primary"], ["primary5", "M4A1", "Primary"], ["primary6", "AKM", "Primary"], ["primary7", "AK-12", "Primary"], ["primary8", "AK-103", "Primary"], ["primary9", "AKS-74U", "Primary"], ["primary10", "SCAR-L", "Primary"], ["primary11", "SCAR-H", "Primary"], ["primary12", "G36C", "Primary"], ["primary13", "G36K", "Primary"], ["primary14", "AUG A3", "Primary"], ["primary15", "FAMAS", "Primary"], ["primary16", "L85A2", "Primary"], ["primary17", "Tavor X95", "Primary"], ["primary18", "F2000", "Primary"], ["primary19", "SIG MCX", "Primary"], ["primary20", "SIG 553", "Primary"], ["primary21", "Bren 2", "Primary"], ["primary22", "ACR", "Primary"], ["primary23", "HK433", "Primary"], ["primary24", "QBZ-95", "Primary"], ["primary25", "AN-94", "Primary"], ["primary26", "AS VAL", "Primary"], ["primary27", "VSS Vintorez", "Primary"], ["primary28", "SR-3M", "Primary"], ["primary29", "MP7", "Primary"], ["primary30", "P90", "Primary"], ["primary31", "UMP45", "Primary"], ["primary32", "Vector", "Primary"], ["primary33", "MPX", "Primary"], ["primary34", "Scorpion EVO", "Primary"], ["primary35", "PP-19 Vityaz", "Primary"], ["primary36", "Uzi", "Primary"], ["primary37", "MAC-10", "Primary"], ["primary38", "SPAS-12", "Primary"], ["primary39", "Mossberg 590", "Primary"], ["primary40", "Remington 870", "Primary"], ["primary41", "Saiga-12", "Primary"], ["primary42", "KSG", "Primary"], ["primary43", "M249", "Primary"], ["primary44", "M240", "Primary"], ["primary45", "PKM", "Primary"], ["primary46", "MG3", "Primary"], ["primary47", "RPK-74", "Primary"], ["primary48", "M110", "Primary"], ["primary49", "Barrett M82", "Primary"], ["g17", "Glock 17", "Secondary"], ["m1911", "M1911", "Secondary"], ["secondary2", "Glock 19", "Secondary"], ["secondary3", "Glock 18", "Secondary"], ["secondary4", "Glock 26", "Secondary"], ["secondary5", "Glock 34", "Secondary"], ["secondary6", "Beretta M9", "Secondary"], ["secondary7", "Beretta 92X", "Secondary"], ["secondary8", "SIG P226", "Secondary"], ["secondary9", "SIG P229", "Secondary"], ["secondary10", "SIG P320", "Secondary"], ["secondary11", "SIG P365", "Secondary"], ["secondary12", "HK USP", "Secondary"], ["secondary13", "HK P30", "Secondary"], ["secondary14", "HK VP9", "Secondary"], ["secondary15", "HK Mark 23", "Secondary"], ["secondary16", "FN Five-seveN", "Secondary"], ["secondary17", "FN 509", "Secondary"], ["secondary18", "FN FNX-45", "Secondary"], ["secondary19", "CZ 75", "Secondary"], ["secondary20", "CZ P-07", "Secondary"], ["secondary21", "CZ P-09", "Secondary"], ["secondary22", "CZ P-10 C", "Secondary"], ["secondary23", "Walther P99", "Secondary"], ["secondary24", "Walther PPQ", "Secondary"], ["secondary25", "Walther PDP", "Secondary"], ["secondary26", "Walther PPK", "Secondary"], ["secondary27", "Browning Hi-Power", "Secondary"], ["secondary28", "Desert Eagle", "Secondary"], ["secondary29", "Jericho 941", "Secondary"], ["secondary30", "Steyr M9", "Secondary"], ["secondary31", "Springfield XD", "Secondary"], ["secondary32", "Springfield Hellcat", "Secondary"], ["secondary33", "Ruger SR9", "Secondary"], ["secondary34", "Ruger American", "Secondary"], ["secondary35", "Ruger LCP", "Secondary"], ["secondary36", "S&W M&P9", "Secondary"], ["secondary37", "S&W Shield", "Secondary"], ["secondary38", "S&W Model 29", "Secondary"], ["secondary39", "S&W Model 686", "Secondary"], ["secondary40", "Colt Python", "Secondary"], ["secondary41", "Colt King Cobra", "Secondary"], ["secondary42", "Colt Detective Special", "Secondary"], ["secondary43", "Ruger GP100", "Secondary"], ["secondary44", "Ruger Redhawk", "Secondary"], ["secondary45", "Chiappa Rhino", "Secondary"], ["secondary46", "Webley Mk VI", "Secondary"], ["secondary47", "Nagant M1895", "Secondary"], ["secondary48", "Tokarev TT-33", "Secondary"], ["secondary49", "Makarov PM", "Secondary"], ["kabar", "KA-BAR", "Blades"], ["fs", "Fairbairn\u2013Sykes", "Blades"], ["karambit", "Karambit", "Blades"], ["strongarm", "Gerber StrongArm", "Blades"], ["m9", "M9 Bayonet", "Blades"], ["blades5", "Tanto", "Blades"], ["blades6", "Kukri", "Blades"], ["blades7", "Bowie", "Blades"], ["blades8", "Push Dagger", "Blades"], ["blades9", "Combat Tomahawk", "Blades"], ["drone", "Camera quadcopter", "Equipment"], ["m67", "M67", "Equipment"], ["equipment2", "Field Radio", "Equipment"], ["equipment3", "Night Vision", "Equipment"], ["equipment4", "Medical Kit", "Equipment"], ["equipment5", "Rangefinder", "Equipment"], ["equipment6", "Tactical Flashlight", "Equipment"], ["equipment7", "Ballistic Shield", "Equipment"], ["equipment8", "Utility Pack", "Equipment"], ["equipment9", "Camera Sensor", "Equipment"], ["woman", "Woman \u00b7 Black kit", "Operators"], ["man", "Man \u00b7 Black kit", "Operators"], ["operators2", "Recon \u00b7 Woodland", "Operators"], ["operators3", "Scout \u00b7 Desert", "Operators"], ["operators4", "Breacher \u00b7 Urban", "Operators"], ["operators5", "Medic \u00b7 Alpine", "Operators"], ["operators6", "Pilot \u00b7 Navy", "Operators"], ["operators7", "Ranger \u00b7 Olive", "Operators"], ["operators8", "Observer \u00b7 Winter", "Operators"], ["operators9", "Sentinel \u00b7 Coyote", "Operators"]];
const steel=0x464c53, dark=0x22282d, polymer=0x343b3f, wood=0x85512e, silver=0xadbac2, tan=0x7b745f;
const material = color => new MeshStandardMaterial({color, roughness: [steel,silver].includes(color) ? .31 : .78, metalness: [steel,silver,dark].includes(color) ? .8 : .12});
function add(g, geometry, color, x=0,y=0,z=0) {
  const mesh = new Mesh(geometry,material(color));
  mesh.position.set(x,y,z);
  g.add(mesh);
  return mesh;
}
const box=(g,w,h,d,c,x,y,z)=>add(g,new BoxGeometry(w,h,d),c,x,y,z);
function cylinder(g,r,length,c,x,y,z,orientation='x',sides=20) {
  const mesh=add(g,new CylinderGeometry(r,r,length,sides),c,x,y,z);
  if(orientation==='x') mesh.rotation.z=Math.PI/2;
  if(orientation==='z') mesh.rotation.x=Math.PI/2;
  return mesh;
}
function plate(g, points, depth, color) {
  const shape=new Shape();
  points.forEach(([x,y],i)=>i ? shape.lineTo(x,y) : shape.moveTo(x,y));
  shape.closePath();
  return add(g,new ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,steps:1,curveSegments:8}),color,0,0,-depth/2);
}
function pins(g, positions, radius, z) {
  for(const [x,y] of positions) cylinder(g,radius,z,steel,x,y,0,'z',10);
}
function rail(g,start,end,y) {
  box(g,end-start,.045,.13,dark,(start+end)/2,y,0);
  for(let x=start+.045;x<end-.02;x+=.075) box(g,.036,.03,.15,steel,x,y+.025,0);
}
function optic(g,x,y) {
  cylinder(g,.113,.55,dark,x,y,0);
  for(const dx of [-.26,.26]) {
    cylinder(g,.14,.085,steel,x+dx,y,0);
    cylinder(g,.092,.006,0x396772,x+dx*1.18,y,0);
  }
  box(g,.25,.12,.12,polymer,x,y-.14,0);
  cylinder(g,.055,.1,steel,x,y+.13,0,'y');
}
function firearm(g,id) {
  const long = !['g17','m1911'].includes(id);
  if(!long) {
    const classic=id==='m1911';
    plate(g,[[-.65,.16],[.65,.16],[.65,-.04],[.03,-.12],[-.05,-.71],[-.57,-.73],[-.63,-.39],[-.52,-.11],[-.65,-.06]],.22,polymer);
    box(g,1.32,.28,.26,classic?silver:steel,0,.25,0);
    plate(g,[[-.14,-.09],[.39,-.09],[.37,-.35],[-.18,-.39],[-.18,-.32],[.28,-.28],[.29,-.16],[-.14,-.16]],.1,steel);
    box(g,.13,.075,.09,dark,.52,.43,0);
    box(g,.15,.065,.16,dark,-.52,.42,0);
    cylinder(g,.055,.018,dark,.67,.25,0);
    for (let i=0;i<7;i++) box(g,.023,.23,.273,dark,-.6+i*.035,.25,0);
    for(const z of [-.115,.115]) box(g,.37,.42,.02,classic?wood:dark,-.33,-.46,z).rotation.z=-.12;
    for (let i=0;i<7;i++) box(g,.32,.017,.253,classic?0x593722:steel,-.32,-.62+i*.049,0);
    pins(g,[[-.49,-.29],[-.22,-.62]],.026,.27);
    return;
  }
  const isAK=id==='ak74', isSMG=id==='mp5', shotgun=id==='m4', sniper=id==='awm';
  const length=sniper?3.2:isSMG?1.8:shotgun?2.65:2.45;
  const stock=sniper?tan:isAK?wood:polymer;
  plate(g,[[-.9,.1],[-.68,.23],[.63,.24],[.85,.1],[.78,-.16],[-.37,-.17],[-.5,-.24],[-.9,-.18]],.25,isAK?dark:steel);
  plate(g,[[-1.51,.08],[-.68,.105],[-.68,-.08],[-1.12,-.15],[-1.27,-.32],[-1.53,-.34]],.22,stock);
  box(g,.055,.47,.25,dark,-1.51,-.13,0);
  if(sniper || id==='hk416') box(g,.44,.09,.235,dark,-1.19,.13,0);
  plate(g,[[-.49,-.12],[-.16,-.14],[-.2,-.46],[-.44,-.59],[-.62,-.54]],.19,isAK?wood:polymer);
  plate(g,[[-.14,-.14],[.27,-.14],[.25,-.34],[-.19,-.34],[-.19,-.27],[.18,-.26],[.18,-.2],[-.14,-.2]],.085,dark);
  if(!shotgun) {
    const end=isAK?.73:isSMG?.31:.47;
    plate(g,[[.28,-.13],[.59,-.13],[end,-.65],[end-.22,-.67],[.4,-.43]],.19,dark);
    for(let i=0;i<5;i++) box(g,.16,.022,.207,steel,.46+(end-.46)*i/5,-.22-i*.077,0);
  }
  const fore=sniper?1.22:isSMG?.88:1.18;
  const muzzle=length*.62;
  cylinder(g,shotgun?.072:.049,muzzle-.45,dark,(muzzle+.45)/2,.1,0);
  cylinder(g,.077,.14,steel,muzzle-.05,.1,0);
  cylinder(g,.044,.014,0x141617,muzzle+.029,.1,0);
  box(g,fore-.45,.24,.27,isAK?wood:polymer,(fore+.45)/2,.06,0);
  if(shotgun) cylinder(g,.065,1,dark,.987,-.02,0);
  for(let x=.53;x<fore-.025;x+=.095){
    for(const z of [-.138,.138]) box(g,.052,.044,.014,isAK?0x4c2c1b:dark,x,.095,z);
  }
  if(sniper || id==='hk416') {
    rail(g,-.44,fore,.24);
    optic(g,0,.43);
  } else {
    box(g,.11,.13,.145,dark,-.55,.28,0);
    box(g,.075,.14,.1,steel,fore,.2,0);
  }
  pins(g,[[-.47,.035],[-.31,-.052],[.29,.08],[.53,-.045]],.025,.28);
  box(g,.29,.08,.025,dark,.12,.108,.142);
  box(g,.12,.06,.031,steel,-.15,-.025,.153);
}
function blade(g,id) {
  if (id==='strongarm' || id==='m9') {
    const bayonet = id==='m9';
    const body = bayonet
      ? [[-1.56,-.04],[-1.09,.18],[.39,.18],[.39,-.17],[-.85,-.17]]
      : [[-1.48,-.07],[-1.2,.08],[-.85,.18],[.39,.18],[.39,-.17],[-.84,-.18],[-1.28,-.14]];
    plate(g,body,.072,0x525b63);
    plate(g,[[-1.45,-.07],[-.84,-.15],[.37,-.15],[.37,-.105],[-.86,-.104]],.077,silver);
    box(g,.09,.41,.18,dark,.44,0,0);
    cylinder(g,.118,.78,bayonet?0x484f39:0x303539,.86,0,0);
    for (let i=0;i<8;i++) cylinder(g,.125,.028,bayonet?0x282e22:0x232829,.54+i*.087,0,0);
    cylinder(g,.127,.09,steel,1.26,0,0);
    if (bayonet) add(g,new TorusGeometry(.121,.031,8,20),steel,.44,.29,0).rotation.y=Math.PI/2;
    return;
  }
  if(id==='karambit') {
    plate(g,[[-1,-.13],[-.72,.15],[-.2,.28],[.35,.24],[.52,.08],[.15,.08],[-.22,.03],[-.55,-.08],[-.82,-.21],[-.95,-.39]],.05,silver);
    plate(g,[[.13,.08],[.4,.19],[.83,.08],[1,-.17],[.83,-.31],[.5,-.09],[.25,-.15]],.17,dark);
    const ring = new Shape();
    ring.absarc(.89,-.22,.205,0,Math.PI*2,false);
    const hole = new Shape();
    hole.absarc(.89,-.22,.133,0,Math.PI*2,true);
    ring.holes.push(hole);
    add(g,new ExtrudeGeometry(ring,{depth:.125,bevelEnabled:false,curveSegments:18}),polymer,0,0,-.065);
    pins(g,[[.37,.005],[.62,-.042]],.037,.21);
    return;
  }
  const dagger=id==='fs';
  plate(g,[[-1.5,0],[-.53,dagger?.14:.215],[.37,dagger?.13:.215],[.37,-.13],[-.9,-.13]],.055,steel);
  plate(g,[[-1.47,0],[-.87,-.107],[.34,-.107],[.34,-.143],[-.87,-.143]],.058,silver);
  if(dagger) plate(g,[[-1.47,.005],[.34,.07],[.34,.025]],.06,silver);
  box(g,.075,dagger?.48:.42,.22,steel,.39,0,0);
  cylinder(g,dagger?.103:.122,.83,dagger?dark:wood,.85,0,0);
  for(let i=0;i<9;i++) cylinder(g,.124,.019,dagger?steel:0x523022,.49+i*.088,0,0);
  cylinder(g,.139,.065,dark,1.27,0,0);
}
function equipment(g,id) {
  if(id==='m67'){
    add(g,new SphereGeometry(.63,28,16),0x606c48);
    cylinder(g,.24,.14,steel,0,.59,0,'y');
    box(g,.49,.09,.26,0x868b73,.09,.68,0);
    box(g,.065,.5,.24,0x868b73,.34,.43,0).rotation.z=.25;
    for(let i=0;i<12;i++) box(g,.034,.05,.012,0xa0a169,-.22+i*.037,-.11,.59);
    return;
  }
  box(g,.78,.21,.49,polymer,0,0,0);
  add(g,new SphereGeometry(.14,20,12),dark,-.37,-.1,0);
  cylinder(g,.08,.025,0x568690,-.49,-.1,0);
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const arm=box(g,.74,.085,.12,steel,sx*.43,.01,sz*.33);
    arm.rotation.y=-sx*sz*.62;
    const x=sx*.72,z=sz*.56;
    cylinder(g,.128,.13,dark,x,.03,z,'y');
    for(let i=0;i<3;i++) {
      const prop=box(g,.28,.021,.065,polymer,x+Math.cos(i*2.094)*.17,.12,z+Math.sin(i*2.094)*.17);
      prop.rotation.y=-i*2.094;
    }
  }
  for(let i=0;i<5;i++) box(g,.03,.013,.21,dark,-.15+i*.067,.11,0);
}
function ellipsoid(g, size, color, center, resolution=18) {
  const mesh=add(g,new SphereGeometry(1,resolution,12),color,...center);
  mesh.scale.set(...size);
  return mesh;
}

function limb(g, start, end, top, bottom, color, depth=1) {
  const from=new Vector3(...start), to=new Vector3(...end);
  const delta=from.clone().sub(to);
  const mesh=add(g,new CylinderGeometry(top,bottom,delta.length(),16,3),color,...from.lerp(to,.5).toArray());
  mesh.scale.z=depth;
  mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());
  return mesh;
}

function operator(g, id) {
  const woman=id==='woman';
  const shoulders=woman?.315:.37;
  const waist=woman?.198:.247;
  const leg=woman?.13:.148;
  const cloth=0x303438, seam=0x42464a, nylon=0x292d31, plateColor=0x3e4448;
  const black=0x1b1f22, lens=0x222b31, hardware=0x555d60;
  ellipsoid(g,[shoulders,.35,.165],cloth,[0,1.385,0]);
  ellipsoid(g,[waist,.235,.147],cloth,[0,1.154,.008]);
  ellipsoid(g,[waist*1.21,.226,.171],cloth,[0,.958,0]);
  ellipsoid(g,[waist*1.26,.067,.175],nylon,[0,1.064,.007]);
  box(g,.093,.067,.024,hardware,0,1.065,.176);
  ellipsoid(g,[shoulders*.85,.275,.084],plateColor,[0,1.387,.142]);
  ellipsoid(g,[shoulders*.81,.23,.089],nylon,[0,1.371,-.133]);
  for (const side of [-1,1]) {
    const s=x=>x*side;
    const thigh=[s(leg),.94,0], knee=[s(leg*1.14),.536,.041], ankle=[s(leg*1.21),.128,-.016];
    const shoulder=[s(shoulders*.9),1.584,0], elbow=[s(shoulders*1.24),1.29,.013];
    const wrist=[s(shoulders*1.4),1.032,.04];
    limb(g,thigh,knee,.146,.102,cloth,1.1);
    limb(g,knee,ankle,.108,.072,cloth,.98);
    ellipsoid(g,[.095,.121,.083],nylon,[s(leg*1.14),.538,.084]);
    ellipsoid(g,[.076,.094,.033],plateColor,[s(leg*1.14),.542,.155]);
    ellipsoid(g,[.087,.082,.175],black,[s(leg*1.21),.087,.051]);
    ellipsoid(g,[.091,.021,.172],nylon,[s(leg*1.21),.031,.052]);
    ellipsoid(g,[.075,.113,.088],black,[s(leg*1.21),.151,.004]);
    for (let i=0;i<5;i++) box(g,.071,.007,.008,seam,s(leg*1.21),.115+i*.016,.097-i*.008);
    limb(g,shoulder,elbow,.112,.077,cloth);
    limb(g,elbow,wrist,.082,.056,cloth);
    ellipsoid(g,[.101,.135,.107],nylon,[s(shoulders*.97),1.53,.006]);
    ellipsoid(g,[.072,.081,.046],plateColor,[s(shoulders*1.25),1.28,-.041]);
    ellipsoid(g,[.063,.095,.043],black,[s(shoulders*1.41),.988,.051]);
    for(let i=0;i<4;i++) ellipsoid(g,[.009,.023,.012],nylon,[s(shoulders*1.41)+(i-1.5)*.018,.948,.09],10);
    box(g,.109,.137,.08,nylon,s(waist*1.05),1.038,.099).rotation.z=s(-.13);
    const strap=box(g,.048,.24,.027,nylon,s(shoulders*.63),1.52,.155);
    strap.rotation.z=s(.16);
    for(let i=0;i<3;i++) box(g,.048,.008,.009,seam,s(shoulders*.63),1.46+i*.032,.173);
  }
  for (let i=0;i<4;i++) {
    const x=(i-1.5)*shoulders*.39;
    box(g,.081,.177,.067,nylon,x,1.255,.218);
    box(g,.086,.037,.019,plateColor,x,1.332,.259);
    box(g,.019,.086,.01,seam,x,1.272,.26);
    box(g,.028,.02,.014,hardware,x,1.229,.266);
  }
  for(let i=0;i<3;i++) {
    box(g,shoulders*1.27,.014,.012,seam,0,1.39+i*.048,.221-i*.007);
    box(g,shoulders*1.13,.014,.012,seam,0,1.23+i*.075,-.223);
  }
  ellipsoid(g,[.075,.12,.071],black,[0,1.68,0]);
  ellipsoid(g,[.127,.183,.128],black,[0,1.835,.011]);
  ellipsoid(g,[.149,.12,.149],nylon,[0,1.927,-.015]);
  ellipsoid(g,[.138,.076,.068],plateColor,[0,1.862,.102]);
  ellipsoid(g,[.129,.052,.064],lens,[0,1.866,.124],24);
  ellipsoid(g,[.095,.088,.052],black,[0,1.779,.105]);
  for(const side of [-1,1]) {
    ellipsoid(g,[.026,.068,.058],nylon,[side*.136,1.844,-.033]);
    box(g,.027,.032,.106,plateColor,side*.143,1.884,.015);
    box(g,.015,.072,.016,seam,side*.134,1.825,.063).rotation.x=.42;
  }
  box(g,.053,.11,.043,nylon,shoulders*.66,1.47,-.163);
  limb(g,[shoulders*.66,1.515,-.169],[shoulders*.67,1.717,-.186],.007,.005,black);
}


function accessory(g, n) {
 const c=0x626952;
 if(n===2){box(g,.65,.95,.28,c,0,0,0); for(let i=0;i<7;i++)box(g,.42,.035,.02,dark,0,-.3+i*.09,.15);cylinder(g,.025,.8,dark,.22,.85,0,'y'); cylinder(g,.08,.15,steel,-.16,.55,0,'y');}
 if(n===3){box(g,.65,.18,.18,dark,0,.2,0);for(const x of [-.23,.23]){cylinder(g,.16,.55,polymer,x,0,0,'z');cylinder(g,.13,.025,0x44766c,x,0,.29,'z');}box(g,.18,.3,.1,dark,0,.4,0);}
 if(n===4||n===8){box(g,1,.8,.45,n===4?0x70463e:c,0,0,0);for(const x of [-.32,.32])box(g,.08,.9,.48,dark,x,0,0);box(g,.4,.1,.47,dark,0,.5,0);if(n===4){box(g,.3,.08,.015,silver,0,0,.235);box(g,.08,.3,.015,silver,0,0,.24);}else for(const x of [-.3,0,.3])box(g,.23,.4,.15,polymer,x,-.15,.3);}
 if(n===5){for(const x of [-.25,.25]){cylinder(g,.2,.8,polymer,x,0,0,'z');cylinder(g,.16,.02,0x497b85,x,0,.41,'z');}box(g,.5,.25,.4,dark,0,0,0);}
 if(n===6){cylinder(g,.13,1.25,dark,0,0,0);cylinder(g,.23,.3,steel,.65,0,0);cylinder(g,.19,.015,silver,.81,0,0);for(let i=0;i<12;i++)cylinder(g,.142,.02,polymer,-.5+i*.07,0,0);}
 if(n===7){plate(g,[[-.55,-.9],[.55,-.9],[.65,.6],[.4,.9],[-.4,.9],[-.65,.6]],.13,polymer);box(g,.65,.25,.16,dark,0,.4,.02);box(g,.51,.13,.17,0x49636c,0,.4,.03);for(const x of [-.48,.48])for(const y of [-.7,0,.68])cylinder(g,.025,.15,silver,x,y,0,'z');}
 if(n===9){box(g,.7,.65,.45,c,0,0,0);cylinder(g,.23,.35,dark,0,0,.35,'z');cylinder(g,.19,.02,0x416977,0,0,.54,'z');box(g,.35,.1,.6,dark,0,-.4,0);}
}
export function buildModel(id) {
 const group=new Group();
 const row=catalog.find(item=>item[0]===id);
 const category=row?.[2];
 const list=catalog.filter(item=>item[2]===category), n=list.findIndex(item=>item[0]===id);
 if(category==='Operators'){
   operator(group,n%2?'man':'woman');
   const colors=[0x303438,0x303438,0x45513c,0x9c8a65,0x515b61,0x88928e,0x303e50,0x596044,0xc4c8be,0x897454];
   group.traverse(m=>{if(m.isMesh&&[0x303438,0x292d31,0x3e4448].includes(m.material.color.getHex()))m.material.color.setHex(colors[n]);});
   if(n>1){box(group,.36,.48,.19,colors[n],0,1.38,-.28);for(const x of [-.11,.11])box(group,.08,.35,.03,dark,x,1.38,-.39);}
   if(n===2||n===8)for(const x of [-.07,.07]){cylinder(group,.034,.1,dark,x,1.91,.22,'z');cylinder(group,.027,.01,0x415c51,x,1.91,.276,'z');}
   if(n===4){box(group,.09,.3,.08,steel,.28,1.02,.1);}
   if(n===5){box(group,.12,.035,.015,silver,0,1.45,.235);box(group,.035,.12,.015,silver,0,1.45,.237);}
 }else if(category==='Blades'){
   blade(group,n<5?id:n===6?'karambit':n===8?'fs':'kabar');
   if(n===5)group.scale.set(1.1,.8,1);
   if(n===6)group.scale.set(1.5,1.6,1.2);
   if(n===7)group.scale.set(1.3,1.4,1);
   if(n===8)group.scale.set(.6,1.1,1);
   if(n===9){group.clear();cylinder(group,.075,1.5,wood,0,-.4,0,'y');plate(group,[[-.65,.3],[-.5,.65],[.55,.7],[.65,.15],[.2,.25],[-.1,.4]],.15,steel);}
 }else if(category==='Equipment') {if(n<2)equipment(group,id);else accessory(group,n);}
 else if(category==='Secondary'){
   if(n>=38&&n<=47){
    cylinder(group,.19,.48,steel,-.2,0,0);cylinder(group,.065,.85,steel,.4,.03,0);cylinder(group,.043,.012,dark,.83,.03,0);box(group,.45,.15,.22,steel,-.2,-.14,0);const grip=box(group,.22,.55,.2,n%2?wood:polymer,-.45,-.4,0);grip.rotation.z=-.2;add(group,new TorusGeometry(.14,.024,8,24),steel,0,-.25,0);for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(group,.043,.49,dark,-.2,Math.cos(a)*.13,Math.sin(a)*.13);}
   }else{firearm(group,n===1||n===27||n>47?'m1911':'g17');group.scale.set(.86+(n%7)*.055,.9+(n%4)*.045,.88+(n%3)*.08);if(n===28)group.scale.multiplyScalar(1.25);}
 }else{
   const ak=[1,6,7,8,9,25,26,27,28,47].includes(n), smg=n===2||(n>=29&&n<=37), shotgun=n===3||(n>=38&&n<=42), sniper=n===4||n>=48;
   firearm(group,ak?'ak74':smg?'mp5':shotgun?'m4':sniper?'awm':'hk416');
   group.scale.set(.92+(n%5)*.045,.94+(n%3)*.04,.95+(n%4)*.035);
   if(n>=43&&n<=46){box(group,.55,.55,.43,dark,.3,-.36,0);for(const z of [-.25,.25]){const leg=cylinder(group,.025,.6,steel,1.05,-.33,z,'y');leg.rotation.x=z;}}
   if([14,15,16,17,18,24].includes(n)){box(group,.4,.45,.22,dark,-.85,-.25,0);}
   if(n%6===0)cylinder(group,.08,.45,dark,1.65,.1,0);
 }
 group.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 return group;
}
