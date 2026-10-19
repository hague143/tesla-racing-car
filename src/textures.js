import * as THREE from 'three';
export function seeded(seed) { let n=seed|0; return ()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;}; }
function surface(width,height,draw) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;return texture;
}
export function noiseTexture(type='asphalt') {
  const random=seeded(type==='grass'?23:19);
  const texture=surface(256,256,(ctx,w,h)=>{
    ctx.fillStyle=type==='grass'?'#637364':'#92969a';ctx.fillRect(0,0,w,h);
    for(let i=0;i<22000;i++) {
      const shade=Math.floor(55+random()*120);
      ctx.fillStyle=type==='grass'?`rgba(${shade*.65},${shade},${shade*.65},.5)`:`rgba(${shade},${shade},${shade},.5)`;
      const x=random()*w,y=random()*h;ctx.fillRect(x,y,random()*2+1,type==='grass'?random()*8+1:random()*2+1);
    }
    if(type==='asphalt') {ctx.strokeStyle='#484c5044';ctx.lineWidth=.5;for(let i=0;i<18;i++){ctx.beginPath();let x=random()*w,y=random()*h;ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=random()*20-10;y+=random()*20;ctx.lineTo(x,y);}ctx.stroke();}}
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
export function foliageTexture() {
  const random=seeded(942);
  return surface(384,768,(ctx,w,h)=>{
    const trunk=ctx.createLinearGradient(w*.47,0,w*.53,0);trunk.addColorStop(0,'#25211b');trunk.addColorStop(.5,'#665c45');trunk.addColorStop(1,'#2d2d24');
    ctx.fillStyle=trunk;ctx.beginPath();ctx.moveTo(w*.485,h*.12);ctx.lineTo(w*.47,h);ctx.lineTo(w*.53,h);ctx.lineTo(w*.515,h*.12);ctx.fill();
    for(let layer=0;layer<33;layer++) {
      const y=h*(.07+layer/41),spread=w*(.025+layer/90);
      for(const side of [-1,1]) {
        const endX=w/2+side*spread*(.8+random()*.24),endY=y+h*(.025+random()*.035);
        ctx.strokeStyle='#333c27';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w/2,y);ctx.lineTo(endX,endY);ctx.stroke();
        for(let i=0;i<110;i++) {
          const t=random(),x=w/2+(endX-w/2)*t,branchY=y+(endY-y)*t;
          const green=45+Math.floor(random()*53),r=Math.floor(green*.63),b=Math.floor(green*.69);
          ctx.strokeStyle=`rgba(${r},${green},${b},${.7+random()*.3})`;ctx.lineWidth=.7+random()*1.2;
          const length=4+random()*14;
          ctx.beginPath();ctx.moveTo(x,branchY);ctx.lineTo(x+side*length*(.35+random()),branchY-length*(.3+random()*.7));ctx.stroke();
          ctx.beginPath();ctx.moveTo(x,branchY);ctx.lineTo(x+side*length*.7,branchY+length*.5);ctx.stroke();
        }
      }
    }
  });
}
export function smokeTexture() {
  const random=seeded(93);
  return surface(128,128,(ctx)=>{
    for(let i=0;i<28;i++){
      const x=42+random()*44,y=42+random()*44,r=16+random()*28;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  });
}
export function lightTexture() {
  return surface(128,128,ctx=>{const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,239,205,1)');g.addColorStop(.2,'rgba(255,231,190,.6)');g.addColorStop(1,'rgba(255,228,170,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
}
export function environmentTexture() {
  const texture=surface(512,256,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#33435d');g.addColorStop(.5,'#161c29');g.addColorStop(1,'#060708');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(const [x,y,a,b]of [[30,65,90,12],[230,50,150,9],[400,90,95,6]]){const gradient=ctx.createLinearGradient(0,y-20,0,y+30);gradient.addColorStop(0,'#111721');gradient.addColorStop(.5,'#d0dcf2');gradient.addColorStop(1,'#111721');ctx.fillStyle=gradient;ctx.fillRect(x,y-20,a,b+40);}
  });texture.mapping=THREE.EquirectangularReflectionMapping;return texture;
}
export function moonTexture() {
  const random=seeded(82);
  return surface(256,128,ctx=>{ctx.fillStyle='#9dabb9';ctx.fillRect(0,0,256,128);for(let i=0;i<400;i++){const x=random()*256,y=random()*128,r=1+random()*10;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#5b6c7c60');g.addColorStop(1,'#9dabb900');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}});
}
