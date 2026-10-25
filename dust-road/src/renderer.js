const VS=`attribute vec3 position; attribute vec3 color; uniform mat4 vp; uniform vec3 eye; varying vec3 vColor; varying vec3 world; void main(){gl_Position=vp*vec4(position,1.);vColor=color;world=position;}`;
const FS=`precision highp float; varying vec3 vColor; varying vec3 world; uniform vec3 eye; uniform vec3 sky;
float hash(vec2 p){return fract(sin(dot(mod(p,128.),vec2(12.9898,78.233)))*4375.5453);}
void main(){
float range=distance(world,eye);float fog=1.-exp(-max(0.,range-65.)*.0023);
vec2 p=world.xz;float grain=hash(floor(p*18.));float large=hash(floor(p*.8));
float detail=(grain-.5)*.065+(large-.5)*.035;
vec3 base=vColor+detail*(1.-smoothstep(10.,120.,range));
// Fine gravel on asphalt, windblown grain on sand, mottling on walls.
float sand=step(vColor.b*1.3,vColor.r)*step(.45,vColor.r);
base+=sand*sin(p.x*.9+p.y*3.1+sin(p.x*.12)*3.)*.012;
base=pow(max(base,vec3(0.)),vec3(.94));
gl_FragColor=vec4(mix(base,sky,fog),1.);}`;
const PVS=`attribute vec3 position;attribute vec3 color;attribute vec3 params;uniform mat4 vp;uniform float height;uniform float maxPoint;varying vec3 tint;varying float opacity;varying float seed;void main(){vec4 clip=vp*vec4(position,1.);gl_Position=clip;gl_PointSize=clamp(params.x*height/max(.1,clip.w),1.,maxPoint);tint=color;opacity=params.y;seed=params.z;}`;
const PFS=`precision mediump float;varying vec3 tint;varying float opacity;varying float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*4375.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
void main(){vec2 uv=gl_PointCoord*2.-1.;float density=exp(-3.5*dot(uv,uv))*(1.-smoothstep(.65,1.,length(uv)));float wisps=.55+.45*noise(uv*4.);float a=density*wisps*opacity;if(a<.003)discard;gl_FragColor=vec4(tint+(.5-uv.y)*.025,a);}`;
const SKYVS=`attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,.999,1.);}`;
const SKYFS=`precision mediump float;varying vec2 uv;uniform vec3 forward;uniform vec3 right;uniform vec3 up;uniform float aspect;void main(){vec3 ray=normalize(forward+right*uv.x*aspect*.672+up*uv.y*.672);vec3 color=mix(vec3(.80,.80,.72),vec3(.38,.59,.75),clamp(ray.y*1.6,0.,1.));float sun=max(0.,dot(ray,normalize(vec3(-.5,.36,-.6))));color+=vec3(1.,.8,.43)*(pow(sun,600.)*.8+pow(sun,18.)*.16);gl_FragColor=vec4(color,1.);}`;
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
    this.particleProgram=g.createProgram();g.attachShader(this.particleProgram,shader(g.VERTEX_SHADER,PVS));g.attachShader(this.particleProgram,shader(g.FRAGMENT_SHADER,PFS));g.linkProgram(this.particleProgram);
    if(!g.getProgramParameter(this.particleProgram,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.particleProgram));
    this.skyProgram=g.createProgram();g.attachShader(this.skyProgram,shader(g.VERTEX_SHADER,SKYVS));g.attachShader(this.skyProgram,shader(g.FRAGMENT_SHADER,SKYFS));g.linkProgram(this.skyProgram);if(!g.getProgramParameter(this.skyProgram,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.skyProgram));
    this.skyBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.skyBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
    this.particleBuffer=g.createBuffer();this.maxPoint=g.getParameter(g.ALIASED_POINT_SIZE_RANGE)[1];
    this.particleData=new Float32Array(600*9);
    this.data=new Float32Array(1500000);this.n=0;this.low=false;
  }
  begin(){this.n=0;this.particles=[];}
  vertex(p,c,shade=1){for(let j=0;j<3;j++)this.data[this.n++]=p[j];for(let j=0;j<3;j++)this.data[this.n++]=c[j]*shade;}
  quad(a,b,c,d,color,shade=1){for(const p of[a,b,c,a,c,d])this.vertex(p,color,shade);}
  box(x,y,z,w,h,d,color,yaw=0){
    const sn=Math.sin(yaw),cs=Math.cos(yaw),points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2*cs+c*d/2*sn,y+b*h/2,z-a*w/2*sn+c*d/2*cs]);
    for(const[f,s]of faces)this.quad(...f.map(i=>points[i]),color,s);
  }
  peak(x,y,z,w,h,d,c){const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],v=[x,y+h,z],e=[x+w/2,y,z+d/2],f=[x-w/2,y,z+d/2];for(const [u,t,s]of[[a,b,.7],[b,e,.82],[e,f,.93],[f,a,.64]])for(const p of[u,t,v])this.vertex(p,c,s);}
  // Round wheels and layered ground shadows replace box silhouettes.
  wheel(x,y,z,r,width,color,yaw=0){
    const sn=Math.sin(yaw),cs=Math.cos(yaw),point=(side,a)=>[x+side*width/2*cs+Math.sin(a)*r*sn,y+Math.cos(a)*r,z-side*width/2*sn+Math.sin(a)*r*cs];
    for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;this.quad(point(-1,a),point(1,a),point(1,b),point(-1,b),color,.7+.2*Math.cos(a));for(const side of [-1,1])for(const p of [point(side,a),point(side,b),[x+side*width/2*cs,y,z-side*width/2*sn]])this.vertex(p,color,.85);}
  }
  shadow(x,z,w,d,height=1,yaw=0){
    const sn=Math.sin(yaw),cs=Math.cos(yaw);
    for(let layer=0;layer<3;layer++){
      const pad=(2-layer)*.2,y=.014+layer*.002,color=[.51-layer*.025,.41-layer*.025,.28-layer*.015];
      const points=[[-w/2-pad,-d/2-pad],[w/2+pad,-d/2-pad],[w/2+pad,d/2+pad],[-w/2-pad,d/2+pad]].map(([a,b])=>[x+a*cs+b*sn+height*.5,y,z-a*sn+b*cs+height*.3]);this.quad(...points,color);
    }
  }
  particle(p){this.particles.push(p);}
  render(eye,target,time=0){
    const g=this.gl,dpr=Math.min(devicePixelRatio,this.low?1:1.5),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
    for(let a=0;a<g.getParameter(g.MAX_VERTEX_ATTRIBS);a++)g.disableVertexAttribArray(a);
    for(const [name,offset]of [['position',0],['color',12]]){const a=g.getAttribLocation(this.program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,24,offset);}
    g.viewport(0,0,w,h);const sky=[.76,.79,.77];g.clearColor(...sky,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
    const forward=normalize(target.map((v,i)=>v-eye[i])),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
    g.useProgram(this.skyProgram);g.bindBuffer(g.ARRAY_BUFFER,this.skyBuffer);for(let a=0;a<g.getParameter(g.MAX_VERTEX_ATTRIBS);a++)g.disableVertexAttribArray(a);
    const position=g.getAttribLocation(this.skyProgram,'position');g.enableVertexAttribArray(position);g.vertexAttribPointer(position,2,g.FLOAT,false,8,0);
    for(const [name,value]of [['forward',forward],['right',right],['up',up]])g.uniform3fv(g.getUniformLocation(this.skyProgram,name),value);g.uniform1f(g.getUniformLocation(this.skyProgram,'aspect'),w/h);
    g.disable(g.DEPTH_TEST);g.drawArrays(g.TRIANGLES,0,3);g.enable(g.DEPTH_TEST);
    g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);for(let a=0;a<g.getParameter(g.MAX_VERTEX_ATTRIBS);a++)g.disableVertexAttribArray(a);
    for(const [name,offset]of [['position',0],['color',12]]){const a=g.getAttribLocation(this.program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,24,offset);}
    g.uniformMatrix4fv(this.vp,false,matrix(eye,target,w/h));g.uniform3fv(this.eye,eye);g.uniform3fv(this.sky,sky);
    g.bufferData(g.ARRAY_BUFFER,this.data.subarray(0,this.n),g.DYNAMIC_DRAW);g.drawArrays(g.TRIANGLES,0,this.n/6);
    if(this.particles.length){
      const ordered=this.particles.slice().sort((a,b)=>Math.hypot(b.x-eye[0],b.y-eye[1],b.z-eye[2])-Math.hypot(a.x-eye[0],a.y-eye[1],a.z-eye[2]));
      let n=0;for(const p of ordered.slice(0,600)){const age=p.age/p.life,smoke=p.kind==='smoke',dust=p.kind==='dust',color=smoke?[.28,.27,.24]:dust?[.70,.56,.36]:[.68,.68,.63];
        const size=p.size+p.age*(smoke?.65:dust?.9:.4),alpha=Math.min(1,p.age*8)*(1-age)*(smoke?.52:dust?.3:.16);
        this.particleData.set([p.x,p.y,p.z,...color,size*2,alpha,p.seed%100],n);n+=9;
      }
      const program=this.particleProgram;g.useProgram(program);g.bindBuffer(g.ARRAY_BUFFER,this.particleBuffer);g.bufferData(g.ARRAY_BUFFER,this.particleData.subarray(0,n),g.DYNAMIC_DRAW);
      for(let a=0;a<g.getParameter(g.MAX_VERTEX_ATTRIBS);a++)g.disableVertexAttribArray(a);
      for(const [name,offset]of [['position',0],['color',12],['params',24]]){const a=g.getAttribLocation(program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,36,offset);}
      g.uniformMatrix4fv(g.getUniformLocation(program,'vp'),false,matrix(eye,target,w/h));g.uniform1f(g.getUniformLocation(program,'height'),h);g.uniform1f(g.getUniformLocation(program,'maxPoint'),this.maxPoint);
      g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);g.drawArrays(g.POINTS,0,n/9);g.depthMask(true);g.disable(g.BLEND);
    }
  }
}
