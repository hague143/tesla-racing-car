import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const add=(parent,geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;};
const box=(p,w,h,l,m,x=0,y=0,z=0)=>add(p,new THREE.BoxGeometry(w,h,l),m,x,y,z);
function beam(parent,a,b,r,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);const m=add(parent,new THREE.CylinderGeometry(r,r,start.distanceTo(end),8),mat);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return m;}
function shell(sections,mat,parent) {
  const curve=new THREE.CatmullRomCurve3(sections.map(([z,w,h])=>new THREE.Vector3(z,w,h)));
  const positions=[],indices=[],rows=56,ring=12;
  for(let j=0;j<=rows;j++){
    const p=curve.getPoint(j/rows),w=p.y,top=p.z;
    const profile=[[-w*.88,.36],[-w,.49],[-w,.71],[-w*.95,top-.04],[-w*.65,top],[0,top+.025],[w*.65,top],[w*.95,top-.04],[w,.71],[w,.49],[w*.88,.36],[0,.34]];
    for(const[x,y]of profile)positions.push(x,y,p.x);
    if(j<rows)for(let i=0;i<ring;i++){const a=j*ring+i,b=j*ring+(i+1)%ring,c=(j+1)*ring+i,d=(j+1)*ring+(i+1)%ring;indices.push(a,c,b,b,c,d);}
  }
  for(const row of [0,rows])for(let i=1;i<ring-1;i++)indices.push(...(row===0?[row*ring,row*ring+i,row*ring+i+1]:[row*ring,row*ring+i+1,row*ring+i]));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const body=add(parent,geo,mat);body.castShadow=true;
}
function pane(parent,vertices,mat){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return add(parent,geo,mat);}
export function createVehicle({player=false,color='#56606c',variant=0}={}) {
  const group=new THREE.Group();
  const suv=!player&&variant===1;
  const paint=new THREE.MeshPhysicalMaterial({color:player?'#4a505a':color,metalness:.7,roughness:.22,clearcoat:1,clearcoatRoughness:.14});
  const glass=new THREE.MeshPhysicalMaterial({color:'#101a25',metalness:.55,roughness:.08,clearcoat:1,side:THREE.DoubleSide});
  const rubber=new THREE.MeshStandardMaterial({color:'#0c0e11',roughness:.94});
  const metal=new THREE.MeshStandardMaterial({color:'#a5adba',metalness:.9,roughness:.25});
  const trim=new THREE.MeshStandardMaterial({color:'#171d24',metalness:.5,roughness:.35});
  const headlights=new THREE.MeshBasicMaterial({color:'#e6f3ff'});
  const taillight=new THREE.MeshBasicMaterial({color:'#ff1831',toneMapped:false});
  const width=player?1.04:suv?1.03:.96,roof=suv?1.72:player?1.33:1.48;
  shell([[-2.4,.72,.71],[-2.13,.93,.86],[-1.35,width,.98],[-.65,width,1],[1.15,width,1.02],[2.03,width*.95,.96],[2.3,.79,.82]],paint,group);
  const front=-1.04,roofFront=-.37,roofRear=suv?.98:.48,rear=suv?1.65:1.29;
  const fL=[-.79,.99,front],fR=[.79,.99,front],rL=[-.65,roof,roofFront],rR=[.65,roof,roofFront],backL=[-.65,roof-.02,roofRear],backR=[.65,roof-.02,roofRear],bL=[-.8,1.01,rear],bR=[.8,1.01,rear];
  pane(group,[fL,rL,rR,fR],glass);pane(group,[rL,backL,backR,rR],glass);pane(group,[backL,bL,bR,backR],glass);
  pane(group,[fL,bL,backL,rL],glass);pane(group,[fR,rR,backR,bR],glass);
  for(const side of [-1,1]) {
    beam(group,[side*.79,.99,front],[side*.65,roof,roofFront],.024,paint);
    beam(group,[side*.65,roof,roofFront],[side*.65,roof-.02,roofRear],.025,paint);
    beam(group,[side*.65,roof-.02,roofRear],[side*.8,1.01,rear],.025,paint);
    if(!player)beam(group,[side*.81,1.0,.28],[side*.66,roof,.28],.035,trim);
    beam(group,[side*.83,1.0,front],[side*.83,1.0,rear],.015,metal);
    box(group,.19,.1,.24,paint,side*1.07,1.0,-.83);
    box(group,.16,.02,.03,metal,side*width,.87,.1);
    if(!player)box(group,.16,.02,.03,metal,side*width,.87,.93);
    const lens=box(group,.5,.06,.06,headlights,side*.59,.76,-2.26);lens.rotation.y=side*.18;
    beam(group,[side*.36,.82,-2.28],[side*.83,.85,-2.1],.013,headlights);
    box(group,.045,.14,.12,headlights,side*.89,.63,-2.12);
  }
  box(group,1.4,.09,.07,rubber,0,.48,-2.31);box(group,1.6,.04,.14,trim,0,.39,-2.28);
  box(group,1.88,.055,.04,taillight,0,.9,2.27);
  box(group,1.25,.28,.07,rubber,0,.56,2.28);
  box(group,.37,.12,.025,new THREE.MeshStandardMaterial({color:'#c1c6ce',roughness:.4,metalness:.5}),0,.74,2.31);
  for(const x of [-.66,-.33,0,.33,.66])box(group,.025,.13,.3,trim,x,.38,2.25);
  // Nose badge and a thin metallic strip along the rear deck.
  box(group,.12,.015,.025,metal,0,.94,-1.98);box(group,.02,.05,.025,metal,0,.92,-1.98);
  const wheels=[];
  for(const x of [-1.0,1.0])for(const z of [-1.45,1.44]) {
    const pivot=new THREE.Group();pivot.position.set(x,.43,z);group.add(pivot);
    const spin=new THREE.Group();pivot.add(spin);
    const tire=add(spin,new THREE.TorusGeometry(.335,.105,12,32),rubber);tire.rotation.y=Math.PI/2;tire.castShadow=true;
    const rim=add(spin,new THREE.CylinderGeometry(.285,.285,.22,24),trim);rim.rotation.z=Math.PI/2;
    for(let i=0;i<10;i++) {
      const angle=i/10*Math.PI*2;
      const spoke=box(spin,.24,.035,.25,metal,0,Math.cos(angle)*.13,Math.sin(angle)*.13);spoke.rotation.x=-angle;
    }
    const hub=add(spin,new THREE.CylinderGeometry(.07,.07,.25,16),metal);hub.rotation.z=Math.PI/2;
    pivot.userData.spin=spin;wheels.push(pivot);
  }
  const nozzles=[];const jetBeams=[];
  if(player) {
    // The reference image's large rear wing, continuous red bar and four lift jets.
    for(const x of [-.75,.75])box(group,.06,.45,.16,trim,x,1.18,1.91);
    const wing=box(group,2.55,.075,.48,paint,0,1.43,1.92);wing.rotation.x=-.06;
    for(const x of [-1.25,1.25])box(group,.035,.18,.51,trim,x,1.48,1.92);
    for(const x of [-.74,-.25,.25,.74]) {
      const intake=add(group,new THREE.CylinderGeometry(.1,.1,.17,20),metal,x,.65,2.3);intake.rotation.x=Math.PI/2;
      const dark=add(group,new THREE.CylinderGeometry(.068,.068,.18,16),rubber,x,.65,2.31);dark.rotation.x=Math.PI/2;
      add(group,new THREE.CylinderGeometry(.11,.085,.25,16),metal,x,.34,1.95);
      nozzles.push(new THREE.Vector3(x,.22,1.95));
      const plume=add(group,new THREE.CylinderGeometry(.045,.23,1,16,1,true),new THREE.MeshBasicMaterial({color:'#d9edff',transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending}),x,-.28,1.95);plume.visible=false;jetBeams.push(plume);
    }
    for(const x of [-.6,.6]) {
      const light=new THREE.SpotLight('#e4edff',185,95,.38,.6,1.5);light.position.set(x,.8,-2.1);light.target.position.set(x,.05,-48);group.add(light,light.target);
    }
  }
  group.userData={wheels,taillight,nozzles,jetBeams};
  if(!player) {
    group.updateMatrixWorld(true);const buckets=new Map();
    group.traverse(object=>{if(!object.isMesh)return;const geo=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geo.deleteAttribute('uv');geo.applyMatrix4(object.matrixWorld);if(!buckets.has(object.material))buckets.set(object.material,[]);buckets.get(object.material).push(geo);});
    const merged=new THREE.Group();
    for(const[mat,geometries]of buckets){const object=add(merged,mergeGeometries(geometries),mat);object.castShadow=mat===paint;geometries.forEach(geo=>geo.dispose());}
    group.traverse(object=>{if(object.geometry)object.geometry.dispose();});return merged;
  }
  return group;
}
