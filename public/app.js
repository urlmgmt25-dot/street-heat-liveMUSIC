const $=id=>document.getElementById(id),socket=io(),peers=new Map(),remoteTiles=new Map();let joined=false,room='',role='host',localStream=new MediaStream(),cameraTrack=null,micTrack=null,screenTrack=null,rawCameraTrack=null,backgroundStream=null,backgroundTimer=null,segmentation=null,live=false,backgroundRunning=false;const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
const status=t=>$('status').textContent=t;const error=e=>status('Error: '+(e?.message||e));
function refreshLocal(){ $('local').srcObject=localStream;$('localTile').querySelector('.tag').textContent='You — '+(cameraTrack?'camera on':'camera off')+(screenTrack?' / screen sharing':'');}
function ensureTile(id,name='Guest'){
 let tile=remoteTiles.get(id);
 if(!tile){tile=document.createElement('div');tile.className='video-tile';const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.controls=true;tile.append(video);const tag=document.createElement('div');tag.className='tag';tile.append(tag);$('videos').append(tile);remoteTiles.set(id,tile);}
 tile.querySelector('.tag').textContent=name;
 return tile;
}
async function syncTracks(){
 for(const [id,pc] of peers){
  for(const [kind,track] of [['video',screenTrack||cameraTrack],['audio',micTrack]]){
   const transceiver=pc.getTransceivers().find(t=>t.receiver.track.kind===kind);
   if(transceiver){await transceiver.sender.replaceTrack(track||null);}
  }
 }
}
function makePeer(id,initiator,name='Guest'){
 ensureTile(id,name);
 if(peers.has(id))return peers.get(id);
 const pc=new RTCPeerConnection({iceServers});peers.set(id,pc);
 const video=pc.addTransceiver('video',{direction:'sendrecv'});
 const audio=pc.addTransceiver('audio',{direction:'sendrecv'});
 video.sender.replaceTrack(screenTrack||cameraTrack||null).catch(error);
 audio.sender.replaceTrack(micTrack||null).catch(error);
 pc.onicecandidate=e=>{if(e.candidate)socket.emit('signal',{to:id,data:{candidate:e.candidate}})};
 pc.ontrack=e=>{
  const tile=ensureTile(id);const element=tile.querySelector('video');
  let stream=element.srcObject;
  if(!stream){stream=new MediaStream();element.srcObject=stream;}
  if(!stream.getTracks().some(t=>t.id===e.track.id))stream.addTrack(e.track);
  element.play().catch(()=>{status('Guest connected. Click guest video to enable playback.');});
 };
 pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))status('Guest WebRTC connection failed; a TURN relay may be required.');};
 pc.onnegotiationneeded=async()=>{
  if(!initiator||pc.signalingState!=='stable')return;
  try{await pc.setLocalDescription();socket.emit('signal',{to:id,data:{description:pc.localDescription}});}catch(e){error(e)}
 };
 return pc;
}
const pendingCandidates=new Map();
socket.on('signal',async({from,data})=>{
 try{
  const pc=makePeer(from,false);
  if(data.description){
   await pc.setRemoteDescription(data.description);
   for(const candidate of pendingCandidates.get(from)||[])await pc.addIceCandidate(candidate);
   pendingCandidates.delete(from);
   if(data.description.type==='offer'){
    await pc.setLocalDescription();
    socket.emit('signal',{to:from,data:{description:pc.localDescription}});
   }
  }else if(data.candidate){
   if(pc.remoteDescription)await pc.addIceCandidate(data.candidate);
   else{const list=pendingCandidates.get(from)||[];list.push(data.candidate);pendingCandidates.set(from,list);}
  }
 }catch(e){error(e)}
});
socket.on('peer-joined',({id,name,role:peerRole})=>{if(role==='viewer'&&peerRole==='viewer')return;ensureTile(id,name||'Guest');if(role!=='viewer'&&peerRole==='viewer')makePeer(id,true,name);});
socket.on('peer-left',id=>{peers.get(id)?.close();peers.delete(id);remoteTiles.get(id)?.remove();remoteTiles.delete(id);pendingCandidates.delete(id)});
socket.on('members',members=>{$('members').textContent=members.map(m=>m.name+' ('+m.role+')').join(' • ');$('viewerCount').textContent=members.filter(m=>m.role==='viewer').length+' viewers';for(const member of members){if(member.id!==socket.id && !(role==='viewer'&&member.role==='viewer'))ensureTile(member.id,member.name);}});
socket.on('chat',({name,text,time})=>{const line=document.createElement('div');line.className='chat-line';const b=document.createElement('b');b.textContent=name+': ';line.append(b,document.createTextNode(text));$('chat').append(line);$('chat').scrollTop=$('chat').scrollHeight;});
socket.on('playback',data=>{if(!data?.url)return;$('player').src=data.url;$('player').currentTime=Number(data.time)||0;if(data.play)$('player').play().catch(()=>status('Click Play to hear the shared media.'));});
$('join').onclick=()=>{if(joined)return;room=$('room').value.trim()||Math.random().toString(36).slice(2,9);$('room').value=room;role=$('role').value;socket.emit('join-room',{room,name:$('name').value||'Guest',role},async reply=>{if(reply.error)return status(reply.error);joined=true;$('join').disabled=true;$('room').disabled=true;$('role').disabled=true;$('onAir').textContent='● STUDIO CONNECTED';$('onAir').style.background='#47202a';const url=location.origin+'/?room='+encodeURIComponent(room);$('invite').textContent=url;$('invite').href=url;status('Connected. Enable your camera or microphone to broadcast.');for(const p of reply.peers){if(role==='viewer'&&p.role==='viewer')continue;makePeer(p.id,true,p.name);}if(role==='host')$('startLive').disabled=false;updateLive(!!reply.live);if(role==='viewer'){$('camera').disabled=true;$('mic').disabled=true;$('screen').disabled=true;$('background').disabled=true;status('Viewer connected. Waiting for host to start live.');}});};
$('camera').onclick=async()=>{try{if(cameraTrack){stopBackground();cameraTrack.stop();if(rawCameraTrack&&rawCameraTrack!==cameraTrack)rawCameraTrack.stop();rawCameraTrack=null;localStream.removeTrack(cameraTrack);cameraTrack=null;$('camera').textContent='📷 Start Camera';}else{const s=await navigator.mediaDevices.getUserMedia({video:true});rawCameraTrack=s.getVideoTracks()[0];cameraTrack=rawCameraTrack;localStream.addTrack(cameraTrack);if($('background').value!=='none')await applyBackground();$('camera').textContent='📷 Stop Camera';}refreshLocal();syncTracks();}catch(e){error(e)}};
$('mic').onclick=async()=>{try{if(micTrack){micTrack.stop();localStream.removeTrack(micTrack);micTrack=null;$('mic').textContent='🎙️ Enable Microphone';}else{const s=await navigator.mediaDevices.getUserMedia({audio:true});micTrack=s.getAudioTracks()[0];localStream.addTrack(micTrack);$('mic').textContent='🎙️ Mute Microphone';}refreshLocal();syncTracks();}catch(e){error(e)}};
$('screen').onclick=async()=>{try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screenTrack=s.getVideoTracks()[0];screenTrack.onended=stopScreen;localStream.addTrack(screenTrack);$('local').srcObject=new MediaStream([screenTrack,...(micTrack?[micTrack]:[])]);$('stopScreen').disabled=false;syncTracks();status('Screen sharing is active.');}catch(e){error(e)}};
function stopScreen(){if(screenTrack){localStream.removeTrack(screenTrack);screenTrack.stop();screenTrack=null;}refreshLocal();syncTracks();$('stopScreen').disabled=true;status('Screen sharing stopped.');}$('stopScreen').onclick=stopScreen;
$('copy').onclick=async()=>{if(!joined)return status('Join a room first.');try{await navigator.clipboard.writeText($('invite').href);status('Guest link copied.')}catch(e){error(e)}};
function send(){if(!joined)return status('Join a room to chat.');const v=$('message').value.trim();if(v){socket.emit('chat',v);$('message').value='';}}$('send').onclick=send;$('message').onkeydown=e=>{if(e.key==='Enter')send()};
async function loadMedia(){const items=await(await fetch('/api/media')).json();$('library').replaceChildren();for(const item of items){const row=document.createElement('div');row.className='media-row';const name=document.createElement('span');name.textContent=item.name;const play=document.createElement('button');play.textContent='Play';play.onclick=()=>{ $('player').src=item.url;$('player').play().catch(()=>{});if(joined&&role==='host')socket.emit('playback',{url:item.url,time:0,play:true});};row.append(name,play);$('library').append(row);}}
$('upload').onclick=async()=>{const file=$('file').files[0];if(!file)return status('Choose an audio or video file.');const form=new FormData();form.append('media',file);status('Uploading '+file.name+'...');try{const r=await fetch('/api/media',{method:'POST',body:form});const data=await r.json();if(!r.ok)throw Error(data.error||'Upload failed');status('Uploaded '+data.name);loadMedia();}catch(e){error(e)}};
$('player').addEventListener('play',()=>{if(joined&&role==='host')socket.emit('playback',{url:new URL($('player').src).pathname,time:$('player').currentTime,play:true})});$('player').addEventListener('pause',()=>{if(joined&&role==='host')socket.emit('playback',{url:new URL($('player').src).pathname,time:$('player').currentTime,play:false})});
function updateLive(state){live=state;$('liveStatus').textContent=live?'🔴 LIVE NOW':'OFF AIR';$('onAir').textContent=live?'● LIVE':'● STUDIO CONNECTED';$('onAir').style.background=live?'#ab1026':'#47202a';if(role==='viewer')$('videos').style.visibility=live?'visible':'hidden';$('startLive').disabled=!joined||role!=='host'||live;$('endLive').disabled=!joined||role!=='host'||!live;const link=location.origin+'/?room='+encodeURIComponent(room)+'&role=viewer';$('viewerLink').href=live?link:'#';$('viewerLink').textContent=live?link:'Start live to enable';$('copyViewer').disabled=!live;}
socket.on('live-state',({live:state})=>{if(joined)updateLive(state)});
$('startLive').onclick=()=>{if(!joined||role!=='host')return;socket.emit('start-live',reply=>{if(reply?.error)error(reply.error);else status('LIVE on your website. Share the viewer link.');});};
$('endLive').onclick=()=>{socket.emit('end-live',reply=>{if(reply?.error)error(reply.error);else status('Broadcast ended. Studio remains connected.');});};
$('copyViewer').onclick=async()=>{if(live)try{await navigator.clipboard.writeText($('viewerLink').href);status('Viewer link copied.')}catch(e){error(e)}};
function updateLayout(){const grid=$('videos');grid.className='video-grid layout-'+$('ratio').value+($('layout').value==='auto'?'':' layout-'+$('layout').value);}
$('layout').onchange=updateLayout;$('ratio').onchange=updateLayout;
function stopBackground(){backgroundRunning=false;if(backgroundTimer){cancelAnimationFrame(backgroundTimer);backgroundTimer=null;}if(backgroundStream){backgroundStream.getTracks().forEach(t=>t.stop());backgroundStream=null;}segmentation?.close?.().catch(()=>{});segmentation=null;}
async function applyBackground(){if(!rawCameraTrack)return;const mode=$('background').value;stopBackground();if(cameraTrack&&cameraTrack!==rawCameraTrack){localStream.removeTrack(cameraTrack);cameraTrack.stop();}cameraTrack=rawCameraTrack;if(mode==='none'){if(!localStream.getVideoTracks().includes(cameraTrack))localStream.addTrack(cameraTrack);refreshLocal();await syncTracks();return;}
 if(typeof SelfieSegmentation==='undefined'){status('Virtual background library unavailable. Check network connection.');if(!localStream.getVideoTracks().includes(cameraTrack))localStream.addTrack(cameraTrack);await syncTracks();return;}
 const source=document.createElement('video');source.autoplay=true;source.muted=true;source.playsInline=true;source.srcObject=new MediaStream([rawCameraTrack]);await source.play();
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');backgroundRunning=true;let busy=false;
 segmentation=new SelfieSegmentation({locateFile:file=>'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/'+file});segmentation.setOptions({modelSelection:1});
 segmentation.onResults(results=>{if(!backgroundRunning)return;ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(results.segmentationMask,0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-in';ctx.drawImage(results.image,0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='destination-over';if(mode==='blur'){ctx.filter='blur(18px)';ctx.drawImage(results.image,0,0,canvas.width,canvas.height);ctx.filter='none';}else{const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);if(mode==='studio'){grad.addColorStop(0,'#141825');grad.addColorStop(1,'#343e59');}else{grad.addColorStop(0,'#21020b');grad.addColorStop(1,'#d41c37');}ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.restore();});
 backgroundStream=canvas.captureStream(24);cameraTrack=backgroundStream.getVideoTracks()[0];localStream.addTrack(cameraTrack);refreshLocal();await syncTracks();
 const loop=async()=>{if(!backgroundRunning||!rawCameraTrack||rawCameraTrack.readyState!=='live'||$('background').value!==mode){backgroundRunning=false;return;}if(!busy&&source.readyState>=2){busy=true;try{await segmentation.send({image:source});}catch(e){status('Virtual background processing error: '+e.message);backgroundRunning=false;}finally{busy=false;}}backgroundTimer=requestAnimationFrame(loop);};backgroundTimer=requestAnimationFrame(loop);
}
$('background').onchange=()=>applyBackground().catch(e=>{error(e);$('background').value='none';stopBackground();});
const params=new URLSearchParams(location.search);if(params.has('room')){$('room').value=params.get('room');$('role').value=params.get('role')==='viewer'?'viewer':'guest';$('name').value=params.get('role')==='viewer'?'Viewer':'Guest';}refreshLocal();loadMedia().catch(error);
