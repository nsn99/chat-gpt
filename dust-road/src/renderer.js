const VS=`attribute vec3 position; attribute vec3 color; uniform mat4 vp; uniform vec3 eye; varying vec3 vColor; varying float fog; void main(){gl_Position=vp*vec4(position,1.);vColor=color;fog=clamp((distance(position,eye)-180.)/500.,0.,1.);}`;
const FS=`precision mediump float; varying vec3 vColor; varying float fog; uniform vec3 sky; void main(){gl_FragColor=vec4(mix(vColor,sky,fog),1.);}`;
const normalize=a=>{let n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function matrix(eye,target,aspect){
  const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
  const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(Math.PI/5.3),near=.12,far=1000;
  return multiply([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],view);
}
const faces=[[[0,1,2,3],.74],[[5,4,7,6],.90],[[4,0,3,7],.63],[[1,5,6,2],.83],[[3,2,6,7],1.07],[[4,5,1,0],.52]];
export class Renderer{
  constructor(canvas){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
    if(!this.gl)throw Error('WebGL недоступен. Включите аппаратное ускорение браузера.');
    const g=this.gl,shader=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
    this.program=g.createProgram();g.attachShader(this.program,shader(g.VERTEX_SHADER,VS));g.attachShader(this.program,shader(g.FRAGMENT_SHADER,FS));g.linkProgram(this.program);
    if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program));
    g.useProgram(this.program);this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
    for(const [name,offset]of [['position',0],['color',12]]){let a=g.getAttribLocation(this.program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,24,offset);}
    this.vp=g.getUniformLocation(this.program,'vp');this.eye=g.getUniformLocation(this.program,'eye');this.sky=g.getUniformLocation(this.program,'sky');g.enable(g.DEPTH_TEST);
    this.data=new Float32Array(1500000);this.n=0;this.low=false;
  }
  begin(){this.n=0;}
  vertex(p,c,shade=1){for(let j=0;j<3;j++)this.data[this.n++]=p[j];for(let j=0;j<3;j++)this.data[this.n++]=c[j]*shade;}
  quad(a,b,c,d,color,shade=1){for(const p of[a,b,c,a,c,d])this.vertex(p,color,shade);}
  box(x,y,z,w,h,d,color,yaw=0){
    const sn=Math.sin(yaw),cs=Math.cos(yaw),points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2*cs+c*d/2*sn,y+b*h/2,z-a*w/2*sn+c*d/2*cs]);
    for(const[f,s]of faces)this.quad(...f.map(i=>points[i]),color,s);
  }
  peak(x,y,z,w,h,d,c){const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],v=[x,y+h,z],e=[x+w/2,y,z+d/2],f=[x-w/2,y,z+d/2];for(const [u,t,s]of[[a,b,.7],[b,e,.82],[e,f,.93],[f,a,.64]])for(const p of[u,t,v])this.vertex(p,c,s);}
  render(eye,target,time=0){
    const g=this.gl,dpr=Math.min(devicePixelRatio,this.low?1:1.5),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    g.viewport(0,0,w,h);const sky=[.77,.80,.74];g.clearColor(...sky,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
    g.uniformMatrix4fv(this.vp,false,matrix(eye,target,w/h));g.uniform3fv(this.eye,eye);g.uniform3fv(this.sky,sky);
    g.bufferData(g.ARRAY_BUFFER,this.data.subarray(0,this.n),g.DYNAMIC_DRAW);g.drawArrays(g.TRIANGLES,0,this.n/6);
  }
}
