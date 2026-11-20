const express=require('express'),http=require('http'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const {Server}=require('socket.io'),multer=require('multer');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:1e6});
const uploadDir=path.join(__dirname,'uploads');fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({storage:multer.diskStorage({destination:uploadDir,filename:(req,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:100*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^(audio\/|video\/)/.test(file.mimetype))});
const library=[];const rooms=new Map();const liveRooms=new Set();
app.use(express.static(path.join(__dirname,'public')));app.get('/api/health',(req,res)=>res.json({ok:true,service:'Street Heat Live'}));
app.get('/api/config',(req,res)=>res.json({service:'Street Heat Live',cameraEnabled:true,microphoneEnabled:true,screenShareEnabled:true,signaling:'socket.io',socketPath:'/socket.io'}));
app.get('/api/media',(req,res)=>res.json(library));
app.post('/api/media',upload.single('media'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Choose an audio or video file (100 MB max).'});const item={id:crypto.randomUUID(),name:req.file.originalname,url:'/media/'+req.file.filename,type:req.file.mimetype};library.push(item);res.json(item)});
app.use('/media',express.static(uploadDir,{acceptRanges:true}));
function members(room){return [...(rooms.get(room)||new Map()).entries()].map(([id,v])=>({id,...v}));}
io.on('connection',socket=>{
 socket.on('join-room',({room,name,role},ack)=>{room=String(room||'').trim().slice(0,64);name=String(name||'Guest').slice(0,40);if(!/^[a-zA-Z0-9_-]{3,64}$/.test(room))return ack?.({error:'Invalid room ID'});if(socket.data.room)socket.leave(socket.data.room);const group=rooms.get(room)||new Map();if(group.size>=16)return ack?.({error:'Room is full'});const existing=members(room);group.set(socket.id,{name,role:['host','guest','viewer'].includes(role)?role:'guest'});rooms.set(room,group);socket.join(room);socket.data.room=room;socket.data.name=name;ack?.({id:socket.id,peers:existing,live:liveRooms.has(room)});socket.to(room).emit('peer-joined',{id:socket.id,name,role});io.to(room).emit('members',members(room));io.to(room).emit('live-state',{live:liveRooms.has(room)});});
 socket.on('start-live',(ack)=>{const room=socket.data.room;if(!room||rooms.get(room)?.get(socket.id)?.role!=='host')return ack?.({error:'Only the host can start live'});liveRooms.add(room);io.to(room).emit('live-state',{live:true});ack?.({ok:true});});
 socket.on('end-live',(ack)=>{const room=socket.data.room;if(!room||rooms.get(room)?.get(socket.id)?.role!=='host')return ack?.({error:'Only the host can end live'});liveRooms.delete(room);io.to(room).emit('live-state',{live:false});ack?.({ok:true});});
 socket.on('signal',({to,data})=>{const room=socket.data.room;if(room&&rooms.get(room)?.has(to)&&data&&JSON.stringify(data).length<100000)io.to(to).emit('signal',{from:socket.id,data});});
 socket.on('chat',msg=>{const room=socket.data.room;if(room)io.to(room).emit('chat',{name:socket.data.name||'Guest',text:String(msg||'').slice(0,500),time:Date.now()});});
 socket.on('playback',data=>{const room=socket.data.room;if(room&&rooms.get(room)?.get(socket.id)?.role==='host')socket.to(room).emit('playback',data);});
 socket.on('disconnect',()=>{const room=socket.data.room;if(!room)return;const group=rooms.get(room);group?.delete(socket.id);socket.to(room).emit('peer-left',socket.id);if(!group?.size){rooms.delete(room);liveRooms.delete(room);}else {if(![...group.values()].some(m=>m.role==='host'))liveRooms.delete(room);io.to(room).emit('members',members(room));io.to(room).emit('live-state',{live:liveRooms.has(room)});}});
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('STREET HEAT LIVE running on port '+(process.env.PORT||3000)));
