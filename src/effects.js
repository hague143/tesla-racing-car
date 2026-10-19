import * as THREE from 'three';
import {smokeTexture,seeded} from './textures.js';
export function createVapor(scene) {
  const count=440,random=seeded(340),positions=new Float32Array(count*3),sizes=new Float32Array(count),opacities=new Float32Array(count);
  const particles=Array.from({length:count},()=>({life:0,maxLife:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,scale:1}));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('size',new THREE.BufferAttribute(sizes,1));geo.setAttribute('alpha',new THREE.BufferAttribute(opacities,1));
  const mat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{sprite:{value:smokeTexture()}},
    vertexShader:'attribute float size;attribute float alpha;varying float vAlpha;void main(){vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*(460./-mv.z),0.,180.);gl_Position=projectionMatrix*mv;}',
    fragmentShader:`uniform sampler2D sprite;varying float vAlpha;void main(){float a=texture2D(sprite,gl_PointCoord).a*vAlpha;if(a<.003)discard;gl_FragColor=vec4(vec3(.72,.8,.9),a);\n#include <colorspace_fragment>\n}`,
  });
  const points=new THREE.Points(geo,mat);points.frustumCulled=false;scene.add(points);
  let cursor=0,budget=0;
  const origin=new THREE.Vector3();
  return {
    get activeCount(){return particles.filter(p=>p.life>0).length;},
    clear(){particles.forEach(p=>p.life=0);opacities.fill(0);geo.attributes.alpha.needsUpdate=true;},
    update(dt,vehicle,drive,enabled){
      if(enabled) {
        budget+=dt*125;
        while(budget>=1){budget--;const p=particles[cursor%count],nozzle=vehicle.userData.nozzles[cursor%4];cursor++;origin.copy(nozzle).applyMatrix4(vehicle.matrixWorld);
          p.x=origin.x+(random()-.5)*.07;p.y=origin.y;p.z=origin.z;p.vx=(random()-.5)*.8;p.vy=-4-random()*3;p.vz=(random()-.5)*.8;
          p.life=p.maxLife=1.4+random()*1.3;p.scale=.24+random()*.25;
        }
      }else budget=0;
      for(let i=0;i<count;i++){
        const p=particles[i];p.life=Math.max(0,p.life-dt);
        if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
          if(p.y<.12){p.y=.12;p.vy=.08+random()*.18;p.vx+=(random()-.5)*3;p.vz+=(random()-.5)*3;}
          p.vy+=dt*.2;p.vx*=1-dt*.4;p.vz*=1-dt*.4;
          const age=1-p.life/p.maxLife;positions.set([p.x,p.y,p.z],i*3);sizes[i]=p.scale+age*3.3;opacities[i]=Math.sin(Math.PI*Math.min(1,age*1.4))*.6;
        }else opacities[i]=0;
      }
      geo.attributes.position.needsUpdate=true;geo.attributes.size.needsUpdate=true;geo.attributes.alpha.needsUpdate=true;
    },
  };
}
