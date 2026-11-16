import * as T from 'three';
function skinTexture(seed){let a=seed+1;const data=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){a=(a*1664525+1013904223)>>>0;const n=(a>>>24),v=150+n*.32+Math.sin(x*.4)*Math.cos(y*.3)*24,i=(y*64+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}const t=new T.DataTexture(data,64,64);t.needsUpdate=true;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
// Same articulated design is used in the armory and the game.
export function decorateZombieAvatar(av,kind,seed=1,quality='game'){
 const fierce=kind==='infected',detail=quality==='studio'?24:12,tex=skinTexture(seed);
 const skin=new T.MeshStandardMaterial({color:fierce?0x555f63:0x7b8469,roughness:.93,map:tex,bumpMap:tex,bumpScale:.015});
 const cloth=new T.MeshStandardMaterial({color:fierce?0x393a42:0x524c3b,roughness:1,map:tex});
 const dark=new T.MeshStandardMaterial({color:0x22282a,roughness:.95});
 const scar=new T.MeshStandardMaterial({color:fierce?0x5d4947:0x66564a,roughness:1});
 const bone=new T.MeshStandardMaterial({color:0xb3ad91,roughness:.8});
 const eye=new T.MeshStandardMaterial({color:fierce?0xff5737:0xc6d183,emissive:fierce?0xdc210c:0x718044,emissiveIntensity:fierce?2.2:.65,roughness:.3});
 const infected=new T.MeshStandardMaterial({color:0xa49142,emissive:0x625116,emissiveIntensity:.25,roughness:.7});
 const groups=[av.spine,av.head,av.armL.sh,av.armL.el,av.armR.sh,av.armR.el,av.legL.thigh,av.legL.knee,av.legR.thigh,av.legR.knee];
 // Retain the existing joints and remove only their former block meshes.
 for(const group of groups)for(const child of [...group.children])if(child.isMesh){group.remove(child);child.geometry.dispose();}
 function mesh(parent,geo,mat,x,y,z){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
 function ell(parent,x,y,z,sx,sy,sz,mat){const m=mesh(parent,new T.SphereGeometry(1,detail,quality==='studio'?16:8),mat,x,y,z);m.scale.set(sx,sy,sz);return m;}
 function bar(parent,w,h,d,mat,x,y,z){return mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);}
 function spike(parent,a,b,r,mat=bone){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);const m=mesh(parent,new T.ConeGeometry(r,dir.length(),quality==='studio'?12:6),mat,...start.clone().add(end).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m;}
 ell(av.spine,0,.3,.015,fierce?.31:.22,.32,fierce?.19:.14,skin);
 ell(av.spine,0,.06,.025,.19,.16,.13,cloth);
 for(const side of [-1,1]){
   ell(av.spine,side*(fierce?.28:.2),.47,.035,fierce?.17:.105,.16,.13,skin);
   for(let i=0;i<4;i++)ell(av.spine,side*(.07+i*.022),.38-i*.055,-.133,.06,.014,.025,scar);
   for(let i=0;i<3;i++){const flap=bar(av.spine,.07,.17,.035,cloth,side*(.07+i*.045),.06,-.14);flap.rotation.z=side*(.1+i*.12);}
 }
 if(fierce){
  ell(av.spine,.18,.44,-.05,.17,.2,.16,skin);
  for(let i=0;i<7;i++){const x=(i%2?1:-1)*(.12+(i%3)*.07);spike(av.spine,[x,.46,.08],[x*1.6,.7+(i%3)*.06,.22],.055);}
  for(let i=0;i<5;i++)ell(av.spine,-.15+(i%2)*.05,.27+i*.045,.18,.055,.055,.03,infected);
  for(const side of [-1,1]){ell(av.spine,side*.17,.37,-.13,.11,.11,.07,skin);for(let i=0;i<3;i++)bar(av.spine,.055,.012,.014,scar,side*.16,.34+i*.035,-.19).rotation.z=side*.35;}
 }else{
  ell(av.spine,-.1,.37,.03,.19,.24,.155,cloth);
  for(let i=0;i<6;i++)bar(av.spine,.027,.22,.02,dark,-.18+i*.05,.27,-.12).rotation.z=.08;
  bar(av.spine,.08,.11,.025,scar,.15,.34,-.14).rotation.z=-.2;
 }
 ell(av.head,0,.04,0,.068,.09,.066,skin);
 ell(av.head,0,.21,.012,fierce?.135:.123,fierce?.19:.15,.124,skin);
 ell(av.head,0,.09,-.03,fierce?.11:.08,fierce?.09:.055,.095,skin);
 ell(av.head,0,.15,-.12,.03,.04,.04,skin);
 // Deep sockets, brow ridge and distinct threatening eyes.
 for(const side of [-1,1]){
  ell(av.head,side*.057,.23,-.102,.05,.037,.027,dark);
  ell(av.head,side*.057,.232,-.126,fierce?.024:.019,.013,.008,eye);
  const brow=ell(av.head,side*.06,.263,-.109,.064,.021,.028,skin);brow.rotation.z=side*(fierce?.3:.12);
  ell(av.head,side*.121,.202,.002,.022,.039,.027,skin);
  ell(av.head,side*.088,.158,-.092,.045,.026,.035,skin);
 }
 ell(av.head,0,.103,-.111,fierce?.074:.05,fierce?.043:.019,.016,dark);
 for(let i=0;i<(fierce?7:4);i++)spike(av.head,[-.056+i*.018,.128,-.126],[-.054+i*.018,fierce?.088:.106,-.133],.009,bone);
 if(fierce){spike(av.head,[-.09,.36,.015],[-.16,.49,.025],.045);spike(av.head,[.09,.36,.015],[.14,.45,.045],.038);ell(av.head,-.083,.31,-.01,.05,.09,.025,scar);}else{for(let i=0;i<5;i++)bar(av.head,.012,.05,.02,dark,-.06+i*.03,.34,.01).rotation.z=(i-2)*.15;ell(av.head,-.07,.14,-.108,.034,.032,.012,scar);}
 for(const [side,arm,leg] of [[-1,av.armL,av.legL],[1,av.armR,av.legR]]){
  arm.sh.position.x=side*(fierce?.34:.27);
  ell(arm.sh,0,-.13,0,fierce?.103:.07,.18,fierce?.09:.065,side===-1&&!fierce?cloth:skin);
  ell(arm.el,0,-.14,0,fierce?.083:.058,fierce?.2:.155,fierce?.075:.055,skin);
  ell(arm.el,0,-(fierce?.36:.29),-.01,fierce?.073:.049,.08,.044,skin);
  for(let i=0;i<4;i++){
   const x=(i-1.5)*(fierce?.033:.024),y=-(fierce?.42:.35);
   ell(arm.el,x,y,-.025,.012,fierce?.07:.042,.014,skin);
   spike(arm.el,[x,y-.035,-.02],[x+side*.008,y-(fierce?.15:.062),-.065],fierce?.014:.008,fierce?bone:dark);
  }
  if(fierce){for(let i=0;i<3;i++)spike(arm.el,[side*.06,-.04-i*.06,.02],[side*.18,-.04-i*.06,.08],.035);}
  else for(let i=0;i<3;i++)bar(arm.sh,.045,.12,.022,cloth,(i-1)*.04,-.25,0).rotation.z=side*.15;
  ell(leg.thigh,0,-.23,0,fierce?.12:.098,.25,fierce?.11:.09,cloth);
  ell(leg.knee,0,-.19,0,fierce?.09:.07,.22,.07,side===1?skin:cloth);
  ell(leg.knee,0,0,-.055,.08,.085,.032,skin);
  ell(leg.knee,0,-.425,-.05,.085,.065,fierce?.18:.13,dark);
  for(let i=0;i<3;i++)bar(leg.thigh,.045,.12,.015,dark,(i-1)*.045,-.32,-.08).rotation.z=side*.2;
 }
 av.zombieVariant=fierce?'infector':'horde';
 av.zombieMaterials=[skin,cloth,dark,scar,bone,eye,infected];
 av.zombieTexture=tex;
}
export function createZombieStudy(kind='undead'){
 const root=new T.Group(),body=new T.Group(),hips=new T.Group(),spine=new T.Group(),head=new T.Group();root.add(body);body.add(hips);hips.position.y=.95;hips.add(spine);head.position.y=.66;spine.add(head);
 function leg(side){const thigh=new T.Group(),knee=new T.Group();thigh.position.x=side*.14;thigh.add(knee);knee.position.y=-.43;hips.add(thigh);return{thigh,knee};}
 function arm(side){const sh=new T.Group(),el=new T.Group();sh.position.set(side*.3,.52,0);el.position.y=-.3;sh.add(el);spine.add(sh);return{sh,el};}
 const av={root,body,hips,spine,head,legL:leg(-1),legR:leg(1),armL:arm(-1),armR:arm(1)};decorateZombieAvatar(av,kind,kind==='infected'?19:7,'studio');
 const fierce=kind==='infected';spine.rotation.x=fierce?-.23:-.13;spine.rotation.z=fierce?-.04:.09;head.rotation.x=.1;head.rotation.z=fierce?-.08:.12;
 av.armL.sh.rotation.set(fierce?1.05:1.38,0,fierce?-.32:-.1);av.armR.sh.rotation.set(fierce?1.36:1.15,0,fierce?.28:.12);av.armL.el.rotation.x=fierce?.38:.12;av.armR.el.rotation.x=fierce?.18:.25;
 av.legL.thigh.rotation.x=fierce?.27:.14;av.legR.thigh.rotation.x=fierce?-.2:-.09;av.legL.knee.rotation.x=-.25;av.legR.knee.rotation.x=-.1;root.rotation.y=Math.PI;
 root.userData.animate=time=>{spine.rotation.z=(fierce?-.04:.09)+Math.sin(time*(fierce?2.6:1.4))*.018;head.rotation.z=(fierce?-.08:.12)+Math.sin(time*1.5)*.025;hips.position.y=.95+Math.sin(time*(fierce?2.7:1.5))*.009;};return root;
}
